import { type MonthKey, monthKeyOf } from "@/core/date/calendar-date";
import { type Money, add, clampToZero, subtract, sum, zero } from "@/core/money/money";
import { isOpen, remainingAmount, type Obligation } from "@/modules/obligations/domain/obligation";
import { spendingEffect, type Transaction } from "@/modules/transactions/domain/transaction";
import type {
  AuditFields,
  BudgetId,
  CategoryId,
  ExpenseNature,
  HouseholdId,
  MemberId,
} from "@/modules/shared/domain/common";

/**
 * Budgets.
 *
 * The number that matters is not "planned vs spent" but the three-way split:
 * what was planned, what is already promised, and what has actually gone out.
 * Someone with R$ 1.500 planned for food, R$ 900 spent and R$ 400 already
 * committed has R$ 200 left, not R$ 600 (docs/PRODUCT.md section 34).
 */

export interface BudgetLine {
  readonly categoryId: CategoryId;
  readonly plannedAmount: Money;
  readonly expenseNature?: ExpenseNature;
  readonly memberId?: MemberId;
  readonly notes?: string;
}

export interface Budget extends AuditFields {
  /** Document id equals the month key, so a month can only have one budget. */
  readonly id: BudgetId;
  readonly householdId: HouseholdId;
  readonly month: MonthKey;
  readonly lines: readonly BudgetLine[];
}

export interface BudgetLineStatus {
  readonly categoryId: CategoryId;
  readonly planned: Money;
  /** Money already gone. */
  readonly actual: Money;
  /** Money not yet gone but already owed this month. */
  readonly committed: Money;
  /** planned - actual - committed, floored at zero. */
  readonly available: Money;
  /** How much the category is over its plan, zero when within it. */
  readonly overspend: Money;
  /** 0 to 1+, based on actual + committed. */
  readonly usage: number;
}

export interface BudgetStatus {
  readonly month: MonthKey;
  readonly lines: readonly BudgetLineStatus[];
  readonly totals: BudgetLineStatus;
  /** Spending in categories that have no budget line at all. */
  readonly unbudgeted: Money;
}

/**
 * Computes a budget's standing for a month.
 *
 * `transactions` supplies what actually happened, `obligations` what is still
 * promised. Both are filtered by competence month so a card purchase made in
 * August counts against August even when the fatura is paid in September.
 */
export function computeBudgetStatus(
  budget: Budget,
  transactions: readonly Transaction[],
  obligations: readonly Obligation[],
): BudgetStatus {
  const actualByCategory = new Map<CategoryId, Money>();
  let unbudgetedActual = zero();

  const budgetedCategories = new Set(budget.lines.map((line) => line.categoryId));

  for (const transaction of transactions) {
    const spending = spendingEffect(transaction);
    if (!spending) continue;
    if (monthKeyOf(spending.competenceDate) !== budget.month) continue;

    if (!spending.categoryId || !budgetedCategories.has(spending.categoryId)) {
      unbudgetedActual = add(unbudgetedActual, spending.amount);
      continue;
    }
    actualByCategory.set(
      spending.categoryId,
      add(actualByCategory.get(spending.categoryId) ?? zero(), spending.amount),
    );
  }

  const committedByCategory = new Map<CategoryId, Money>();
  let unbudgetedCommitted = zero();

  for (const obligation of obligations) {
    if (obligation.direction !== "OUTFLOW" || !isOpen(obligation)) continue;
    if (monthKeyOf(obligation.competenceDate) !== budget.month) continue;

    const remaining = remainingAmount(obligation);
    if (remaining.amount <= 0) continue;

    if (!obligation.categoryId || !budgetedCategories.has(obligation.categoryId)) {
      unbudgetedCommitted = add(unbudgetedCommitted, remaining);
      continue;
    }
    committedByCategory.set(
      obligation.categoryId,
      add(committedByCategory.get(obligation.categoryId) ?? zero(), remaining),
    );
  }

  const lines = budget.lines.map((line) =>
    buildLineStatus(
      line.categoryId,
      line.plannedAmount,
      actualByCategory.get(line.categoryId) ?? zero(),
      committedByCategory.get(line.categoryId) ?? zero(),
    ),
  );

  const totals = buildLineStatus(
    "__total__",
    sum(lines.map((line) => line.planned)),
    sum(lines.map((line) => line.actual)),
    sum(lines.map((line) => line.committed)),
  );

  return {
    month: budget.month,
    lines,
    totals,
    unbudgeted: add(unbudgetedActual, unbudgetedCommitted),
  };
}

function buildLineStatus(
  categoryId: CategoryId,
  planned: Money,
  actual: Money,
  committed: Money,
): BudgetLineStatus {
  const used = add(actual, committed);
  const available = clampToZero(subtract(planned, used));
  const overspend = clampToZero(subtract(used, planned));
  const usage = planned.amount === 0 ? (used.amount > 0 ? 1 : 0) : used.amount / planned.amount;

  return { categoryId, planned, actual, committed, available, overspend, usage };
}

/**
 * Copies a budget forward.
 *
 * Most months look like the last one, and retyping twenty categories is the
 * fastest way to make someone abandon budgeting altogether.
 */
export function carryForward(budget: Budget, toMonth: MonthKey, at: AuditFields): Budget {
  return {
    ...budget,
    ...at,
    id: toMonth,
    month: toMonth,
  };
}

/** Total planned for a month. */
export function totalPlanned(budget: Budget): Money {
  return sum(budget.lines.map((line) => line.plannedAmount));
}
