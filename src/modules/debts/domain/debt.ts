import {
  type CalendarDate,
  addMonths,
  isOnOrBefore,
  monthKeyOf,
  type MonthKey,
} from "@/core/date/calendar-date";
import {
  type Money,
  add,
  clampToZero,
  isPositive,
  money,
  multiply,
  subtract,
  sum,
  zero,
} from "@/core/money/money";
import type {
  AuditFields,
  DebtId,
  HouseholdId,
  MemberId,
  VehicleId,
  Visibility,
} from "@/modules/shared/domain/common";

/**
 * Loans, financings and negotiated debts.
 *
 * Taking on debt is not income and repaying it is not, in full, consumption.
 * This module keeps the three quantities apart: how much cash moves, how much
 * the household actually owes, and how much of the payment is genuinely a cost.
 */

export type DebtKind =
  | "PERSONAL_LOAN"
  | "PAYROLL_LOAN"
  | "VEHICLE_FINANCING"
  | "REAL_ESTATE_FINANCING"
  | "EQUIPMENT_FINANCING"
  | "OVERDRAFT"
  | "CARD_RENEGOTIATION"
  | "OTHER";

export type DebtStatus = "ACTIVE" | "SETTLED" | "RENEGOTIATED" | "IN_DEFAULT";

/**
 * How installments are computed.
 *
 * PRICE keeps the installment constant. SAC keeps amortisation constant, so
 * installments fall over time - common for Brazilian real-estate financing.
 * SIMPLE is for when the lender only told the household "48 x R$ 830,00": the
 * schedule is honest about not knowing the split.
 */
export type AmortisationSystem = "PRICE" | "SAC" | "SIMPLE";

export interface Debt extends AuditFields {
  readonly id: DebtId;
  readonly householdId: HouseholdId;
  readonly kind: DebtKind;
  readonly description: string;
  readonly institution?: string;

  /** Contracted amount, before fees are deducted. */
  readonly principalContracted: Money;
  /** What actually landed in the account. Often lower than the contracted amount. */
  readonly amountDisbursed: Money;
  readonly disbursementDate: CalendarDate;

  readonly amortisationSystem: AmortisationSystem;
  /** Monthly interest rate as a percentage, e.g. 1.99 for 1.99% a month. */
  readonly interestRateMonthly?: number;
  /** Custo Efetivo Total, annual percentage, when the contract states it. */
  readonly cetAnnual?: number;

  readonly installmentCount: number;
  /** Fixed installment amount, for PRICE and SIMPLE. */
  readonly installmentAmount?: Money;
  readonly firstDueDate: CalendarDate;

  /** Recurring per-installment charges, when the contract separates them. */
  readonly monthlyFees?: Money;
  readonly monthlyInsurance?: Money;

  readonly status: DebtStatus;
  readonly visibility: Visibility;
  readonly responsibleMemberId?: MemberId;
  readonly vehicleId?: VehicleId;
  readonly notes?: string;
}

export interface ScheduledInstallment {
  readonly debtId: DebtId;
  readonly number: number;
  readonly of: number;
  readonly dueDate: CalendarDate;
  readonly competenceMonth: MonthKey;
  readonly total: Money;
  readonly principal: Money;
  readonly interest: Money;
  readonly fees: Money;
  readonly insurance: Money;
  /** Principal still owed after this installment is paid. */
  readonly outstandingAfter: Money;
  /** False when the split is an assumption rather than contract data. */
  readonly breakdownKnown: boolean;
}

/**
 * Builds the full repayment schedule.
 *
 * With a known rate the split between amortisation and interest is computed;
 * without one, the whole installment is reported as principal and
 * `breakdownKnown` is false so the UI can say so plainly instead of inventing
 * an interest figure.
 */
export function buildSchedule(debt: Debt): ScheduledInstallment[] {
  const currency = debt.principalContracted.currency;
  const fees = debt.monthlyFees ?? zero(currency);
  const insurance = debt.monthlyInsurance ?? zero(currency);
  const rate = (debt.interestRateMonthly ?? 0) / 100;
  const hasRate = rate > 0;

  const schedule: ScheduledInstallment[] = [];
  let outstanding = debt.principalContracted;

  const fixedInstallment =
    debt.installmentAmount ??
    (hasRate
      ? priceInstallment(debt.principalContracted, rate, debt.installmentCount)
      : divideEvenly(debt.principalContracted, debt.installmentCount));

  const sacAmortisation = divideEvenly(debt.principalContracted, debt.installmentCount);

  for (let number = 1; number <= debt.installmentCount; number += 1) {
    const dueDate = addMonths(debt.firstDueDate, number - 1);
    const isLast = number === debt.installmentCount;

    let principal: Money;
    let interest: Money;

    if (!hasRate) {
      // No rate known: report the payment honestly as amortisation only.
      principal = isLast ? outstanding : fixedInstallment;
      interest = zero(currency);
    } else if (debt.amortisationSystem === "SAC") {
      interest = multiply(outstanding, rate);
      principal = isLast ? outstanding : sacAmortisation;
    } else {
      interest = multiply(outstanding, rate);
      principal = isLast ? outstanding : clampToZero(subtract(fixedInstallment, interest));
    }

    // Never amortise more than what is left.
    if (principal.amount > outstanding.amount) principal = outstanding;

    const total = sum([principal, interest, fees, insurance], currency);
    outstanding = clampToZero(subtract(outstanding, principal));

    schedule.push({
      debtId: debt.id,
      number,
      of: debt.installmentCount,
      dueDate,
      competenceMonth: monthKeyOf(dueDate),
      total,
      principal,
      interest,
      fees,
      insurance,
      outstandingAfter: outstanding,
      breakdownKnown: hasRate,
    });
  }

  return schedule;
}

