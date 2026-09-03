import { addMonthsToKey, monthKeyOf, type MonthKey } from "@/core/date/calendar-date";
import { type Money, money, sum } from "@/core/money/money";
import type { CardPurchase } from "@/modules/cards/domain/credit-card";
import { buildDailyEntries } from "@/modules/daily/domain/daily-entries";
import type { CategoryId } from "@/modules/shared/domain/common";
import type { Transaction } from "@/modules/transactions/domain/transaction";

/**
 * Ceilings suggested from what the household actually spends.
 *
 * The reason budgets get abandoned in the first month is almost always the
 * same: the numbers were guessed. A ceiling of R$ 600 for a family that has
 * spent R$ 1.100 on food every month for a year is not a plan, it is a
 * disappointment with a date.
 *
 * So this proposes numbers from the household's own history and shows the
 * spread behind them - the typical month and the worst one - because a
 * category that swings between R$ 200 and R$ 900 needs a different decision
 * from one that sits still. The suggestion is never applied on its own: it
 * fills the form, and the person changes what they intend to change.
 */

export interface SuggestBudgetInput {
  readonly transactions: readonly Transaction[];
  readonly cardPurchases: readonly CardPurchase[];
  /** The month being planned. Excluded, because it is still happening. */
  readonly month: MonthKey;
  /** How many complete months to look back over. Three by default. */
  readonly lookbackMonths?: number;
}

export interface SuggestedBudgetLine {
  readonly categoryId: CategoryId;
  /** What to put in the field: the higher of the average and the typical month. */
  readonly suggested: Money;
  /** Total spent divided by the months observed, including months with nothing. */
  readonly average: Money;
  /** The middle month. Lower than the average when one month distorted it. */
  readonly typical: Money;
  readonly highest: Money;
  readonly monthsObserved: number;
}

const DEFAULT_LOOKBACK_MONTHS = 3;

export function suggestBudgetLines(input: SuggestBudgetInput): SuggestedBudgetLine[] {
  const lookback = Math.max(input.lookbackMonths ?? DEFAULT_LOOKBACK_MONTHS, 1);

  // The month being planned is left out on purpose: half a month of spending
  // would suggest half a ceiling.
  const months = Array.from({ length: lookback }, (_unused, index) =>
    addMonthsToKey(input.month, -(index + 1)),
  );
  const window = new Set<MonthKey>(months);

  // The same rule the day-to-day ledger uses, so "what counts as spending"
  // is defined once: no transfers, no statement payments, no loan proceeds.
  const entries = buildDailyEntries({
    transactions: input.transactions,
    cardPurchases: input.cardPurchases,
  }).filter((entry) => entry.direction === "OUT" && window.has(monthKeyOf(entry.competenceDate)));

  const byCategory = new Map<CategoryId, Map<MonthKey, number>>();

  for (const entry of entries) {
    if (!entry.categoryId) continue;
    const perMonth = byCategory.get(entry.categoryId) ?? new Map<MonthKey, number>();
    const monthKey = monthKeyOf(entry.competenceDate);
    perMonth.set(monthKey, (perMonth.get(monthKey) ?? 0) + entry.amount.amount);
    byCategory.set(entry.categoryId, perMonth);
  }

  const lines: SuggestedBudgetLine[] = [];

  for (const [categoryId, perMonth] of byCategory) {
    // Months with nothing spent count as zero: a category bought once a
    // quarter still needs a monthly allowance a third of its size.
    const amounts = months.map((monthKey) => perMonth.get(monthKey) ?? 0);
    const total = amounts.reduce((accumulated, value) => accumulated + value, 0);
    if (total <= 0) continue;

    const average = Math.round(total / months.length);
    const typical = medianOf(amounts);
    const highest = Math.max(...amounts);

    lines.push({
      categoryId,
      suggested: money(roundUpToTen(Math.max(average, typical))),
      average: money(average),
      typical: money(typical),
      highest: money(highest),
      monthsObserved: months.length,
    });
  }

  return lines.sort((a, b) => b.suggested.amount - a.suggested.amount);
}

/** Total of every suggested line. What the plan would allow in a month. */
export function totalSuggested(lines: readonly SuggestedBudgetLine[]): Money {
  return sum(lines.map((line) => line.suggested));
}

function medianOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

/** A ceiling of R$ 483,17 reads like a calculation, not a decision. */
function roundUpToTen(cents: number): number {
  return Math.ceil(cents / 1000) * 1000;
}
