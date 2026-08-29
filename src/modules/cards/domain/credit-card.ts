import {
  type CalendarDate,
  type MonthKey,
  addMonthsToKey,
  dayInMonth,
  monthKeyOf,
} from "@/core/date/calendar-date";
import { type Money, allocate, clampToZero, subtract, sum, zero } from "@/core/money/money";
import type {
  AuditFields,
  CardPurchaseId,
  CardStatementId,
  CategoryId,
  CreditCardId,
  HouseholdId,
  MemberId,
  TransactionId,
  VehicleId,
  Visibility,
} from "@/modules/shared/domain/common";
import { deterministicId } from "@/core/id/id";

/**
 * Credit cards, purchases, installments and statements.
 *
 * The rule this module exists to protect: a purchase is counted once, as
 * consumption, on the day it happens. Paying the statement later is a cash
 * movement, not a second expense. See docs/DOMAIN.md, "Spending view vs
 * cash-flow view".
 */

export interface CreditCard extends AuditFields {
  readonly id: CreditCardId;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly issuer?: string;
  readonly brand?: string;
  readonly lastFourDigits?: string;
  readonly holderMemberId?: MemberId;
  readonly creditLimit: Money;
  /** Day of month the statement closes. Clamped in short months. */
  readonly closingDay: number;
  /** Day of month the statement is due. */
  readonly dueDay: number;
  readonly visibility: Visibility;
  /** Additional cards share the limit and the statement of their parent. */
  readonly parentCardId?: CreditCardId;
  readonly archived: boolean;
  readonly color?: string;
}

export interface CardPurchase extends AuditFields {
  readonly id: CardPurchaseId;
  readonly householdId: HouseholdId;
  readonly creditCardId: CreditCardId;
  readonly description: string;
  readonly merchant?: string;
  /** Full price of the purchase, regardless of how many installments it has. */
  readonly totalAmount: Money;
  readonly purchaseDate: CalendarDate;
  /**
   * Which month the *consumption* belongs to.
   *
   * Defaults to the purchase date. A household may prefer to attribute a
   * purchase to the statement month instead; that choice is a household
   * setting, applied when the purchase is created, and stored here explicitly
   * so past records never change meaning when the setting changes.
   */
  readonly competenceDate: CalendarDate;
  readonly categoryId: CategoryId;
  readonly installmentCount: number;
  readonly visibility: Visibility;
  readonly responsibleMemberId?: MemberId;
  readonly vehicleId?: VehicleId;
  readonly refunded?: boolean;
  readonly notes?: string;
}

/**
 * One installment of a purchase.
 *
 * Derived, never stored: recomputing from the purchase is cheap and removes
 * any chance of the parts drifting away from the whole.
 */
export interface CardInstallment {
  readonly purchaseId: CardPurchaseId;
  readonly creditCardId: CreditCardId;
  readonly number: number;
  readonly of: number;
  readonly amount: Money;
  readonly statementMonth: MonthKey;
  readonly dueDate: CalendarDate;
  readonly description: string;
  readonly categoryId: CategoryId;
  readonly visibility: Visibility;
  readonly responsibleMemberId?: MemberId;
}

export type CardStatementStatus = "OPEN" | "CLOSED" | "PARTIALLY_PAID" | "PAID";

/**
 * A statement (fatura).
 *
 * Also derived. The only persisted facts are the purchases and the payment
 * transactions; the statement is the deterministic function of the two, so it
 * can never be stale and needs no scheduled job to close it.
 */
export interface CardStatement {
  readonly id: CardStatementId;
  readonly creditCardId: CreditCardId;
  readonly referenceMonth: MonthKey;
  readonly closingDate: CalendarDate;
  readonly dueDate: CalendarDate;
  readonly installments: readonly CardInstallment[];
  readonly total: Money;
  readonly paidAmount: Money;
  readonly remainingAmount: Money;
  readonly status: CardStatementStatus;
  readonly paymentTransactionIds: readonly TransactionId[];
}

/* ------------------------------------------------------------------ */
/* Statement calendar                                                  */
/* ------------------------------------------------------------------ */

export function statementId(creditCardId: CreditCardId, month: MonthKey): CardStatementId {
  return deterministicId(creditCardId, month);
}

export function closingDateFor(card: CreditCard, month: MonthKey): CalendarDate {
  return dayInMonth(month, card.closingDay);
}