/** Tabela Price: the constant installment that amortises `principal` in `n` months. */
export function priceInstallment(principal: Money, monthlyRate: number, months: number): Money {
  if (months <= 0) throw new Error("A debt must have at least one installment.");
  if (monthlyRate <= 0) return divideEvenly(principal, months);
  const factor = monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  return multiply(principal, factor);
}

function divideEvenly(total: Money, parts: number): Money {
  return money(Math.round(total.amount / parts), total.currency);
}

/**
 * How much is still owed.
 *
 * Derived from the schedule and the installments already paid, so it stays
 * correct even when someone records a payment out of order.
 */
export function outstandingPrincipal(debt: Debt, paidInstallmentNumbers: readonly number[]): Money {
  if (debt.status === "SETTLED") return zero(debt.principalContracted.currency);
  const schedule = buildSchedule(debt);
  const paid = new Set(paidInstallmentNumbers);
  return sum(
    schedule.filter((item) => !paid.has(item.number)).map((item) => item.principal),
    debt.principalContracted.currency,
  );
}

/** Installments not yet due as of `today`, in due-date order. */
export function upcomingInstallments(
  debt: Debt,
  today: CalendarDate,
  paidInstallmentNumbers: readonly number[] = [],
): ScheduledInstallment[] {
  const paid = new Set(paidInstallmentNumbers);
  return buildSchedule(debt).filter(
    (item) => !paid.has(item.number) && !isOnOrBefore(item.dueDate, today),
  );
}

export interface DebtSummary {
  readonly totalOutstanding: Money;
  readonly monthlyCommitment: Money;
  readonly remainingInstallments: number;
  readonly totalInterestRemaining: Money;
  readonly activeDebts: number;
}

/**
 * The household's debt picture.
 *
 * `monthlyCommitment` is what the next month demands, which is the number that
 * actually constrains a decision - not the headline outstanding balance.
 */
export function summariseDebts(
  debts: readonly Debt[],
  today: CalendarDate,
  paidByDebt: ReadonlyMap<DebtId, readonly number[]> = new Map(),
): DebtSummary {
  let totalOutstanding = zero();
  let monthlyCommitment = zero();
  let remainingInstallments = 0;
  let totalInterestRemaining = zero();
  let activeDebts = 0;

  const nextMonth = monthKeyOf(addMonths(today, 1));

  for (const debt of debts) {
    if (debt.status === "SETTLED") continue;
    activeDebts += 1;
    const paid = paidByDebt.get(debt.id) ?? [];
    const upcoming = upcomingInstallments(debt, today, paid);

    totalOutstanding = add(totalOutstanding, outstandingPrincipal(debt, paid));
    remainingInstallments += upcoming.length;
    totalInterestRemaining = add(
      totalInterestRemaining,
      sum(upcoming.map((item) => item.interest)),
    );
    monthlyCommitment = add(
      monthlyCommitment,
      sum(upcoming.filter((item) => item.competenceMonth === nextMonth).map((item) => item.total)),
    );
  }

  return {
    totalOutstanding,
    monthlyCommitment,
    remainingInstallments,
    totalInterestRemaining,
    activeDebts,
  };
}

/**
 * The gap between what was contracted and what arrived.
 *
 * Fees deducted at disbursement are a real cost the household paid on day one
 * and should not disappear into the loan balance unnoticed.
 */
export function disbursementCost(debt: Debt): Money {
  const gap = subtract(debt.principalContracted, debt.amountDisbursed);
  return isPositive(gap) ? gap : zero(gap.currency);
}

export const DEBT_KIND_LABELS: Record<DebtKind, string> = {
  PERSONAL_LOAN: "Empréstimo pessoal",
  PAYROLL_LOAN: "Empréstimo consignado",
  VEHICLE_FINANCING: "Financiamento de veículo",
  REAL_ESTATE_FINANCING: "Financiamento imobiliário",
  EQUIPMENT_FINANCING: "Financiamento de equipamento",
  OVERDRAFT: "Cheque especial",
  CARD_RENEGOTIATION: "Renegociação de cartão",
  OTHER: "Outra dívida",
};
