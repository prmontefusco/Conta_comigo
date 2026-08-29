import {
  type CalendarDate,
  type MonthKey,
  addDays,
  endOfMonth,
  monthKeyOf,
  startOfMonth,
} from "@/core/date/calendar-date";
import { type Money, add, clampToZero, subtract, sum, zero } from "@/core/money/money";
import { computeBalances, totalCash, type Account } from "@/modules/accounts/domain/account";
import {
  computeLimitStatus,
  totalCardDebt,
  type CardStatement,
  type CreditCard,
} from "@/modules/cards/domain/credit-card";
import { summariseDebts, type Debt } from "@/modules/debts/domain/debt";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import {
  byUrgency,
  isOpen,
  remainingAmount,
  summarise,
  type Obligation,
  type ObligationTotals,
} from "@/modules/obligations/domain/obligation";
import { protectedTotal, type Reserve } from "@/modules/reserves/domain/reserve";
import {
  incomeEffect,
  spendingEffect,
  type Transaction,
} from "@/modules/transactions/domain/transaction";

/**
 * The dashboard's "today" and "this month" blocks.
 *
 * Everything here answers a question a person actually asks, in the order they
 * ask it: how much do I have, how much is already promised, what is due first,
 * and what will be left.
 */

export interface TodayPosition {
  /** Every centavo the household holds across accounts. */
  readonly totalCash: Money;
  /** Money set aside and deliberately off-limits. */
  readonly protectedReserve: Money;
  /** totalCash - protectedReserve. What is genuinely available to decide about. */
  readonly spendableCash: Money;
  readonly payables: ObligationTotals;
  readonly receivables: ObligationTotals;
  /** Bills due in the next seven days, most urgent first. */
  readonly dueSoon: readonly Obligation[];
  readonly overdue: readonly Obligation[];
  readonly cardDebt: Money;
  readonly loanDebt: Money;
  readonly totalDebt: Money;
  /**
   * Cash minus everything already committed within the month.
   *
   * The honest answer to "how much can I spend without breaking something?".
   */
  readonly uncommittedCash: Money;
}

export interface MonthPosition {
  readonly month: MonthKey;
  readonly incomeReceived: Money;
  readonly incomeExpected: Money;
  readonly expensesPaid: Money;
  readonly expensesPending: Money;
  readonly cardCommitment: Money;
  readonly debtCommitment: Money;
  /** income (received + expected) - expenses (paid + pending). */
  readonly expectedResult: Money;
}

export interface DashboardOverview {
  readonly asOf: CalendarDate;
  readonly today: TodayPosition;
  readonly thisMonth: MonthPosition;
  readonly next30Days: {
    readonly inflows: Money;
    readonly outflows: Money;
    readonly committed: Money;
    readonly lowestProjectedBalance: Money;
    readonly lowestProjectedBalanceDate: CalendarDate;
  };
}

export interface OverviewInput {
  readonly asOf: CalendarDate;
  readonly accounts: readonly Account[];
  readonly transactions: readonly Transaction[];
  readonly obligations: readonly Obligation[];
  readonly reserves: readonly Reserve[];
  readonly cards: readonly CreditCard[];
  readonly cardStatements: readonly CardStatement[];
  readonly debts: readonly Debt[];
  /** A projection already computed for at least the next 30 days. */
  readonly forecast: ForecastResult;
}

export function buildOverview(input: OverviewInput): DashboardOverview {
  const balances = computeBalances(input.accounts, input.transactions, input.asOf);
  const cash = totalCash(input.accounts, balances);
  const reserved = protectedTotal(input.reserves);

  const payables = summarise(input.obligations, input.asOf, "OUTFLOW");
  const receivables = summarise(input.obligations, input.asOf, "INFLOW");

  const sevenDaysOut = addDays(input.asOf, 7);
  const openOutflows = input.obligations.filter(
    (obligation) => obligation.direction === "OUTFLOW" && isOpen(obligation),
  );

  const dueSoon = openOutflows
    .filter((obligation) => obligation.dueDate >= input.asOf && obligation.dueDate <= sevenDaysOut)
    .sort(byUrgency);

  const overdue = openOutflows
    .filter((obligation) => obligation.dueDate < input.asOf)
    .sort(byUrgency);

  const cardDebt = totalCardDebt(input.cardStatements);
  const debtSummary = summariseDebts(input.debts, input.asOf);

  const monthEnd = endOfMonth(input.asOf);
  const committedThisMonth = sum(
    openOutflows.filter((obligation) => obligation.dueDate <= monthEnd).map(remainingAmount),
  );

  const today: TodayPosition = {
    totalCash: cash,
    protectedReserve: reserved,
    spendableCash: subtract(cash, reserved),
    payables,
    receivables,
    dueSoon,
    overdue,
    cardDebt,
    loanDebt: debtSummary.totalOutstanding,
    totalDebt: add(cardDebt, debtSummary.totalOutstanding),
    uncommittedCash: subtract(subtract(cash, reserved), committedThisMonth),
  };

  return {
    asOf: input.asOf,
    today,
    thisMonth: buildMonthPosition(input),
    next30Days: buildNext30Days(input),
  };
}

