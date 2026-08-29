import {
  type CalendarDate,
  addDays,
  dateRange,
  eachDayInRange,
  eachMonthInRange,
  endOfMonth,
  isBefore,
  startOfMonth,
  isWithin,
  maxDate,
  monthKeyOf,
  type MonthKey,
} from "@/core/date/calendar-date";
import { type Money, add, clampToZero, subtract, sum, zero } from "@/core/money/money";
import { upcomingInstallments } from "@/modules/debts/domain/debt";
import { isOpen, remainingAmount } from "@/modules/obligations/domain/obligation";
import { occurrencesBetween } from "@/modules/recurring/domain/recurring-rule";
import type {
  ForecastDay,
  ForecastEvent,
  ForecastInput,
  ForecastMonth,
  ForecastResult,
  ForecastSummary,
} from "./forecast-types";

/**
 * The forecast engine.
 *
 * It answers the questions the product exists for: what is coming, what is
 * already promised, and what is genuinely left. It is a pure function of its
 * input so it can be tested exhaustively and so a what-if simulation is just
 * the same function with extra events.
 *
 * The engine never invents optimism. An expected salary that has not arrived is
 * a projection, never a balance; a protected reserve is never counted as
 * spendable; a bill that is late stays in the projection until it is paid.
 */

export function forecast(input: ForecastInput): ForecastResult {
  const currency = input.openingBalance.currency;
  const includeEstimated = input.includeEstimated ?? true;

  const events = collectEvents(input)
    .filter((event) => includeEstimated || event.confidence === "CONFIRMED")
    .sort(compareEvents);

  const eventsByDay = groupByDay(events);
  const days = buildDays(input, eventsByDay, currency);
  const months = buildMonths(input, days, events, currency);
  const summary = buildSummary(input, days, months, events, currency);

  return {
    asOf: input.asOf,
    horizon: input.horizon,
    openingBalance: input.openingBalance,
    protectedReserve: input.protectedReserve,
    days,
    months,
    summary,
    events,
  };
}

/* ------------------------------------------------------------------ */
/* Event collection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Turns every source of future money movement into one ordered stream.
 *
 * Deduplication is the delicate part. The same bill can be described by a
 * recurring rule *and* already exist as a materialised obligation; a card
 * statement can also have been turned into an obligation. Whenever both
 * exist, the concrete record wins and the generated one is dropped, because
 * the concrete one may have been edited or partly paid.
 */
