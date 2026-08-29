import type { CalendarDate, Instant } from "@/core/date/calendar-date";
import { isBefore } from "@/core/date/calendar-date";
import {
  type Money,
  add,
  clampToZero,
  greaterOrEqual,
  isPositive,
  subtract,
  zero,
} from "@/core/money/money";
import type {
  AccountId,
  AuditFields,
  CardStatementId,
  CategoryId,
  Confidence,
  CreditCardId,
  DebtId,
  ExpenseNature,
  FlowDirection,
  HouseholdId,
  MemberId,
  ObligationId,
  RecurringRuleId,
  TransactionId,
  VehicleId,
  Visibility,
} from "@/modules/shared/domain/common";

/**
 * An Obligation is money that is expected to move but has not moved yet.
 *
 * Payables and receivables share one shape because the forecast engine needs a
 * single ordered stream of future cash events; the direction is a field, not a
 * separate collection (see docs/adr/0006-single-obligation-stream.md).
 *
 * An Obligation is never itself a balance change. It becomes one only when a
 * Transaction settles it, and the link between the two is what prevents the
 * same money being counted twice.
 */

export type ObligationOrigin =
  /** Typed in by a person. */
  | "MANUAL"
  /** Materialised from a recurring rule. */
  | "RECURRING_RULE"
  /** The payment of a credit card statement. */
  | "CARD_STATEMENT"
  /** One installment of a loan or financing schedule. */
  | "DEBT_SCHEDULE"
  /** One installment of a non-card payment plan (a negotiated debt, a boleto plan). */
  | "INSTALLMENT_PLAN"
  /** Created by a what-if simulation. Never persisted. */
  | "SIMULATED";

export type ObligationStatus = "SCHEDULED" | "PARTIALLY_SETTLED" | "SETTLED" | "CANCELED";

/**
 * Where an obligation came from.
 *
 * `occurrenceKey` makes materialisation idempotent: the same rule occurrence
 * can never produce two obligations, which is what would otherwise double a
 * projected bill (docs/FORECAST_ENGINE.md).
 */
export interface ObligationSource {
  readonly recurringRuleId?: RecurringRuleId;
  readonly cardStatementId?: CardStatementId;
  readonly creditCardId?: CreditCardId;
  readonly debtId?: DebtId;
  readonly occurrenceKey?: string;
  /** 1-based position within an installment plan. */
  readonly installmentNumber?: number;
  readonly installmentCount?: number;
}

export interface Obligation extends AuditFields {
  readonly id: ObligationId;
  readonly householdId: HouseholdId;
  readonly direction: FlowDirection;
  readonly origin: ObligationOrigin;
  readonly source?: ObligationSource;

  readonly description: string;
  readonly amount: Money;
  /** When it is owed or expected. */
  readonly dueDate: CalendarDate;
  /** Which month it belongs to economically. Often differs from dueDate. */
  readonly competenceDate: CalendarDate;

  readonly categoryId?: CategoryId;
  /** Which account it is expected to be paid from or into. */
  readonly expectedAccountId?: AccountId;
  readonly expenseNature: ExpenseNature;
  readonly confidence: Confidence;
  readonly visibility: Visibility;
  readonly responsibleMemberId?: MemberId;
  readonly vehicleId?: VehicleId;

  readonly status: ObligationStatus;
  readonly settledAmount: Money;
  readonly settlementTransactionIds: readonly TransactionId[];
  readonly settledAt?: Instant;

  readonly notes?: string;
}

/**
 * Status as a person experiences it, including the derived OVERDUE state.
 *
 * OVERDUE is never stored. A stored flag would go stale overnight and would
 * have to be recomputed by a scheduled job; deriving it from `today` is always
 * correct and costs nothing.
 */
export type ObligationDisplayStatus = ObligationStatus | "OVERDUE";

export function displayStatus(
  obligation: Obligation,
  today: CalendarDate,
): ObligationDisplayStatus {
  if (obligation.status === "SETTLED" || obligation.status === "CANCELED") {
    return obligation.status;
  }
  if (isBefore(obligation.dueDate, today)) return "OVERDUE";
  return obligation.status;
}

