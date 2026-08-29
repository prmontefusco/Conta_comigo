import {
  type CalendarDate,
  type MonthKey,
  addDays,
  addMonths,
  dateRange,
  monthKeyOf,
} from "@/core/date/calendar-date";
import { type Money, allocate, clampToZero, subtract, sum, zero } from "@/core/money/money";
import { forecast } from "./forecast";
import type { ForecastEvent, ForecastInput, ForecastResult } from "./forecast-types";

/**
 * What-if simulations.
 *
 * A scenario is nothing more than a set of extra events fed to the same
 * forecast engine, so a simulated future is computed exactly like the real one.
 * Nothing here is persisted: these are questions, not records.
 *
 * The output is deliberately descriptive. The app reports what the numbers
 * would be; whether the trip is worth it is not the software's call
 * (docs/PRODUCT.md, "this is not financial advice").
 */

export type ScenarioChange =
  | InstallmentPurchaseChange
  | OneOffExpenseChange
  | RecurringExpenseChange
  | IncomeChangeChange
  | ExtraIncomeChange;

/** "I want to buy this in 10 x R$ 300. Does it fit?" */
export interface InstallmentPurchaseChange {
  readonly kind: "INSTALLMENT_PURCHASE";
  readonly description: string;
  readonly totalAmount: Money;
  readonly installments: number;
  readonly firstDueDate: CalendarDate;
}

/** "A trip in December costs R$ 5.000" or "the car breaks tomorrow". */
export interface OneOffExpenseChange {
  readonly kind: "ONE_OFF_EXPENSE";
  readonly description: string;
  readonly amount: Money;
  readonly date: CalendarDate;
}

/** "What if I take on R$ 700 a month?" */
export interface RecurringExpenseChange {
  readonly kind: "RECURRING_EXPENSE";
  readonly description: string;
  readonly monthlyAmount: Money;
  readonly startDate: CalendarDate;
  readonly endDate?: CalendarDate;
  readonly dayOfMonth?: number;
}

/** "What if one income stops, or drops?" A negative delta reduces income. */
export interface IncomeChangeChange {
  readonly kind: "INCOME_CHANGE";
  readonly description: string;
  /** Signed monthly delta. Negative means less money arriving. */
  readonly monthlyDelta: Money;
  readonly startDate: CalendarDate;
  readonly endDate?: CalendarDate;
  readonly dayOfMonth?: number;
}

/** A one-off amount arriving, e.g. a bonus or a sale. */
export interface ExtraIncomeChange {
  readonly kind: "EXTRA_INCOME";
  readonly description: string;
  readonly amount: Money;
  readonly date: CalendarDate;
}

/** Expands a scenario change into forecast events. */
export function changeToEvents(change: ScenarioChange, horizonEnd: CalendarDate): ForecastEvent[] {
  switch (change.kind) {
    case "INSTALLMENT_PURCHASE": {
      const parts = allocate(change.totalAmount, change.installments);
      return parts.map((amount, index) => {
        const date = addMonths(change.firstDueDate, index);
        return {
          date,
          competenceMonth: monthKeyOf(date),
          direction: "OUTFLOW" as const,
          amount,
          description: `${change.description} (${index + 1}/${change.installments})`,
          source: "SIMULATED" as const,
          confidence: "CONFIRMED" as const,
          isDebtCommitment: true,
        };
      });
    }

    case "ONE_OFF_EXPENSE":
      return [
        {
          date: change.date,
          competenceMonth: monthKeyOf(change.date),
          direction: "OUTFLOW",
          amount: change.amount,
          description: change.description,
          source: "SIMULATED",
          confidence: "CONFIRMED",
          isDebtCommitment: false,
        },
      ];

    case "EXTRA_INCOME":
      return [
        {
          date: change.date,
          competenceMonth: monthKeyOf(change.date),
          direction: "INFLOW",
          amount: change.amount,
          description: change.description,
          source: "SIMULATED",
          confidence: "ESTIMATED",
          isDebtCommitment: false,
        },
      ];

    case "RECURRING_EXPENSE":
      return monthlySeries(change.startDate, change.endDate ?? horizonEnd, change.dayOfMonth).map(
        (date) => ({
          date,
          competenceMonth: monthKeyOf(date),
          direction: "OUTFLOW" as const,
          amount: change.monthlyAmount,
          description: change.description,
          source: "SIMULATED" as const,
          confidence: "CONFIRMED" as const,
          isDebtCommitment: false,
        }),
      );

    case "INCOME_CHANGE": {
      const magnitude: Money = {
        amount: Math.abs(change.monthlyDelta.amount),
        currency: change.monthlyDelta.currency,
      };
      const direction = change.monthlyDelta.amount < 0 ? ("OUTFLOW" as const) : ("INFLOW" as const);
      return monthlySeries(change.startDate, change.endDate ?? horizonEnd, change.dayOfMonth).map(
        (date) => ({
          date,
          competenceMonth: monthKeyOf(date),
          direction,
          amount: magnitude,
          description: change.description,
          source: "SIMULATED" as const,
          confidence: "CONFIRMED" as const,
          isDebtCommitment: false,
        }),
      );
    }
  }
}

