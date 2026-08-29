import type { CalendarDate } from "@/core/date/calendar-date";
import { type Money, add, clampToZero, subtract, sum, zero } from "@/core/money/money";
import type {
  AccountId,
  AuditFields,
  GoalId,
  HouseholdId,
  ReserveId,
  Visibility,
} from "@/modules/shared/domain/common";

/**
 * Reserves and goals.
 *
 * Moving money into a reserve is not spending it: the household is exactly as
 * wealthy afterwards. What changes is how much of that money is *available to
 * decide about*, which is why the dashboard reports total cash and spendable
 * cash as two different numbers (docs/PRODUCT.md, principle 3.3).
 */

export type ReservePurpose =
  | "EMERGENCY"
  | "TRAVEL"
  | "MAINTENANCE"
  | "TAXES"
  | "HOME"
  | "VEHICLE"
  | "HEALTH"
  | "EDUCATION"
  | "OTHER";

export interface Reserve extends AuditFields {
  readonly id: ReserveId;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly purpose: ReservePurpose;
  readonly currentAmount: Money;
  readonly targetAmount?: Money;
  /** Where the money physically sits, when it is kept apart. */
  readonly accountId?: AccountId;
  /**
   * Protected reserves are excluded from spendable cash.
   *
   * An unprotected reserve is a savings intention the household is happy to
   * dip into; a protected one is money they have decided is not available.
   */
  readonly isProtected: boolean;
  readonly visibility: Visibility;
  readonly linkedGoalId?: GoalId;
  readonly archived: boolean;
  readonly notes?: string;
}

export type GoalStatus = "ACTIVE" | "ACHIEVED" | "PAUSED" | "ABANDONED";

export interface Goal extends AuditFields {
  readonly id: GoalId;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly description?: string;
  readonly targetAmount: Money;
  readonly targetDate?: CalendarDate;
  readonly linkedReserveId?: ReserveId;
  readonly status: GoalStatus;
  readonly visibility: Visibility;
}

/** Total earmarked as untouchable. Subtracted from cash to get spendable cash. */
export function protectedTotal(reserves: readonly Reserve[]): Money {
  return sum(
    reserves
      .filter((reserve) => reserve.isProtected && !reserve.archived)
      .map((reserve) => reserve.currentAmount),
  );
}

/** Everything set aside, protected or not. */
export function reservedTotal(reserves: readonly Reserve[]): Money {
  return sum(
    reserves.filter((reserve) => !reserve.archived).map((reserve) => reserve.currentAmount),
  );
}

export interface ReserveProgress {
  readonly reserve: Reserve;
  readonly current: Money;
  readonly target?: Money;
  readonly missing: Money;
  /** 0 to 1, or null when the reserve has no target. */
  readonly ratio: number | null;
  readonly belowTarget: boolean;
}

export function progressOf(reserve: Reserve): ReserveProgress {
  if (!reserve.targetAmount) {
    return {
      reserve,
      current: reserve.currentAmount,
      missing: zero(reserve.currentAmount.currency),
      ratio: null,
      belowTarget: false,
    };
  }

  const missing = clampToZero(subtract(reserve.targetAmount, reserve.currentAmount));
  const ratio =
    reserve.targetAmount.amount === 0
      ? 1
      : Math.min(reserve.currentAmount.amount / reserve.targetAmount.amount, 1);

  return {
    reserve,
    current: reserve.currentAmount,
    target: reserve.targetAmount,
    missing,
    ratio,
    belowTarget: missing.amount > 0,
  };
}

export interface GoalProgress {
  readonly goal: Goal;
  readonly accumulated: Money;
  readonly missing: Money;
  readonly ratio: number;
  /** Monthly saving needed to reach the goal by its date, when it has one. */
  readonly monthlyContributionNeeded?: Money;
}

export function goalProgress(
  goal: Goal,
  reserves: readonly Reserve[],
  monthsRemaining?: number,
): GoalProgress {
  const linked = reserves.find((reserve) => reserve.id === goal.linkedReserveId);
  const accumulated = linked?.currentAmount ?? zero(goal.targetAmount.currency);
  const missing = clampToZero(subtract(goal.targetAmount, accumulated));
  const ratio =
    goal.targetAmount.amount === 0 ? 1 : Math.min(accumulated.amount / goal.targetAmount.amount, 1);

  const monthlyContributionNeeded =
    monthsRemaining && monthsRemaining > 0
      ? { amount: Math.ceil(missing.amount / monthsRemaining), currency: missing.currency }
      : undefined;

  return {
    goal,
    accumulated,
    missing,
    ratio,
    ...(monthlyContributionNeeded ? { monthlyContributionNeeded } : {}),
  };
}

/**
 * Whether an emergency of a given size is covered.
 *
 * Answers "if something happens, do I have enough?" with a fact rather than a
 * verdict: the shortfall, not a judgement about the household.
 */
export interface EmergencyCoverage {
  readonly available: Money;
  readonly required: Money;
  readonly shortfall: Money;
  readonly covered: boolean;
}

export function emergencyCoverage(
  reserves: readonly Reserve[],
  requiredAmount: Money,
): EmergencyCoverage {
  const available = sum(
    reserves
      .filter((reserve) => !reserve.archived && reserve.purpose === "EMERGENCY")
      .map((reserve) => reserve.currentAmount),
    requiredAmount.currency,
  );
  const shortfall = clampToZero(subtract(requiredAmount, available));
  return { available, required: requiredAmount, shortfall, covered: shortfall.amount === 0 };
}

/** Months of expenses the emergency reserve covers. */
export function monthsOfRunway(reserves: readonly Reserve[], monthlyExpenses: Money): number {
  if (monthlyExpenses.amount <= 0) return Number.POSITIVE_INFINITY;
  const available = sum(
    reserves
      .filter((reserve) => !reserve.archived && reserve.purpose === "EMERGENCY")
      .map((reserve) => reserve.currentAmount),
    monthlyExpenses.currency,
  );
  return available.amount / monthlyExpenses.amount;
}

export function applyContribution(reserve: Reserve, amount: Money): Reserve {
  return { ...reserve, currentAmount: add(reserve.currentAmount, amount) };
}

export function applyWithdrawal(reserve: Reserve, amount: Money): Reserve {
  return { ...reserve, currentAmount: clampToZero(subtract(reserve.currentAmount, amount)) };
}

export const RESERVE_PURPOSE_LABELS: Record<ReservePurpose, string> = {
  EMERGENCY: "Emergência",
  TRAVEL: "Viagem",
  MAINTENANCE: "Manutenção",
  TAXES: "Impostos",
  HOME: "Casa",
  VEHICLE: "Veículo",
  HEALTH: "Saúde",
  EDUCATION: "Educação",
  OTHER: "Outro",
};