export function collectEvents(input: ForecastInput): ForecastEvent[] {
  const events: ForecastEvent[] = [];
  const { from, to } = input.horizon;

  const materialisedOccurrenceKeys = new Set<string>();
  const materialisedStatementIds = new Set<string>();
  const materialisedDebtInstallments = new Set<string>();

  for (const obligation of input.obligations) {
    if (obligation.source?.occurrenceKey) {
      materialisedOccurrenceKeys.add(obligation.source.occurrenceKey);
    }
    if (obligation.source?.cardStatementId) {
      materialisedStatementIds.add(obligation.source.cardStatementId);
    }
    if (obligation.source?.debtId && obligation.source.installmentNumber) {
      materialisedDebtInstallments.add(
        `${obligation.source.debtId}:${obligation.source.installmentNumber}`,
      );
    }
  }

  /* --- Obligations already recorded ------------------------------- */

  for (const obligation of input.obligations) {
    if (!isOpen(obligation)) continue;
    const remaining = remainingAmount(obligation);
    if (remaining.amount <= 0) continue;

    // A late bill still has to be paid. It sits on the first day of the
    // projection rather than quietly vanishing into the past.
    const overdue = isBefore(obligation.dueDate, input.asOf);
    const date = overdue ? input.asOf : obligation.dueDate;
    if (!isWithin(date, from, to)) continue;

    events.push({
      date,
      competenceMonth: monthKeyOf(obligation.competenceDate),
      direction: obligation.direction,
      amount: remaining,
      description: obligation.description,
      source: overdue ? "OVERDUE_OBLIGATION" : "OBLIGATION",
      confidence: obligation.confidence,
      ...(obligation.categoryId ? { categoryId: obligation.categoryId } : {}),
      referenceId: obligation.id,
      isDebtCommitment:
        obligation.origin === "DEBT_SCHEDULE" ||
        obligation.origin === "CARD_STATEMENT" ||
        obligation.origin === "INSTALLMENT_PLAN",
    });
  }

  /* --- Recurring rules -------------------------------------------- */

  for (const rule of input.recurringRules) {
    for (const occurrence of occurrencesBetween(rule, from, to)) {
      if (materialisedOccurrenceKeys.has(occurrence.occurrenceKey)) continue;

      events.push({
        date: occurrence.dueDate,
        competenceMonth: monthKeyOf(occurrence.competenceDate),
        direction: rule.direction,
        amount: occurrence.amount,
        description: rule.description,
        source: "RECURRING_RULE",
        confidence: rule.confidence,
        ...(rule.categoryId ? { categoryId: rule.categoryId } : {}),
        referenceId: rule.id,
        isDebtCommitment: false,
      });
    }
  }

  /* --- Credit card statements ------------------------------------- */

  for (const statement of input.cardStatements) {
    if (materialisedStatementIds.has(statement.id)) continue;
    if (statement.remainingAmount.amount <= 0) continue;

    const overdue = isBefore(statement.dueDate, input.asOf);
    const date = overdue ? input.asOf : statement.dueDate;
    if (!isWithin(date, from, to)) continue;

    events.push({
      date,
      competenceMonth: statement.referenceMonth,
      direction: "OUTFLOW",
      amount: statement.remainingAmount,
      description: `Fatura ${statement.referenceMonth}`,
      source: "CARD_STATEMENT",
      confidence: "CONFIRMED",
      referenceId: statement.id,
      isDebtCommitment: true,
    });
  }

  /* --- Loan and financing installments ---------------------------- */

  for (const debt of input.debts) {
    if (debt.status === "SETTLED") continue;
    const paid = input.paidDebtInstallments?.get(debt.id) ?? [];

    // `addDays(asOf, -1)` so an installment due today is still ahead of us.
    for (const installment of upcomingInstallments(debt, addDays(input.asOf, -1), paid)) {
      if (materialisedDebtInstallments.has(`${debt.id}:${installment.number}`)) continue;
      if (!isWithin(installment.dueDate, from, to)) continue;

      events.push({
        date: installment.dueDate,
        competenceMonth: installment.competenceMonth,
        direction: "OUTFLOW",
        amount: installment.total,
        description: `${debt.description} (${installment.number}/${installment.of})`,
        source: "DEBT_INSTALLMENT",
        confidence: "CONFIRMED",
        referenceId: debt.id,
        isDebtCommitment: true,
      });
    }
  }

  /* --- Simulation injections -------------------------------------- */

  for (const event of input.simulatedEvents ?? []) {
    if (!isWithin(event.date, from, to)) continue;
    events.push(event);
  }

  return events;
}

function compareEvents(a: ForecastEvent, b: ForecastEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  // Money arriving is applied before money leaving on the same day, which
  // mirrors how a salary credited on the due date covers the bill.
  if (a.direction !== b.direction) return a.direction === "INFLOW" ? -1 : 1;
  return b.amount.amount - a.amount.amount;
}

