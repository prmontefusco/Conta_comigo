import {
  addMonthsToKey,
  monthKeyOf,
  type CalendarDate,
  type MonthKey,
} from "@/core/date/calendar-date";
import { type Money, add, compare, money, zero } from "@/core/money/money";
import type { CategoryId, RecurringRuleId } from "@/modules/shared/domain/common";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import type { Transaction } from "@/modules/transactions/domain/transaction";

/**
 * Estimator for variable recurring expenses (such as electricity, water, and gas).
 *
 * Variable bills fluctuate month to month due to weather, tariffs, and consumption.
 * Predicting future cash flow requires an honest baseline derived from actual past
 * payments, rather than arbitrary guesses.
 *
 * This function looks back over full prior months (excluding the current partial month),
 * deduplicates settled obligations and expense transactions, and computes statistical
 * averages and safety margins.
 */

export interface EstimateVariableExpenseInput {
  readonly transactions: readonly Transaction[];
  readonly obligations: readonly Obligation[];
  readonly asOf: CalendarDate;
  /** Filter by category (e.g. "energia", "agua") */
  readonly categoryId?: CategoryId;
  /** Filter by recurring rule ID if obligations originated from a rule */
  readonly recurringRuleId?: RecurringRuleId;
  /** Search terms in description (e.g. ["luz", "energia", "enel"]) */
  readonly searchTerms?: readonly string[];
  /** Number of complete past months to analyze (defaults to 3, max 12) */
  readonly lookbackMonths?: number;
  /** Additional buffer for tariff flags or seasonal peaks (e.g. 0.10 for +10%) */
  readonly safetyMarginPercent?: number;
}

export interface MonthObserved {
  readonly month: MonthKey;
  readonly amount: Money;
  readonly count: number;
}

export interface VariableExpenseEstimate {
  /** Average monthly bill among months where a payment was recorded */
  readonly average: Money;
  /** Median monthly bill (typical month, resistant to single spikes) */
  readonly median: Money;
  /** Lowest month observed */
  readonly lowest: Money;
  /** Highest month observed */
  readonly highest: Money;
  /** Average with safety buffer applied (e.g. +10%) */
  readonly withSafetyMargin: Money;
  /** Number of complete months that had payments recorded */
  readonly sampleCount: number;
  /** Number of full months evaluated in the lookback window */
  readonly monthsInspected: number;
  /** Month by month summary, newest first */
  readonly monthsObserved: readonly MonthObserved[];
  /** True when at least one month had recorded payments */
  readonly hasSufficientData: boolean;
}

const DEFAULT_LOOKBACK_MONTHS = 3;
const DEFAULT_SAFETY_MARGIN_PERCENT = 0.1; // +10%

