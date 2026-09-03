import { type Money, clampToZero, money, subtract, sum } from "@/core/money/money";
import type { Reserve } from "./reserve";

/**
 * The first R$ 500 to R$ 1.000, before the debt is gone.
 *
 * The instinct is to throw every spare real at the debt and only start saving
 * once it is paid. It fails for a reason that has nothing to do with maths: a
 * household with zero cushion meets one flat tyre and goes straight back to
 * the card, at rotativo rates, undoing months of effort. A small reserve is
 * not an investment - it is what stops the plan from resetting.
 *
 * So this is deliberately a *step*, not a goal: half a month of expenses,
 * floored and capped, so it stays reachable for someone who is already
 * stretched. The full emergency fund comes later, after the debt.
 */

/** Small enough to be reachable while still paying debts. */
export const STARTER_RESERVE_FLOOR = 500_00;
/** Big enough to absorb the ordinary emergency that would reach for a card. */
export const STARTER_RESERVE_CEILING = 1_000_00;

/**
 * How much this household's first step is.
 *
 * Half a month of committed expenses, clamped. A household spending R$ 8.000 a
 * month is not asked for R$ 4.000 before it may start; one spending R$ 600 is
 * still asked for R$ 500, because a smaller cushion absorbs nothing.
 */
export function starterReserveTarget(monthlyExpenses: Money): Money {
  const half = Math.round(monthlyExpenses.amount / 2);
  const clamped = Math.min(Math.max(half, STARTER_RESERVE_FLOOR), STARTER_RESERVE_CEILING);
  return money(clamped, monthlyExpenses.currency);
}

export interface StarterReserveStatus {
  readonly target: Money;
  /** What is already put aside for emergencies. */
  readonly current: Money;
  readonly missing: Money;
  readonly isComplete: boolean;
  /** 0 to 1. */
  readonly ratio: number;
  /** Whether the household has an emergency reserve at all. */
  readonly hasEmergencyReserve: boolean;
}

/**
 * Where the household stands on that first step.
 *
 * Only reserves marked as emergency count. A travel fund is real money, but it
 * is money with a job: spending it on a car repair cancels the trip, and the
 * app should not quietly tell someone they are protected when they are not.
 */
export function starterReserveStatus(
  reserves: readonly Reserve[],
  monthlyExpenses: Money,
): StarterReserveStatus {
  const emergency = reserves.filter(
    (reserve) => !reserve.archived && reserve.purpose === "EMERGENCY",
  );
  const current = sum(
    emergency.map((reserve) => reserve.currentAmount),
    monthlyExpenses.currency,
  );
  const target = starterReserveTarget(monthlyExpenses);
  const missing = clampToZero(subtract(target, current));

  return {
    target,
    current,
    missing,
    isComplete: missing.amount === 0,
    ratio: target.amount === 0 ? 1 : Math.min(1, current.amount / target.amount),
    hasEmergencyReserve: emergency.length > 0,
  };
}

/**
 * How many months of putting `monthlyCapacity` aside completes the step.
 *
 * Returns null when nothing is left over each month: the honest answer there
 * is "not from the surplus", not a number of months that assumes money the
 * household does not have.
 */
export function monthsToStarterReserve(
  status: StarterReserveStatus,
  monthlyCapacity: Money,
): number | null {
  if (status.isComplete) return 0;
  if (monthlyCapacity.amount <= 0) return null;
  return Math.ceil(status.missing.amount / monthlyCapacity.amount);
}
