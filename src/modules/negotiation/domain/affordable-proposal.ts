import { type Money, clampToZero, money, multiply, subtract, sum } from "@/core/money/money";
import { impliedMonthlyRate } from "@/modules/debts/domain/debt";

/**
 * What actually fits, before saying yes.
 *
 * Feirões and call centres work on a single question - "quanto você pode pagar
 * por mês?" - and the honest answer is almost never the one said under
 * pressure. This module computes it beforehand, from the household's own
 * numbers, so the conversation starts from a figure that survives the month.
 *
 * Two ceilings, and the lower one wins:
 *
 * 1. **What is left.** Income minus what the household must spend and already
 *    pays in debt. Money that does not exist cannot be promised.
 * 2. **The commitment ratio.** A share of income beyond which repayment stops
 *    being sustainable even when the cash technically exists. Thirty percent
 *    is the usual prudential reference in Brazil - not a law, and stated as a
 *    guideline wherever it is shown.
 *
 * Nothing here decides for anyone. It reports what the numbers say and leaves
 * the decision where it belongs (docs/PRODUCT.md, "this is not advice").
 */

/** Share of net income beyond which debt repayment stops being sustainable. */
export const SUSTAINABLE_COMMITMENT_RATIO = 0.3;

/**
 * How close to the last available real a proposal may go before it is tight.
 *
 * A plan that consumes every centavo of the surplus has no room for a bus
 * fare, and it is the first one to break.
 */
const COMFORT_MARGIN = 0.8;

export interface ProposalCapacityInput {
  /** What actually arrives every month, after taxes and payroll discounts. */
  readonly monthlyIncome: Money;
  /** Housing, food, transport, utilities - what the household must spend. */
  readonly monthlyEssentials: Money;
  /** What already goes out every month servicing debts and card statements. */
  readonly monthlyDebtPayments: Money;
  /** What the household wants to keep putting aside while it repays. */
  readonly monthlySaving?: Money;
}

export interface ProposalCapacity {
  /** Income minus essentials, current debt payments and saving. */
  readonly leftOver: Money;
  /** The ratio ceiling, less what is already committed to debt. */
  readonly ratioCeiling: Money;
  /** The most a new instalment may be. The lower of the two ceilings. */
  readonly maxInstallment: Money;
  /** Share of income already going to debt, 0 to 1+. */
  readonly currentCommitmentRatio: number;
  readonly limitedBy: "CASH" | "RATIO" | "NOTHING_LEFT";
}

export function proposalCapacity(input: ProposalCapacityInput): ProposalCapacity {
  const currency = input.monthlyIncome.currency;
  const saving = input.monthlySaving ?? money(0, currency);

  const leftOver = clampToZero(
    subtract(
      input.monthlyIncome,
      sum([input.monthlyEssentials, input.monthlyDebtPayments, saving], currency),
    ),
  );

  const ratioCeiling = clampToZero(
    subtract(
      multiply(input.monthlyIncome, SUSTAINABLE_COMMITMENT_RATIO),
      input.monthlyDebtPayments,
    ),
  );

  const maxInstallment = money(Math.min(leftOver.amount, ratioCeiling.amount), currency);

  const currentCommitmentRatio =
    input.monthlyIncome.amount === 0
      ? 0
      : input.monthlyDebtPayments.amount / input.monthlyIncome.amount;

  return {
    leftOver,
    ratioCeiling,
    maxInstallment,
    currentCommitmentRatio,
    limitedBy:
      maxInstallment.amount === 0
        ? "NOTHING_LEFT"
        : leftOver.amount <= ratioCeiling.amount
          ? "CASH"
          : "RATIO",
  };
}

export interface Offer {
  readonly installmentAmount: Money;
  readonly installmentCount: number;
  readonly downPayment?: Money;
  /** The balance the creditor says is owed today, when they have stated one. */
  readonly claimedBalance?: Money;
}

export type ProposalVerdict = "FITS" | "TIGHT" | "DOES_NOT_FIT";

export interface ProposalEvaluation {
  readonly capacity: ProposalCapacity;
  readonly verdict: ProposalVerdict;
  /** Entry plus every instalment. What the agreement really costs. */
  readonly totalPaid: Money;
  /** How much room is left under the ceiling. Negative when it is exceeded. */
  readonly headroom: Money;
  /** Share of income committed to debt if this is accepted. */
  readonly commitmentRatioAfter: number;
  /**
   * The monthly rate hidden in the offer, when the creditor stated a balance.
   *
   * Null when there is nothing to solve from - and null is the right answer to
   * show, because a rate presented without basis is how people accept the
   * expensive proposal believing it is the cheap one.
   */
  readonly impliedMonthlyRate: number | null;
  /** Claimed balance minus what will actually be paid. Negative means it costs more. */
  readonly differenceVsClaimed: Money | null;
}

export function evaluateProposal(
  capacity: ProposalCapacity,
  offer: Offer,
  income: Money,
): ProposalEvaluation {
  const currency = income.currency;
  const down = offer.downPayment ?? money(0, currency);

  const totalPaid = sum(
    [down, multiply(offer.installmentAmount, Math.max(offer.installmentCount, 0))],
    currency,
  );

  const headroom = subtract(capacity.maxInstallment, offer.installmentAmount);

  const financed = offer.claimedBalance
    ? clampToZero(subtract(offer.claimedBalance, down))
    : undefined;

  return {
    capacity,
    verdict: verdictFor(capacity, offer.installmentAmount),
    totalPaid,
    headroom,
    commitmentRatioAfter:
      income.amount === 0
        ? 0
        : capacity.currentCommitmentRatio + offer.installmentAmount.amount / income.amount,
    impliedMonthlyRate: financed
      ? impliedMonthlyRate(financed, offer.installmentAmount, offer.installmentCount)
      : null,
    differenceVsClaimed: offer.claimedBalance ? subtract(offer.claimedBalance, totalPaid) : null,
  };
}

function verdictFor(capacity: ProposalCapacity, installment: Money): ProposalVerdict {
  if (installment.amount <= 0) return "FITS";
  // More than the household has: no arrangement of the month makes this work.
  if (installment.amount > capacity.leftOver.amount) return "DOES_NOT_FIT";
  // Fits in cash, but past the ratio ceiling or eating the whole margin.
  if (
    installment.amount > capacity.ratioCeiling.amount ||
    installment.amount > capacity.leftOver.amount * COMFORT_MARGIN
  ) {
    return "TIGHT";
  }
  return "FITS";
}

export const VERDICT_LABELS: Record<ProposalVerdict, string> = {
  FITS: "Cabe no seu mês",
  TIGHT: "Cabe apertado",
  DOES_NOT_FIT: "Não cabe",
};
