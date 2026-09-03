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

/* ------------------------------------------------------------------ */
/* What the money actually costs                                       */
/* ------------------------------------------------------------------ */

export type RateSource =
  /** The monthly rate written in the contract. */
  | "CONTRACT"
  /** Derived from the CET the contract states. */
  | "CET"
  /** Solved from principal, installment and term. Close, never exact. */
  | "IMPLIED"
  /** Nothing to go on. Reported as unknown, never guessed. */
  | "UNKNOWN";

export interface EffectiveRate {
  /** Monthly percentage, e.g. 1.99. Zero when the source is UNKNOWN. */
  readonly monthly: number;
  readonly source: RateSource;
}

/**
 * The monthly rate to use when comparing this debt with others.
 *
 * Four sources in order of authority, and the source travels with the number
 * so a screen can say "taxa estimada" instead of presenting a solved rate as
 * if the bank had stated it. What this deliberately does not do is invent an
 * average when nothing is known: an ordering built on a made-up rate would
 * send someone to attack the wrong debt first.
 */
export function effectiveMonthlyRate(debt: Debt): EffectiveRate {
  if (debt.interestRateMonthly && debt.interestRateMonthly > 0) {
    return { monthly: debt.interestRateMonthly, source: "CONTRACT" };
  }

  if (debt.cetAnnual && debt.cetAnnual > 0) {
    return { monthly: monthlyFromAnnual(debt.cetAnnual), source: "CET" };
  }

  const implied = impliedMonthlyRate(
    debt.principalContracted,
    debt.installmentAmount,
    debt.installmentCount,
  );
  if (implied !== null) return { monthly: implied, source: "IMPLIED" };

  return { monthly: 0, source: "UNKNOWN" };
}

/** The monthly rate equivalent to an annual one, compounded. */
export function monthlyFromAnnual(annualPercent: number): number {
  return (Math.pow(1 + annualPercent / 100, 1 / 12) - 1) * 100;
}

/**
 * The rate hidden in "48 x R$ 830,00".
 *
 * Most people know the installment and the term and have never been told the
 * rate. Solving the Price equation for it turns that into a comparable number
 * - which is the whole point of the Avalanche method, and impossible without
 * it.
 *
 * Bisection rather than Newton: the function is monotonic in the range that
 * matters, and bisection cannot diverge on a badly typed input. Returns null
 * when the numbers cannot describe a loan at all (nothing paid in interest, or
 * instalments that do not even cover the principal).
 */
export function impliedMonthlyRate(
  principal: Money,
  installment: Money | undefined,
  months: number,
): number | null {
  if (!installment || months <= 0) return null;
  if (principal.amount <= 0 || installment.amount <= 0) return null;

  const total = installment.amount * months;
  // Paying back no more than what was taken: no interest to find.
  if (total <= principal.amount) return null;
  // A single instalment is not a rate anyone can compare; it is a fee.
  if (months === 1) return null;

  const presentValue = (rate: number): number =>
    installment.amount * ((1 - Math.pow(1 + rate, -months)) / rate);

  let low = 0.000001; // 0.0001% a month
  let high = 1; // 100% a month, well past any consumer contract

  // No rate in range reproduces this instalment: refuse rather than clamp.
  if (presentValue(high) > principal.amount) return null;

  for (let step = 0; step < 80; step += 1) {
    const middle = (low + high) / 2;
    if (presentValue(middle) > principal.amount) low = middle;
    else high = middle;
  }

  const rate = ((low + high) / 2) * 100;
  return Number.isFinite(rate) && rate > 0.01 ? Number(rate.toFixed(4)) : null;
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
