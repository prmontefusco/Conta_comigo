import { type CalendarDate, type MonthKey, monthKeyOf } from "@/core/date/calendar-date";
import { type Money, subtract, sum, zero } from "@/core/money/money";
import type { CardPurchase } from "@/modules/cards/domain/credit-card";
import type {
  AccountId,
  CategoryId,
  CreditCardId,
  MemberId,
  Visibility,
} from "@/modules/shared/domain/common";
import type { Transaction } from "@/modules/transactions/domain/transaction";

/**
 * The day-to-day ledger: the market, the fuel, the parking, the salary that
 * landed on Friday.
 *
 * Two record types answer this question and they are stored differently on
 * purpose - a card purchase is consumption now and cash later, a transaction
 * is both at once - so the ledger is built here rather than by asking the UI
 * to merge two lists and hope the totals agree.
 *
 * What is deliberately absent: transfers, statement payments, loan proceeds
 * and the principal part of a debt payment. None of them makes the household
 * poorer, and putting them in a spending list is exactly how an app ends up
 * telling someone they spent the same money twice (docs/DOMAIN.md).
 */

export type DailyEntryKind = "EXPENSE" | "INCOME" | "CARD_PURCHASE";

export interface DailyEntry {
  readonly id: string;
  readonly kind: DailyEntryKind;
  readonly direction: "IN" | "OUT";
  /** The day it happened. */
  readonly date: CalendarDate;
  /** The month it belongs to. Drives every total below. */
  readonly competenceDate: CalendarDate;
  readonly description: string;
  /** Always positive; direction says which way it went. */
  readonly amount: Money;
  readonly categoryId?: CategoryId;
  readonly accountId?: AccountId;
  readonly creditCardId?: CreditCardId;
  readonly installmentCount?: number;
  readonly responsibleMemberId?: MemberId;
  readonly visibility: Visibility;
  /** True when the money has not left an account yet - a card purchase. */
  readonly paidLater: boolean;
}

export interface BuildDailyEntriesInput {
  readonly transactions: readonly Transaction[];
  readonly cardPurchases: readonly CardPurchase[];
}

/** Every day-to-day movement, most recent first. */
export function buildDailyEntries(input: BuildDailyEntriesInput): DailyEntry[] {
  const entries: DailyEntry[] = [];

  for (const transaction of input.transactions) {
    if (transaction.kind !== "EXPENSE" && transaction.kind !== "INCOME") continue;

    entries.push({
      id: transaction.id,
      kind: transaction.kind,
      direction: transaction.kind === "INCOME" ? "IN" : "OUT",
      date: transaction.transactionDate,
      competenceDate: transaction.competenceDate,
      description: transaction.description,
      amount: transaction.amount,
      ...(transaction.categoryId ? { categoryId: transaction.categoryId } : {}),
      accountId: transaction.accountId,
      ...(transaction.responsibleMemberId
        ? { responsibleMemberId: transaction.responsibleMemberId }
        : {}),
      visibility: transaction.visibility,
      paidLater: false,
    });
  }

  for (const purchase of input.cardPurchases) {
    // A refunded purchase never became consumption.
    if (purchase.refunded) continue;

    entries.push({
      id: purchase.id,
      kind: "CARD_PURCHASE",
      direction: "OUT",
      date: purchase.purchaseDate,
      competenceDate: purchase.competenceDate,
      description: purchase.description,
      amount: purchase.totalAmount,
      categoryId: purchase.categoryId,
      creditCardId: purchase.creditCardId,
      installmentCount: purchase.installmentCount,
      ...(purchase.responsibleMemberId
        ? { responsibleMemberId: purchase.responsibleMemberId }
        : {}),
      visibility: purchase.visibility,
      paidLater: true,
    });
  }

  return entries.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

/**
 * The entries that belong to a month.
 *
 * By competence, not by the day cash moved: a market run put on the card on
 * the 30th belongs to that month even though the fatura is paid in the next
 * one.
 */
export function entriesInMonth(entries: readonly DailyEntry[], month: MonthKey): DailyEntry[] {
  return entries.filter((entry) => monthKeyOf(entry.competenceDate) === month);
}

export interface DayGroup {
  readonly date: CalendarDate;
  readonly entries: readonly DailyEntry[];
  readonly spent: Money;
  readonly received: Money;
}

/** Entries grouped by the day they happened, most recent day first. */
export function groupByDay(entries: readonly DailyEntry[]): DayGroup[] {
  const byDate = new Map<CalendarDate, DailyEntry[]>();

  for (const entry of entries) {
    const bucket = byDate.get(entry.date);
    if (bucket) bucket.push(entry);
    else byDate.set(entry.date, [entry]);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, dayEntries]) => ({
      date,
      entries: dayEntries,
      spent: totalOf(dayEntries, "OUT"),
      received: totalOf(dayEntries, "IN"),
    }));
}

