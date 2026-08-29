import {
  addMonthsToKey,
  compareMonthKeys,
  firstDayOfMonthKey,
  lastDayOfMonthKey,
  monthKeyOf,
  type CalendarDate,
  type MonthKey,
} from "@/core/date/calendar-date";
import { add, subtract, sum, zero, type Money } from "@/core/money/money";
import type { CardStatement } from "@/modules/cards/domain/credit-card";
import { buildSchedule, type Debt } from "@/modules/debts/domain/debt";
import { isOpen, remainingAmount, type Obligation } from "@/modules/obligations/domain/obligation";
import { occurrencesBetween, type RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import type { Budget } from "@/modules/budget/domain/budget";
import {
  incomeEffect,
  spendingEffect,
  type Transaction,
} from "@/modules/transactions/domain/transaction";
import type { CategoryId, ExpenseNature } from "@/modules/shared/domain/common";

/**
 * Reports.
 *
 * Every function here exists because it answers a question someone actually
 * asks. A number that does not change a decision is not worth a chart
 * (docs/PRODUCT.md section 33).
 *
 * All of them are pure, like the forecast engine: they take domain values and
 * return values. Nothing reads a database.
 */

/** The last `count` months, oldest first, ending at the month of `asOf`. */
export function recentMonths(asOf: CalendarDate, count: number): MonthKey[] {
  const current = monthKeyOf(asOf);
  return Array.from({ length: count }, (_unused, index) =>
    addMonthsToKey(current, index - (count - 1)),
  );
}

/** The next `count` months, starting at the month of `asOf`. */
export function upcomingMonths(asOf: CalendarDate, count: number): MonthKey[] {
  const current = monthKeyOf(asOf);
  return Array.from({ length: count }, (_unused, index) => addMonthsToKey(current, index));
}

/* ------------------------------------------------------------------ */
/* "Quanto entrou e quanto saiu, de verdade?"                          */
/* ------------------------------------------------------------------ */

export interface MonthlyCashFlow {
  readonly month: MonthKey;
  /** Income earned in the month, by competence. */
  readonly income: Money;
  /** Consumption incurred in the month, by competence. */
  readonly spending: Money;
  readonly result: Money;
  /** Money that actually entered accounts, by movement date. */
  readonly cashIn: Money;
  /** Money that actually left accounts, by movement date. */
  readonly cashOut: Money;
  readonly cashResult: Money;
}

/**
 * Realised cash flow, month by month.
 *
 * Two pairs of numbers, deliberately not merged. Income and spending answer
 * "how did this month go?"; cash in and cash out answer "what actually moved?".
 * A month with a big card statement paid can be heavy on cash and light on
 * consumption, and that difference is the point.
 */
export function cashFlowByMonth(
  transactions: readonly Transaction[],
  months: readonly MonthKey[],
): MonthlyCashFlow[] {
  const wanted = new Set(months);

  const byCompetence = new Map<MonthKey, { income: Money; spending: Money }>();
  const byCash = new Map<MonthKey, { cashIn: Money; cashOut: Money }>();

  for (const month of months) {
    byCompetence.set(month, { income: zero(), spending: zero() });
    byCash.set(month, { cashIn: zero(), cashOut: zero() });
  }

  for (const transaction of transactions) {
    const competenceMonth = monthKeyOf(transaction.competenceDate);
    if (wanted.has(competenceMonth)) {
      const bucket = byCompetence.get(competenceMonth)!;
      const income = incomeEffect(transaction);
      const spending = spendingEffect(transaction);
      if (income) bucket.income = add(bucket.income, income.amount);
      if (spending) bucket.spending = add(bucket.spending, spending.amount);
    }

    const cashMonth = monthKeyOf(transaction.transactionDate);
    if (wanted.has(cashMonth)) {
      const bucket = byCash.get(cashMonth)!;
      // Transfers and in-account reserve moves net to zero and are excluded:
      // showing them would inflate both sides without telling anyone anything.
      switch (transaction.kind) {
        case "INCOME":
        case "LOAN_DISBURSEMENT":
          bucket.cashIn = add(bucket.cashIn, transaction.amount);
          break;
        case "EXPENSE":
        case "CARD_STATEMENT_PAYMENT":
        case "DEBT_PAYMENT":
          bucket.cashOut = add(bucket.cashOut, transaction.amount);
          break;
        case "ADJUSTMENT":
          if (transaction.direction === "INCREASE") {
            bucket.cashIn = add(bucket.cashIn, transaction.amount);
          } else {
            bucket.cashOut = add(bucket.cashOut, transaction.amount);
          }
          break;
        default:
          break;
      }
    }
  }

  return months.map((month) => {
    const competence = byCompetence.get(month)!;
    const cash = byCash.get(month)!;
    return {
      month,
      income: competence.income,
      spending: competence.spending,
      result: subtract(competence.income, competence.spending),
      cashIn: cash.cashIn,
      cashOut: cash.cashOut,
      cashResult: subtract(cash.cashIn, cash.cashOut),
    };
  });
}

/* ------------------------------------------------------------------ */
/* "Para onde meu dinheiro foi?"                                       */
/* ------------------------------------------------------------------ */

export interface CategoryLine {
  readonly categoryId: CategoryId | null;
  /** Already spent in the month. */
  readonly actual: Money;
  /** Owed in the month and not yet paid. */
  readonly committed: Money;
  readonly total: Money;
  /** 0 to 1 of the month's total. */
  readonly share: number;
  /** Difference against the same figure in the previous month. */
  readonly changeFromPrevious: Money;
}

export interface CategoryBreakdown {
  readonly month: MonthKey;
  readonly lines: readonly CategoryLine[];
  readonly total: Money;
}

/**
 * Spending by category, with what is still owed shown alongside.
 *
 * The comparison against the previous month is included because "R$ 900 em
 * alimentação" means little on its own, and "R$ 900, R$ 240 acima do mês
 * passado" means a great deal.
 */
export function spendingByCategory(
  transactions: readonly Transaction[],
  obligations: readonly Obligation[],
  month: MonthKey,
): CategoryBreakdown {
  const current = collectByCategory(transactions, obligations, month);
  const previous = collectByCategory(transactions, obligations, addMonthsToKey(month, -1));

  const total = sum([...current.values()].map((entry) => add(entry.actual, entry.committed)));

  const lines: CategoryLine[] = [...current.entries()]
    .map(([key, entry]) => {
      const lineTotal = add(entry.actual, entry.committed);
      const before = previous.get(key);
      const previousTotal = before ? add(before.actual, before.committed) : zero();

      return {
        categoryId: key === UNCATEGORISED ? null : key,
        actual: entry.actual,
        committed: entry.committed,
        total: lineTotal,
        share: total.amount === 0 ? 0 : lineTotal.amount / total.amount,
        changeFromPrevious: subtract(lineTotal, previousTotal),
      };
    })
    .filter((line) => line.total.amount > 0)
    .sort((a, b) => b.total.amount - a.total.amount);

  return { month, lines, total };
}

const UNCATEGORISED = "__uncategorised__";

function collectByCategory(
  transactions: readonly Transaction[],
  obligations: readonly Obligation[],
  month: MonthKey,
): Map<string, { actual: Money; committed: Money }> {
  const result = new Map<string, { actual: Money; committed: Money }>();

  const bucketFor = (key: string) => {
    let bucket = result.get(key);
    if (!bucket) {
      bucket = { actual: zero(), committed: zero() };
      result.set(key, bucket);
    }
    return bucket;
  };

  for (const transaction of transactions) {
    if (monthKeyOf(transaction.competenceDate) !== month) continue;
    const spending = spendingEffect(transaction);
    if (!spending) continue;

    const bucket = bucketFor(spending.categoryId ?? UNCATEGORISED);
    bucket.actual = add(bucket.actual, spending.amount);
  }

  for (const obligation of obligations) {
    if (obligation.direction !== "OUTFLOW" || !isOpen(obligation)) continue;
    if (monthKeyOf(obligation.competenceDate) !== month) continue;

    const remaining = remainingAmount(obligation);
    if (remaining.amount <= 0) continue;

    const bucket = bucketFor(obligation.categoryId ?? UNCATEGORISED);
    bucket.committed = add(bucket.committed, remaining);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* "Isso é sempre assim, ou foi só este mês?"                          */
/* ------------------------------------------------------------------ */

export interface TrendPoint {
  readonly month: MonthKey;
  readonly amount: Money;
}

/**
 * Monthly series for one category, or for all spending when no category is
 * given. A single month is an anecdote; six months is a pattern.
 */
export function spendingTrend(
  transactions: readonly Transaction[],
  months: readonly MonthKey[],
  categoryId?: CategoryId,
): TrendPoint[] {
  const totals = new Map<MonthKey, Money>(months.map((month) => [month, zero()]));

  for (const transaction of transactions) {
    const spending = spendingEffect(transaction);
    if (!spending) continue;
    if (categoryId && spending.categoryId !== categoryId) continue;

    const month = monthKeyOf(spending.competenceDate);
    const current = totals.get(month);
    if (current === undefined) continue;
    totals.set(month, add(current, spending.amount));
  }

  return months.map((month) => ({ month, amount: totals.get(month) ?? zero() }));
}

/** Average of a series, ignoring months with no activity at all. */
export function averageOf(points: readonly TrendPoint[]): Money {
  const active = points.filter((point) => point.amount.amount > 0);
  if (active.length === 0) return zero();
  return {
    amount: Math.round(sum(active.map((p) => p.amount)).amount / active.length),
    currency: "BRL",
  };
}

/* ------------------------------------------------------------------ */
/* "Quanto do meu custo é obrigatório?"                                */
/* ------------------------------------------------------------------ */

export interface NatureBreakdown {
  readonly month: MonthKey;
  readonly fixed: Money;
  readonly variable: Money;
  readonly occasional: Money;
  readonly total: Money;
  /** Share of the month's commitments that cannot be changed quickly. */
  readonly fixedShare: number;
}

/**
 * Commitments split by how changeable they are.
 *
 * Computed from obligations and recurring rules rather than from what was
 * paid, because that is where the classification lives - and because the
 * question is about the shape of the household's costs, not about which
 * bills happened to clear this month.
 *
 * Nothing is inferred: a bill nobody classified is counted where its own
 * `expenseNature` says (docs/PRODUCT.md section 35).
 */
export function commitmentsByNature(
  obligations: readonly Obligation[],
  recurringRules: readonly RecurringRule[],
  month: MonthKey,
): NatureBreakdown {
  const totals: Record<ExpenseNature, Money> = {
    FIXED: zero(),
    VARIABLE: zero(),
    OCCASIONAL: zero(),
  };

  const materialisedKeys = new Set<string>();

  for (const obligation of obligations) {
    if (obligation.direction !== "OUTFLOW") continue;
    if (monthKeyOf(obligation.competenceDate) !== month) continue;
    if (obligation.status === "CANCELED") continue;

    if (obligation.source?.occurrenceKey) {
      materialisedKeys.add(obligation.source.occurrenceKey);
    }
    totals[obligation.expenseNature] = add(totals[obligation.expenseNature], obligation.amount);
  }

  const from = firstDayOfMonthKey(month);
  const to = lastDayOfMonthKey(month);

  for (const rule of recurringRules) {
    if (rule.direction !== "OUTFLOW") continue;
    for (const occurrence of occurrencesBetween(rule, from, to)) {
      // Same deduplication the forecast uses: a rule occurrence that already
      // became a concrete obligation must not be counted twice.
      if (materialisedKeys.has(occurrence.occurrenceKey)) continue;
      totals[rule.expenseNature] = add(totals[rule.expenseNature], occurrence.amount);
    }
  }

  const total = sum([totals.FIXED, totals.VARIABLE, totals.OCCASIONAL]);

  return {
    month,
    fixed: totals.FIXED,
    variable: totals.VARIABLE,
    occasional: totals.OCCASIONAL,
    total,
    fixedShare: total.amount === 0 ? 0 : totals.FIXED.amount / total.amount,
  };
}

/* ------------------------------------------------------------------ */
/* "O orçamento está funcionando?"                                     */
/* ------------------------------------------------------------------ */

export interface BudgetHistoryPoint {
  readonly month: MonthKey;
  readonly planned: Money;
  readonly actual: Money;
  readonly committed: Money;
  /** planned - (actual + committed). Negative means the month went over. */
  readonly difference: Money;
  readonly hasBudget: boolean;
}

/**
 * Planned against realised, across months.
 *
 * A single month over budget is noise. Six months consistently over means the
 * plan does not match the life, and it is the plan that should change.
 */
export function budgetHistory(
  budgets: readonly Budget[],
  transactions: readonly Transaction[],
  obligations: readonly Obligation[],
  months: readonly MonthKey[],
): BudgetHistoryPoint[] {
  const byMonth = new Map(budgets.map((budget) => [budget.month, budget]));

  return months.map((month) => {
    const budget = byMonth.get(month);
    const budgeted = new Set(budget?.lines.map((line) => line.categoryId) ?? []);

    const planned = budget ? sum(budget.lines.map((line) => line.plannedAmount)) : zero();

    let actual = zero();
    for (const transaction of transactions) {
      const spending = spendingEffect(transaction);
      if (!spending) continue;
      if (monthKeyOf(spending.competenceDate) !== month) continue;
      if (!spending.categoryId || !budgeted.has(spending.categoryId)) continue;
      actual = add(actual, spending.amount);
    }

    let committed = zero();
    for (const obligation of obligations) {
      if (obligation.direction !== "OUTFLOW" || !isOpen(obligation)) continue;
      if (monthKeyOf(obligation.competenceDate) !== month) continue;
      if (!obligation.categoryId || !budgeted.has(obligation.categoryId)) continue;
      committed = add(committed, remainingAmount(obligation));
    }

    return {
      month,
      planned,
      actual,
      committed,
      difference: subtract(planned, add(actual, committed)),
      hasBudget: budget !== undefined,
    };
  });
}

/* ------------------------------------------------------------------ */
/* "Estou reduzindo ou aumentando meu endividamento?"                  */
/* ------------------------------------------------------------------ */

export interface DebtPoint {
  readonly month: MonthKey;
  /** Principal still owed on loans and financings at the end of the month. */
  readonly loans: Money;
  /** Card installments not yet billed, plus statements still unpaid. */
  readonly cards: Money;
  readonly total: Money;
}

export interface DebtOutlook {
  readonly points: readonly DebtPoint[];
  /** Total owed at the end of the first month in the window. */
  readonly startingTotal: Money;
  /** Total owed at the end of the last month in the window. */
  readonly endingTotal: Money;
  /** How much the total falls over the window. Negative means it grows. */
  readonly reduction: Money;
  /** Month each debt is scheduled to end. */
  readonly endings: ReadonlyArray<{ description: string; month: MonthKey }>;
  readonly totalInterestRemaining: Money;
}

/**
 * How the total owed changes if the household simply keeps paying.
 *
 * A projection of contracts already signed, not a forecast of behaviour. It
 * answers the question the dashboard cannot: not "how much do I owe?" but
 * "is this getting better?".
 *
 * Both sides assume every instalment and every statement is paid on its due
 * date. That assumption has to be the same for loans and for cards, or the
 * two halves of the line would be measuring different worlds. Arrears are a
 * fact about today, surfaced by the alerts, and mixing them into a trajectory
 * would only blur it.
 */
export function debtOutlook(
  debts: readonly Debt[],
  cardStatements: readonly CardStatement[],
  months: readonly MonthKey[],
): DebtOutlook {
  const active = debts.filter((debt) => debt.status !== "SETTLED");
  const schedules = active.map((debt) => ({ debt, schedule: buildSchedule(debt) }));

  const points: DebtPoint[] = months.map((month) => {
    const loans = sum(
      schedules.map(({ schedule }) => {
        // Outstanding after the last installment due on or before this month.
        const paidSoFar = schedule.filter(
          (item) => compareMonthKeys(item.competenceMonth, month) <= 0,
        );
        const last = paidSoFar.at(-1);
        if (last) return last.outstandingAfter;
        // Nothing due yet: the whole contracted amount is still owed.
        return schedule[0]?.outstandingAfter !== undefined
          ? add(schedule[0].outstandingAfter, schedule[0].principal)
          : zero();
      }),
    );

    // Everything whose statement falls due after this month is still owed.
    // Statements due on or before it are assumed paid, exactly as the loan
    // schedule above assumes its instalments are.
    const endOfMonth = lastDayOfMonthKey(month);
    const cards = sum(
      cardStatements
        .filter((statement) => statement.dueDate > endOfMonth)
        .map((statement) => statement.remainingAmount),
    );

    return { month, loans, cards, total: add(loans, cards) };
  });

  const first = points[0] ?? { total: zero(), loans: zero(), cards: zero(), month: months[0]! };
  const last = points.at(-1) ?? first;

  const endings = schedules
    .map(({ debt, schedule }) => ({
      description: debt.description,
      month: schedule.at(-1)?.competenceMonth,
    }))
    .filter((entry): entry is { description: string; month: MonthKey } => entry.month !== undefined)
    .sort((a, b) => compareMonthKeys(a.month, b.month));

  return {
    points,
    startingTotal: first.total,
    endingTotal: last.total,
    reduction: subtract(first.total, last.total),
    endings,
    totalInterestRemaining: sum(
      schedules.flatMap(({ schedule }) => schedule.map((item) => item.interest)),
    ),
  };
}