function buildMonthPosition(input: OverviewInput): MonthPosition {
  const month = monthKeyOf(input.asOf);
  const monthStart = startOfMonth(input.asOf);
  const monthEnd = endOfMonth(input.asOf);

  let incomeReceived = zero();
  let expensesPaid = zero();

  for (const transaction of input.transactions) {
    if (monthKeyOf(transaction.competenceDate) !== month) continue;
    const income = incomeEffect(transaction);
    if (income) incomeReceived = add(incomeReceived, income.amount);
    const spending = spendingEffect(transaction);
    if (spending) expensesPaid = add(expensesPaid, spending.amount);
  }

  let incomeExpected = zero();
  let expensesPending = zero();

  for (const obligation of input.obligations) {
    if (!isOpen(obligation)) continue;
    if (monthKeyOf(obligation.competenceDate) !== month) continue;
    const remaining = remainingAmount(obligation);
    if (obligation.direction === "INFLOW") incomeExpected = add(incomeExpected, remaining);
    else expensesPending = add(expensesPending, remaining);
  }

  const cardCommitment = sum(
    input.cardStatements
      .filter((statement) => statement.dueDate >= monthStart && statement.dueDate <= monthEnd)
      .map((statement) => statement.remainingAmount),
  );

  const debtCommitment = sum(
    input.forecast.events
      .filter(
        (event) =>
          event.source === "DEBT_INSTALLMENT" && event.date >= monthStart && event.date <= monthEnd,
      )
      .map((event) => event.amount),
  );

  return {
    month,
    incomeReceived,
    incomeExpected,
    expensesPaid,
    expensesPending,
    cardCommitment,
    debtCommitment,
    expectedResult: subtract(
      add(incomeReceived, incomeExpected),
      add(add(expensesPaid, expensesPending), add(cardCommitment, debtCommitment)),
    ),
  };
}

function buildNext30Days(input: OverviewInput): DashboardOverview["next30Days"] {
  const limit = addDays(input.asOf, 30);
  const window = input.forecast.days.filter((day) => day.date <= limit);
  const events = input.forecast.events.filter((event) => event.date <= limit);

  const lowest = window.reduce(
    (acc, day) => (day.projectedCashBalance.amount < acc.projectedCashBalance.amount ? day : acc),
    window[0] ?? {
      date: input.asOf,
      projectedCashBalance: input.forecast.openingBalance,
    },
  );

  return {
    inflows: sum(events.filter((e) => e.direction === "INFLOW").map((e) => e.amount)),
    outflows: sum(events.filter((e) => e.direction === "OUTFLOW").map((e) => e.amount)),
    committed: sum(
      events.filter((e) => e.direction === "OUTFLOW" && e.isDebtCommitment).map((e) => e.amount),
    ),
    lowestProjectedBalance: lowest.projectedCashBalance,
    lowestProjectedBalanceDate: lowest.date,
  };
}

/**
 * "How much can I spend today without breaking something later?"
 *
 * Takes the free balance and removes everything already owed before the next
 * expected income arrives. Reported as a fact, with the assumptions visible.
 */
export function safeToSpendToday(
  overview: DashboardOverview,
  forecastResult: ForecastResult,
): { amount: Money; untilDate: CalendarDate | null } {
  const nextInflow = forecastResult.events.find((event) => event.direction === "INFLOW");
  const boundary = nextInflow?.date ?? forecastResult.horizon.to;

  const outflowsBeforeIncome = sum(
    forecastResult.events
      .filter((event) => event.direction === "OUTFLOW" && event.date <= boundary)
      .map((event) => event.amount),
  );

  return {
    amount: clampToZero(subtract(overview.today.spendableCash, outflowsBeforeIncome)),
    untilDate: nextInflow?.date ?? null,
  };
}

/** Card utilisation across the household, for the cards block. */
export function cardsOverview(cards: readonly CreditCard[], statements: readonly CardStatement[]) {
  return cards
    .filter((card) => !card.archived)
    .map((card) => ({
      card,
      status: computeLimitStatus(
        card,
        statements.filter((statement) => statement.creditCardId === card.id),
      ),
    }));
}