/** A bill stays pending until it is actually paid, however late that is. */
export function isOverdue(obligation: Obligation, today: CalendarDate): boolean {
  return displayStatus(obligation, today) === "OVERDUE";
}

export function isOpen(obligation: Obligation): boolean {
  return obligation.status === "SCHEDULED" || obligation.status === "PARTIALLY_SETTLED";
}

/** How much of the obligation is still expected to move. */
export function remainingAmount(obligation: Obligation): Money {
  if (obligation.status === "CANCELED" || obligation.status === "SETTLED") {
    return zero(obligation.amount.currency);
  }
  return clampToZero(subtract(obligation.amount, obligation.settledAmount));
}

/** Signed contribution to a cash-flow projection: negative for a payable. */
export function projectedCashDelta(obligation: Obligation): Money {
  const remaining = remainingAmount(obligation);
  if (obligation.direction === "INFLOW") return remaining;
  return { amount: -remaining.amount, currency: remaining.currency };
}

export interface SettlementInput {
  readonly transactionId: TransactionId;
  readonly amount: Money;
  readonly at: Instant;
}

/**
 * Applies a payment or receipt to an obligation.
 *
 * Partial settlement is a first-class state: people negotiate, pay part of a
 * bill, or receive a smaller amount than expected, and the remainder must stay
 * visible in the forecast rather than disappearing.
 */
export function settle(obligation: Obligation, settlement: SettlementInput): Obligation {
  if (obligation.status === "CANCELED") {
    throw new Error(`Cannot settle a canceled obligation (${obligation.id}).`);
  }
  if (!isPositive(settlement.amount)) {
    throw new Error("Settlement amount must be positive.");
  }

  const settledAmount = add(obligation.settledAmount, settlement.amount);
  const fullySettled = greaterOrEqual(settledAmount, obligation.amount);

  return {
    ...obligation,
    settledAmount,
    status: fullySettled ? "SETTLED" : "PARTIALLY_SETTLED",
    settlementTransactionIds: [...obligation.settlementTransactionIds, settlement.transactionId],
    ...(fullySettled ? { settledAt: settlement.at } : {}),
    updatedAt: settlement.at,
  };
}

/** Reverses a settlement, e.g. when a payment is deleted or corrected. */
export function unsettle(
  obligation: Obligation,
  transactionId: TransactionId,
  amount: Money,
  at: Instant,
): Obligation {
  const settledAmount = clampToZero(subtract(obligation.settledAmount, amount));
  const remainingIds = obligation.settlementTransactionIds.filter((id) => id !== transactionId);
  const rest = { ...obligation };
  delete (rest as { settledAt?: Instant }).settledAt;

  return {
    ...rest,
    settledAmount,
    status: settledAmount.amount === 0 ? "SCHEDULED" : "PARTIALLY_SETTLED",
    settlementTransactionIds: remainingIds,
    updatedAt: at,
  };
}

export function cancel(obligation: Obligation, at: Instant): Obligation {
  return { ...obligation, status: "CANCELED", updatedAt: at };
}

/* ------------------------------------------------------------------ */
/* Aggregations                                                        */
/* ------------------------------------------------------------------ */

export interface ObligationTotals {
  readonly overdue: Money;
  readonly dueToday: Money;
  readonly upcoming: Money;
  readonly total: Money;
  readonly count: number;
}

export function summarise(
  obligations: readonly Obligation[],
  today: CalendarDate,
  direction: FlowDirection,
): ObligationTotals {
  let overdue = zero();
  let dueToday = zero();
  let upcoming = zero();
  let count = 0;

  for (const obligation of obligations) {
    if (obligation.direction !== direction || !isOpen(obligation)) continue;
    const remaining = remainingAmount(obligation);
    if (!isPositive(remaining)) continue;

    count += 1;
    if (isBefore(obligation.dueDate, today)) {
      overdue = add(overdue, remaining);
    } else if (obligation.dueDate === today) {
      dueToday = add(dueToday, remaining);
    } else {
      upcoming = add(upcoming, remaining);
    }
  }

  return { overdue, dueToday, upcoming, total: add(add(overdue, dueToday), upcoming), count };
}

/** Sorts by urgency: what needs attention first, ties broken by size. */
export function byUrgency(a: Obligation, b: Obligation): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  return b.amount.amount - a.amount.amount;
}