/**
 * Due date of the statement that closes in `month`.
 *
 * When the due day falls on or before the closing day - the common Brazilian
 * setup of "closes on the 25th, due on the 5th" - the payment lands in the
 * following month.
 */
export function dueDateFor(card: CreditCard, month: MonthKey): CalendarDate {
  const dueMonth = card.dueDay <= card.closingDay ? addMonthsToKey(month, 1) : month;
  return dayInMonth(dueMonth, card.dueDay);
}

/**
 * Which statement a purchase lands in.
 *
 * A purchase made exactly on the closing day belongs to that statement; one
 * made the day after belongs to the next. This matches how issuers describe
 * the cutoff and, more importantly, is stated explicitly rather than left to
 * an off-by-one.
 */
export function statementMonthForPurchase(card: CreditCard, purchaseDate: CalendarDate): MonthKey {
  const candidate = monthKeyOf(purchaseDate);
  // Strictly after the closing date rolls into the next statement.
  return purchaseDate > closingDateFor(card, candidate) ? addMonthsToKey(candidate, 1) : candidate;
}

/* ------------------------------------------------------------------ */
/* Installments                                                        */
/* ------------------------------------------------------------------ */

/**
 * Expands a purchase into its installments.
 *
 * The parts always sum back to the exact total (see Money.allocate), and the
 * first installment absorbs any remainder, matching issuer behaviour.
 */