export interface DailyTotals {
  readonly received: Money;
  readonly spent: Money;
  /** Received minus spent. Negative means the month consumed more than it earned. */
  readonly net: Money;
  /** Of everything spent, how much went on a card and is owed on a fatura. */
  readonly onCard: Money;
  readonly fromAccounts: Money;
}

export function dailyTotals(entries: readonly DailyEntry[]): DailyTotals {
  const received = totalOf(entries, "IN");
  const spent = totalOf(entries, "OUT");
  const onCard = sum(
    entries.filter((entry) => entry.direction === "OUT" && entry.paidLater).map((e) => e.amount),
  );

  return {
    received,
    spent,
    net: subtract(received, spent),
    onCard,
    fromAccounts: subtract(spent, onCard),
  };
}

export interface CategoryTotal {
  readonly categoryId: CategoryId | undefined;
  readonly total: Money;
  readonly entryCount: number;
}

/** Where the money went, biggest first. Only outflows. */
export function spendingByCategory(entries: readonly DailyEntry[]): CategoryTotal[] {
  const byCategory = new Map<CategoryId | undefined, DailyEntry[]>();

  for (const entry of entries) {
    if (entry.direction !== "OUT") continue;
    const bucket = byCategory.get(entry.categoryId);
    if (bucket) bucket.push(entry);
    else byCategory.set(entry.categoryId, [entry]);
  }

  return [...byCategory.entries()]
    .map(([categoryId, items]) => ({
      categoryId,
      total: sum(items.map((item) => item.amount)),
      entryCount: items.length,
    }))
    .sort((a, b) => b.total.amount - a.total.amount);
}

export interface MemberTotal {
  /** Undefined means the entry was recorded as the group's, not one person's. */
  readonly memberId: MemberId | undefined;
  readonly spent: Money;
  readonly received: Money;
}

/**
 * What each person put in and took out.
 *
 * Attribution is never inferred: an entry belongs to whoever was recorded as
 * responsible, and everything else is the group's. Guessing here would invent
 * an argument about who spent what.
 */
export function totalsByMember(entries: readonly DailyEntry[]): MemberTotal[] {
  const byMember = new Map<MemberId | undefined, DailyEntry[]>();

  for (const entry of entries) {
    const bucket = byMember.get(entry.responsibleMemberId);
    if (bucket) bucket.push(entry);
    else byMember.set(entry.responsibleMemberId, [entry]);
  }

  return [...byMember.entries()]
    .map(([memberId, items]) => ({
      memberId,
      spent: totalOf(items, "OUT"),
      received: totalOf(items, "IN"),
    }))
    .sort((a, b) => b.spent.amount - a.spent.amount);
}

function totalOf(entries: readonly DailyEntry[], direction: "IN" | "OUT"): Money {
  const relevant = entries.filter((entry) => entry.direction === direction);
  return relevant.length === 0 ? zero() : sum(relevant.map((entry) => entry.amount));
}