export function estimateVariableExpense(
  input: EstimateVariableExpenseInput,
): VariableExpenseEstimate {
  const currency = input.transactions[0]?.amount.currency ?? "BRL";
  const lookback = Math.min(Math.max(input.lookbackMonths ?? DEFAULT_LOOKBACK_MONTHS, 1), 12);
  const safetyPercent = input.safetyMarginPercent ?? DEFAULT_SAFETY_MARGIN_PERCENT;

  // The current month is intentionally excluded because it is still in progress.
  const currentMonth = monthKeyOf(input.asOf);
  const targetMonths: MonthKey[] = Array.from({ length: lookback }, (_unused, index) =>
    addMonthsToKey(currentMonth, -(index + 1)),
  );
  const targetMonthsSet = new Set<MonthKey>(targetMonths);

  const cleanTerms = (input.searchTerms ?? [])
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 2);

  function matchesFilter(
    categoryId?: CategoryId,
    description?: string,
    ruleId?: RecurringRuleId,
  ): boolean {
    if (input.recurringRuleId && ruleId === input.recurringRuleId) {
      return true;
    }

    const categoryMatches = input.categoryId ? categoryId === input.categoryId : false;
    const descLower = (description ?? "").toLowerCase();
    const termMatches =
      cleanTerms.length > 0 && cleanTerms.some((term) => descLower.includes(term));

    if (input.categoryId && cleanTerms.length > 0) {
      return categoryMatches || termMatches;
    }
    if (input.categoryId) {
      return categoryMatches;
    }
    if (cleanTerms.length > 0) {
      return termMatches;
    }
    return false;
  }

  // Deduplication: track obligation IDs settled by transactions so they aren't counted twice.
  const settledViaTransactions = new Set<string>();
  for (const tx of input.transactions) {
    if ("settlesObligationId" in tx && tx.settlesObligationId) {
      settledViaTransactions.add(tx.settlesObligationId);
    }
  }

  const monthlyTotals = new Map<MonthKey, { amount: Money; count: number }>();
  for (const month of targetMonths) {
    monthlyTotals.set(month, { amount: zero(currency), count: 0 });
  }

  // 1. Scan expense transactions
  for (const tx of input.transactions) {
    if (tx.kind !== "EXPENSE") continue;
    const month = monthKeyOf(tx.competenceDate);
    if (!targetMonthsSet.has(month)) continue;

    if (matchesFilter(tx.categoryId, tx.description)) {
      const bucket = monthlyTotals.get(month)!;
      bucket.amount = add(bucket.amount, tx.amount);
      bucket.count += 1;
    }
  }

  // 2. Scan settled obligations not already accounted for by a transaction
  for (const ob of input.obligations) {
    if (ob.direction !== "OUTFLOW") continue;
    if (ob.status !== "SETTLED" && ob.status !== "PARTIALLY_SETTLED") continue;
    if (settledViaTransactions.has(ob.id)) continue;

    const month = monthKeyOf(ob.competenceDate);
    if (!targetMonthsSet.has(month)) continue;

    if (matchesFilter(ob.categoryId, ob.description, ob.source?.recurringRuleId)) {
      const bucket = monthlyTotals.get(month)!;
      const amountPaid = ob.settledAmount.amount > 0 ? ob.settledAmount : ob.amount;
      bucket.amount = add(bucket.amount, amountPaid);
      bucket.count += 1;
    }
  }

  const monthsObserved: MonthObserved[] = targetMonths.map((month) => {
    const bucket = monthlyTotals.get(month)!;
    return {
      month,
      amount: bucket.amount,
      count: bucket.count,
    };
  });

  const activeMonths = monthsObserved.filter((m) => m.amount.amount > 0);
  const sampleCount = activeMonths.length;

  if (sampleCount === 0) {
    const z = zero(currency);
    return {
      average: z,
      median: z,
      lowest: z,
      highest: z,
      withSafetyMargin: z,
      sampleCount: 0,
      monthsInspected: lookback,
      monthsObserved,
      hasSufficientData: false,
    };
  }

  const totalSum = activeMonths.reduce((acc, curr) => add(acc, curr.amount), zero(currency));
  const avgCents = Math.round(totalSum.amount / sampleCount);
  const average = money(avgCents, currency);

  // Median: sort active months by amount
  const sortedAmounts = [...activeMonths.map((m) => m.amount)].sort(compare);
  const midIndex = Math.floor(sortedAmounts.length / 2);
  const median =
    sortedAmounts.length % 2 === 1
      ? sortedAmounts[midIndex]!
      : money(
          Math.round((sortedAmounts[midIndex - 1]!.amount + sortedAmounts[midIndex]!.amount) / 2),
          currency,
        );

  const lowest = sortedAmounts[0]!;
  const highest = sortedAmounts[sortedAmounts.length - 1]!;

  const safetyCents = Math.round(average.amount * (1 + safetyPercent));
  const withSafetyMargin = money(safetyCents, currency);

  return {
    average,
    median,
    lowest,
    highest,
    withSafetyMargin,
    sampleCount,
    monthsInspected: lookback,
    monthsObserved,
    hasSufficientData: true,
  };
}