export function buildInstallments(purchase: CardPurchase, card: CreditCard): CardInstallment[] {
  if (purchase.installmentCount < 1) {
    throw new Error(
      `Purchase ${purchase.id} has ${purchase.installmentCount} installments; expected at least 1.`,
    );
  }
  if (purchase.refunded) return [];

  const firstStatement = statementMonthForPurchase(card, purchase.purchaseDate);
  const parts = allocate(purchase.totalAmount, purchase.installmentCount);

  return parts.map((amount, index) => {
    const statementMonth = addMonthsToKey(firstStatement, index);
    return {
      purchaseId: purchase.id,
      creditCardId: purchase.creditCardId,
      number: index + 1,
      of: purchase.installmentCount,
      amount,
      statementMonth,
      dueDate: dueDateFor(card, statementMonth),
      description:
        purchase.installmentCount > 1
          ? `${purchase.description} (${index + 1}/${purchase.installmentCount})`
          : purchase.description,
      categoryId: purchase.categoryId,
      visibility: purchase.visibility,
      ...(purchase.responsibleMemberId
        ? { responsibleMemberId: purchase.responsibleMemberId }
        : {}),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Statements                                                          */
/* ------------------------------------------------------------------ */

export interface StatementPayment {
  readonly transactionId: TransactionId;
  readonly statementId: CardStatementId;
  readonly amount: Money;
}

/**
 * Builds every statement a card has between two months.
 *
 * Deriving statements rather than storing them means a purchase entered late,
 * or corrected, immediately lands in the right fatura with no reconciliation
 * step (docs/adr/0007-derived-card-statements.md).
 */
export function projectStatements(
  card: CreditCard,
  purchases: readonly CardPurchase[],
  payments: readonly StatementPayment[],
  fromMonth: MonthKey,
  toMonth: MonthKey,
  today: CalendarDate,
): CardStatement[] {
  const installments = purchases
    .filter((purchase) => purchase.creditCardId === card.id)
    .flatMap((purchase) => buildInstallments(purchase, card));

  const byMonth = new Map<MonthKey, CardInstallment[]>();
  for (const installment of installments) {
    const bucket = byMonth.get(installment.statementMonth);
    if (bucket) bucket.push(installment);
    else byMonth.set(installment.statementMonth, [installment]);
  }

  const paymentsByStatement = new Map<CardStatementId, StatementPayment[]>();
  for (const payment of payments) {
    const bucket = paymentsByStatement.get(payment.statementId);
    if (bucket) bucket.push(payment);
    else paymentsByStatement.set(payment.statementId, [payment]);
  }

  const statements: CardStatement[] = [];
  let month = fromMonth;
  while (month <= toMonth) {
    const monthInstallments = byMonth.get(month) ?? [];
    const id = statementId(card.id, month);
    const statementPayments = paymentsByStatement.get(id) ?? [];

    // A month with no activity and no payment is not a statement worth showing.
    if (monthInstallments.length > 0 || statementPayments.length > 0) {
      const total = sum(monthInstallments.map((installment) => installment.amount));
      const paidAmount = sum(statementPayments.map((payment) => payment.amount));
      const remaining = clampToZero(subtract(total, paidAmount));
      const closingDate = closingDateFor(card, month);

      statements.push({
        id,
        creditCardId: card.id,
        referenceMonth: month,
        closingDate,
        dueDate: dueDateFor(card, month),
        installments: monthInstallments,
        total,
        paidAmount,
        remainingAmount: remaining,
        status: statementStatus(total, paidAmount, closingDate, today),
        paymentTransactionIds: statementPayments.map((payment) => payment.transactionId),
      });
    }

    month = addMonthsToKey(month, 1);
  }

  return statements;
}

function statementStatus(
  total: Money,
  paid: Money,
  closingDate: CalendarDate,
  today: CalendarDate,
): CardStatementStatus {
  if (paid.amount >= total.amount && total.amount > 0) return "PAID";
  if (paid.amount > 0) return "PARTIALLY_PAID";
  return today > closingDate ? "CLOSED" : "OPEN";
}

/* ------------------------------------------------------------------ */
/* Limit                                                               */
/* ------------------------------------------------------------------ */

export interface CardLimitStatus {
  readonly creditLimit: Money;
  /** Everything already committed: unpaid statements plus future installments. */
  readonly committed: Money;
  readonly available: Money;
  /**
   * Fraction of the limit committed. Deliberately *not* capped at 1.
   *
   * A card at 110% is a materially different situation from one at exactly
   * 100%, and rounding it down would hide that. Progress bars clamp for
   * display; the number itself tells the truth.
   */
  readonly utilisation: number;
  readonly isOverLimit: boolean;
}

/**
 * How much of the limit is actually free.
 *
 * Future installments of an already-made purchase count as committed even
 * though their statement has not closed: the money is spoken for, and telling
 * someone otherwise is exactly the mistake this product exists to prevent.
 */
export function computeLimitStatus(
  card: CreditCard,
  statements: readonly CardStatement[],
): CardLimitStatus {
  const committed = sum(
    statements.map((statement) => statement.remainingAmount),
    card.creditLimit.currency,
  );
  const available = clampToZero(subtract(card.creditLimit, committed));
  const utilisation =
    card.creditLimit.amount === 0 ? 0 : committed.amount / card.creditLimit.amount;

  return {
    creditLimit: card.creditLimit,
    committed,
    available,
    utilisation,
    isOverLimit: committed.amount > card.creditLimit.amount,
  };
}

/**
 * Statements split by where they stand relative to today.
 *
 * Kept in the domain because "which fatura is the next one" is a question
 * every card screen asks, and answering it with `[0]` of a sorted list quietly
 * calls an overdue statement "the next one".
 */
export function splitStatements(
  statements: readonly CardStatement[],
  today: CalendarDate,
): {
  overdue: CardStatement[];
  upcoming: CardStatement[];
  settled: CardStatement[];
  next: CardStatement | undefined;
} {
  const open = statements.filter((statement) => statement.remainingAmount.amount > 0);
  const byDueDate = (a: CardStatement, b: CardStatement) => (a.dueDate < b.dueDate ? -1 : 1);

  const overdue = open.filter((statement) => statement.dueDate < today).sort(byDueDate);
  const upcoming = open.filter((statement) => statement.dueDate >= today).sort(byDueDate);
  const settled = statements
    .filter((statement) => statement.remainingAmount.amount <= 0)
    .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));

  return { overdue, upcoming, settled, next: upcoming[0] };
}

/** Total still owed across every card. Part of the household's debt picture. */
export function totalCardDebt(statements: readonly CardStatement[]): Money {
  return sum(statements.map((statement) => statement.remainingAmount));
}

/** Installments that have not reached a statement yet, per month. */
export function futureCommitmentsByMonth(
  statements: readonly CardStatement[],
  fromMonth: MonthKey,
): Map<MonthKey, Money> {
  const result = new Map<MonthKey, Money>();
  for (const statement of statements) {
    if (statement.referenceMonth < fromMonth) continue;
    result.set(
      statement.referenceMonth,
      sum([result.get(statement.referenceMonth) ?? zero(), statement.remainingAmount]),
    );
  }
  return result;
}