function monthlySeries(
  start: CalendarDate,
  end: CalendarDate,
  dayOfMonth?: number,
): CalendarDate[] {
  const dates: CalendarDate[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 600) {
    dates.push(cursor);
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return dayOfMonth
    ? dates.map(
        (date) => `${date.slice(0, 8)}${String(dayOfMonth).padStart(2, "0")}` as CalendarDate,
      )
    : dates;
}

/* ------------------------------------------------------------------ */
/* Comparison                                                          */
/* ------------------------------------------------------------------ */

export interface MonthComparison {
  readonly month: MonthKey;
  readonly baselineFreeBalance: Money;
  readonly scenarioFreeBalance: Money;
  readonly difference: Money;
  readonly becomesDeficit: boolean;
}

export interface ScenarioResult {
  readonly baseline: ForecastResult;
  readonly scenario: ForecastResult;
  readonly changes: readonly ScenarioChange[];
  readonly months: readonly MonthComparison[];
  /** Total the scenario adds to outflows over the horizon. */
  readonly additionalOutflows: Money;
  /** Lowest projected free balance under the scenario. */
  readonly lowestFreeBalance: Money;
  readonly lowestFreeBalanceDate: CalendarDate;
  /** Months that were fine before and are short afterwards. */
  readonly newDeficitMonths: readonly MonthKey[];
  /**
   * Whether the scenario keeps the free balance at or above zero throughout.
   *
   * A statement of arithmetic, not a recommendation.
   */
  readonly staysAboveZero: boolean;
  /** How much would be missing at the worst point, zero when nothing is. */
  readonly shortfallAtWorstPoint: Money;
}

export function simulate(base: ForecastInput, changes: readonly ScenarioChange[]): ScenarioResult {
  const baseline = forecast(base);

  const simulatedEvents = changes.flatMap((change) => changeToEvents(change, base.horizon.to));

  const scenario = forecast({
    ...base,
    simulatedEvents: [...(base.simulatedEvents ?? []), ...simulatedEvents],
  });

  const baselineByMonth = new Map(baseline.months.map((month) => [month.month, month]));

  const months: MonthComparison[] = scenario.months.map((month) => {
    const before = baselineByMonth.get(month.month);
    const baselineFree = before?.freeEndingBalance ?? zero(month.freeEndingBalance.currency);
    return {
      month: month.month,
      baselineFreeBalance: baselineFree,
      scenarioFreeBalance: month.freeEndingBalance,
      difference: subtract(month.freeEndingBalance, baselineFree),
      becomesDeficit: !before?.isDeficit && month.isDeficit,
    };
  });

  const lowest = scenario.days.reduce(
    (acc, day) => (day.freeProjectedBalance.amount < acc.freeProjectedBalance.amount ? day : acc),
    scenario.days[0] ?? {
      date: base.asOf,
      freeProjectedBalance: zero(base.openingBalance.currency),
    },
  );

  const additionalOutflows = sum(
    simulatedEvents.filter((event) => event.direction === "OUTFLOW").map((event) => event.amount),
    base.openingBalance.currency,
  );

  return {
    baseline,
    scenario,
    changes,
    months,
    additionalOutflows,
    lowestFreeBalance: lowest.freeProjectedBalance,
    lowestFreeBalanceDate: lowest.date,
    newDeficitMonths: months.filter((month) => month.becomesDeficit).map((month) => month.month),
    staysAboveZero: lowest.freeProjectedBalance.amount >= 0,
    shortfallAtWorstPoint: clampToZero({
      amount: -lowest.freeProjectedBalance.amount,
      currency: lowest.freeProjectedBalance.currency,
    }),
  };
}

/** Convenience wrapper for the "can I afford this purchase?" question. */
export function simulatePurchase(
  base: Omit<ForecastInput, "horizon">,
  purchase: {
    description: string;
    totalAmount: Money;
    installments: number;
    firstDueDate: CalendarDate;
  },
): ScenarioResult {
  // The horizon covers every installment plus a month of slack, so the answer
  // never stops just short of the month that would have gone negative.
  const horizonEnd = addDays(addMonths(purchase.firstDueDate, purchase.installments + 1), 0);
  return simulate({ ...base, horizon: dateRange(base.asOf, horizonEnd) }, [
    { kind: "INSTALLMENT_PURCHASE", ...purchase },
  ]);
}