function groupByDay(events: readonly ForecastEvent[]): Map<CalendarDate, ForecastEvent[]> {
  const map = new Map<CalendarDate, ForecastEvent[]>();
  for (const event of events) {
    const bucket = map.get(event.date);
    if (bucket) bucket.push(event);
    else map.set(event.date, [event]);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Daily timeline                                                      */
/* ------------------------------------------------------------------ */

function buildDays(
  input: ForecastInput,
  eventsByDay: ReadonlyMap<CalendarDate, ForecastEvent[]>,
  currency: Money["currency"],
): ForecastDay[] {
  let running = input.openingBalance;

  return eachDayInRange(input.horizon).map((date) => {
    const dayEvents = eventsByDay.get(date) ?? [];

    const inflow = sum(
      dayEvents.filter((event) => event.direction === "INFLOW").map((event) => event.amount),
      currency,
    );
    const outflow = sum(
      dayEvents.filter((event) => event.direction === "OUTFLOW").map((event) => event.amount),
      currency,
    );
    const net = subtract(inflow, outflow);
    running = add(running, net);

    return {
      date,
      inflow,
      outflow,
      net,
      projectedCashBalance: running,
      freeProjectedBalance: subtract(running, input.protectedReserve),
      events: dayEvents,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Monthly buckets                                                     */
/* ------------------------------------------------------------------ */

function buildMonths(
  input: ForecastInput,
  days: readonly ForecastDay[],
  events: readonly ForecastEvent[],
  currency: Money["currency"],
): ForecastMonth[] {
  const daysByMonth = new Map<MonthKey, ForecastDay[]>();
  for (const day of days) {
    const key = monthKeyOf(day.date);
    const bucket = daysByMonth.get(key);
    if (bucket) bucket.push(day);
    else daysByMonth.set(key, [day]);
  }

  const allMonthsInRange = eachMonthInRange(input.horizon);
  const firstMonth = allMonthsInRange[0];

  return allMonthsInRange.map((month, index, allMonths) => {
    const monthDays = daysByMonth.get(month) ?? [];

    // Bucketed by competence month, so a card statement paid in October but
    // consumed in September is reported against the month it belongs to.
    //
    // Events whose competence month is already in the past - an overdue bill
    // from July still unpaid in August - would otherwise vanish from the table
    // while still counting in the summary. They belong to the first month
    // shown, because that is when the money actually has to move.
    const monthEvents = events.filter(
      (event) =>
        event.competenceMonth === month ||
        (index === 0 && firstMonth !== undefined && event.competenceMonth < firstMonth),
    );

    const expectedInflows = sum(
      monthEvents.filter((event) => event.direction === "INFLOW").map((event) => event.amount),
      currency,
    );
    const committedOutflows = sum(
      monthEvents.filter((event) => event.direction === "OUTFLOW").map((event) => event.amount),
      currency,
    );
    const debtCommitment = sum(
      monthEvents
        .filter((event) => event.direction === "OUTFLOW" && event.isDebtCommitment)
        .map((event) => event.amount),
      currency,
    );

    const net = subtract(expectedInflows, committedOutflows);

    const openingCashBalance =
      index === 0
        ? input.openingBalance
        : (daysByMonth.get(allMonths[index - 1] as MonthKey)?.at(-1)?.projectedCashBalance ??
          input.openingBalance);

    const endingCashBalance = monthDays.at(-1)?.projectedCashBalance ?? openingCashBalance;

    const lowest = monthDays.reduce<ForecastDay | undefined>(
      (acc, day) =>
        acc === undefined || day.projectedCashBalance.amount < acc.projectedCashBalance.amount
          ? day
          : acc,
      undefined,
    );

    const deficitAmount = clampToZero(subtract(committedOutflows, expectedInflows));

    return {
      month,
      expectedInflows,
      committedOutflows,
      debtCommitment,
      net,
      openingCashBalance,
      endingCashBalance,
      freeEndingBalance: subtract(endingCashBalance, input.protectedReserve),
      lowestBalance: lowest?.projectedCashBalance ?? endingCashBalance,
      lowestBalanceDate: lowest?.date ?? monthDays[0]?.date ?? input.asOf,
      isDeficit: deficitAmount.amount > 0,
      deficitAmount,
      isPartial: index === 0 && input.horizon.from !== startOfMonth(input.horizon.from),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

function buildSummary(
  input: ForecastInput,
  days: readonly ForecastDay[],
  months: readonly ForecastMonth[],
  events: readonly ForecastEvent[],
  currency: Money["currency"],
): ForecastSummary {
  const lastDay = days.at(-1);
  const projectedCashBalance = lastDay?.projectedCashBalance ?? input.openingBalance;

  const expectedInflows = sum(
    events.filter((event) => event.direction === "INFLOW").map((event) => event.amount),
    currency,
  );
  const committedOutflows = sum(
    events.filter((event) => event.direction === "OUTFLOW").map((event) => event.amount),
    currency,
  );
  const debtCommitment = sum(
    events
      .filter((event) => event.direction === "OUTFLOW" && event.isDebtCommitment)
      .map((event) => event.amount),
    currency,
  );
  const overdueAmount = sum(
    events
      .filter((event) => event.source === "OVERDUE_OBLIGATION" && event.direction === "OUTFLOW")
      .map((event) => event.amount),
    currency,
  );

  const thirtyDayLimit = addDays(input.asOf, 30);
  const upcomingAmount = sum(
    events
      .filter(
        (event) =>
          event.direction === "OUTFLOW" &&
          event.source !== "OVERDUE_OBLIGATION" &&
          event.date <= thirtyDayLimit,
      )
      .map((event) => event.amount),
    currency,
  );

  const lowestDay = days.reduce<ForecastDay | undefined>(
    (acc, day) =>
      acc === undefined || day.projectedCashBalance.amount < acc.projectedCashBalance.amount
        ? day
        : acc,
    undefined,
  );

  const firstNegative = days.find((day) => day.freeProjectedBalance.amount < 0);
  // A partial first month is skipped: income already received this month is
  // not in the projection, so its shortfall is an artefact of the start date.
  const firstDeficit = months.find((month) => month.isDeficit && !month.isPartial);

  return {
    projectedCashBalance,
    protectedReserve: input.protectedReserve,
    freeProjectedBalance: subtract(projectedCashBalance, input.protectedReserve),
    committedOutflows,
    expectedInflows,
    overdueAmount,
    upcomingAmount,
    debtCommitment,
    lowestProjectedBalance: lowestDay?.projectedCashBalance ?? projectedCashBalance,
    lowestProjectedBalanceDate: lowestDay?.date ?? input.asOf,
    ...(firstNegative ? { firstNegativeDate: firstNegative.date } : {}),
    ...(firstDeficit ? { firstDeficitMonth: firstDeficit.month } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Convenience windows                                                 */
/* ------------------------------------------------------------------ */

export const FORECAST_WINDOWS = [7, 15, 30, 60, 90, 180, 365] as const;
export type ForecastWindowDays = (typeof FORECAST_WINDOWS)[number];

export interface ForecastWindow {
  readonly days: ForecastWindowDays;
  readonly range: { from: CalendarDate; to: CalendarDate };
  readonly summary: ForecastSummary;
}

/**
 * Runs the projection over several horizons at once.
 *
 * Computed from a single long projection rather than re-running the engine per
 * window, so every horizon is guaranteed to tell a consistent story.
 */
export function forecastWindows(
  input: Omit<ForecastInput, "horizon">,
  windows: readonly ForecastWindowDays[] = FORECAST_WINDOWS,
): ForecastWindow[] {
  const longest = Math.max(...windows);
  const full = forecast({
    ...input,
    horizon: dateRange(input.asOf, addDays(input.asOf, longest)),
  });

  return windows.map((windowDays) => {
    const to = addDays(input.asOf, windowDays);
    const slice = full.days.filter((day) => day.date <= to);
    const sliceEvents = full.events.filter((event) => event.date <= to);
    const sliceMonths = full.months.filter((month) => month.month <= monthKeyOf(to));

    return {
      days: windowDays,
      range: { from: input.asOf, to },
      summary: buildSummary(
        { ...input, horizon: dateRange(input.asOf, to) },
        slice,
        sliceMonths,
        sliceEvents,
        input.openingBalance.currency,
      ),
    };
  });
}

/**
 * "Until the end of this month" - the horizon people actually plan against.
 */
export function forecastRestOfMonth(input: Omit<ForecastInput, "horizon">): ForecastResult {
  return forecast({
    ...input,
    horizon: dateRange(input.asOf, maxDate(input.asOf, endOfMonth(input.asOf))),
  });
}

/** Total the household still needs to find before the horizon ends. */
export function amountStillNeeded(result: ForecastResult): Money {
  const shortfall = subtract(result.summary.committedOutflows, result.summary.expectedInflows);
  const covered = subtract(result.openingBalance, result.protectedReserve);
  return clampToZero(subtract(shortfall, covered));
}

/** Free balance today, before anything in the projection happens. */
export function freeBalanceToday(
  input: Pick<ForecastInput, "openingBalance" | "protectedReserve">,
): Money {
  return subtract(input.openingBalance, input.protectedReserve);
}

export const emptyMoney = (currency: Money["currency"] = "BRL"): Money => zero(currency);
