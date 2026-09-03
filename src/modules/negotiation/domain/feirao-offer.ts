import {
  type Money,
  clampToZero,
  greaterOrEqual,
  isPositive,
  money,
  multiply,
  subtract,
  sum,
} from "@/core/money/money";
import type { ProposalCapacity } from "./affordable-proposal";

/**
 * Feirão / Desenrola Offer evaluation.
 *
 * In debt fairs (Desenrola Brasil, Serasa Limpa Nome, bank renegotiations),
 * people are usually offered two options:
 * 1. A deep discount for lump-sum (cash) payment (e.g. 70%-90% off).
 * 2. An installment plan (e.g. 12x to 60x), sometimes with interest, sometimes with smaller discounts.
 *
 * This module evaluates:
 * - Real savings of lump-sum vs installment.
 * - Cash safety: whether paying in cash destroys the starter/emergency cushion.
 * - Installment sustainability: whether the monthly installment fits comfortably.
 */

export interface FeiraoOfferInput {
  /** The full original claimed balance before discount. */
  readonly originalBalance: Money;
  /** The discounted cash price offered for immediate settlement. */
  readonly cashOfferAmount?: Money;
  /** The installment amount offered by the creditor. */
  readonly installmentAmount?: Money;
  /** Total number of installments. */
  readonly installmentCount?: number;
  /** Upfront down payment required for the installment plan, if any. */
  readonly downPayment?: Money;
  /** Current available liquid cash of the household. */
  readonly availableCash: Money;
  /** Minimum safety cushion the household should not touch (e.g. starter reserve). */
  readonly minimumReserveCushion: Money;
  /** Household payment capacity computed from income and essential expenses. */
  readonly capacity: ProposalCapacity;
}

export type FeiraoRecommendation =
  | "PAY_CASH" // Lump sum is overwhelmingly better and cash allows it safely
  | "CASH_RISKY_CONSIDER_INSTALLMENT" // Lump sum discount is huge, but would wipe out emergency cash
  | "PAY_INSTALLMENT" // Installments fit well and cash is insufficient or needed for survival
  | "INSTALLMENT_UNSUSTAINABLE" // Installment exceeds monthly capacity; need renegotiating lower
  | "INSUFFICIENT_DATA";

export interface FeiraoOfferAnalysis {
  readonly originalBalance: Money;
  readonly cashOfferAmount?: Money;
  readonly cashDiscountPercentage?: number;
  readonly cashSavingsAmount?: Money;
  readonly isCashAffordableWithoutTouchingReserve: boolean;
  readonly remainingCashAfterLumpSum?: Money;

  readonly installmentTotalCost?: Money;
  readonly installmentSavingsVsOriginal?: Money;
  readonly installmentDiscountPercentage?: number;
  readonly isInstallmentAffordable: boolean;
  readonly installmentShareOfMonthlyIncome?: number;

  readonly recommendation: FeiraoRecommendation;
  readonly recommendationReason: string;
}

export function evaluateFeiraoOffer(input: FeiraoOfferInput): FeiraoOfferAnalysis {
  const currency = input.originalBalance.currency;
  const zeroMoney = money(0, currency);

  // 1. Cash offer analysis
  let cashDiscountPercentage: number | undefined;
  let cashSavingsAmount: Money | undefined;
  let isCashAffordableWithoutTouchingReserve = false;
  let remainingCashAfterLumpSum: Money | undefined;

  if (input.cashOfferAmount && isPositive(input.cashOfferAmount)) {
    const savings = subtract(input.originalBalance, input.cashOfferAmount);
    cashSavingsAmount = savings.amount > 0 ? savings : zeroMoney;

    if (input.originalBalance.amount > 0) {
      cashDiscountPercentage = Math.round(
        (Math.max(0, input.originalBalance.amount - input.cashOfferAmount.amount) /
          input.originalBalance.amount) *
          100,
      );
    }

    const usableCash = clampToZero(subtract(input.availableCash, input.minimumReserveCushion));
    isCashAffordableWithoutTouchingReserve = greaterOrEqual(usableCash, input.cashOfferAmount);

    remainingCashAfterLumpSum = subtract(input.availableCash, input.cashOfferAmount);
  }

  // 2. Installment offer analysis
  let installmentTotalCost: Money | undefined;
  let installmentSavingsVsOriginal: Money | undefined;
  let installmentDiscountPercentage: number | undefined;
  let isInstallmentAffordable = false;

  if (
    input.installmentAmount &&
    isPositive(input.installmentAmount) &&
    input.installmentCount &&
    input.installmentCount > 0
  ) {
    const totalInstallments = multiply(input.installmentAmount, input.installmentCount);
    const down = input.downPayment ?? zeroMoney;
    installmentTotalCost = sum([totalInstallments, down], currency);

    const savings = subtract(input.originalBalance, installmentTotalCost);
    installmentSavingsVsOriginal = savings.amount > 0 ? savings : zeroMoney;

    if (
      input.originalBalance.amount > 0 &&
      installmentTotalCost.amount < input.originalBalance.amount
    ) {
      installmentDiscountPercentage = Math.round(
        ((input.originalBalance.amount - installmentTotalCost.amount) /
          input.originalBalance.amount) *
          100,
      );
    } else {
      installmentDiscountPercentage = 0;
    }

    // Affordable if fits in proposal capacity max installment
    isInstallmentAffordable = greaterOrEqual(
      input.capacity.maxInstallment,
      input.installmentAmount,
    );
  }

  // 3. Recommendation logic
  let recommendation: FeiraoRecommendation = "INSUFFICIENT_DATA";
  let recommendationReason = "Preencha os valores da proposta para ver a análise.";

  const hasCashOffer = !!input.cashOfferAmount && isPositive(input.cashOfferAmount);
  const hasInstallmentOffer =
    !!input.installmentAmount &&
    isPositive(input.installmentAmount) &&
    !!input.installmentCount &&
    input.installmentCount > 0;

  if (hasCashOffer && isCashAffordableWithoutTouchingReserve) {
    recommendation = "PAY_CASH";
    recommendationReason =
      "O pagamento à vista tem o maior desconto e seu saldo cobre o valor sem comprometer sua reserva de respiro.";
  } else if (hasCashOffer && !isCashAffordableWithoutTouchingReserve) {
    const totalCashCoversLumpSum =
      remainingCashAfterLumpSum && remainingCashAfterLumpSum.amount >= 0;

    if (hasInstallmentOffer && isInstallmentAffordable) {
      recommendation = "PAY_INSTALLMENT";
      recommendationReason =
        "O valor à vista comprometeria sua reserva de respiro. A opção parcelada cabe no seu orçamento mensal e protege seu caixa para imprevistos.";
    } else if (totalCashCoversLumpSum && (cashDiscountPercentage ?? 0) >= 60) {
      recommendation = "CASH_RISKY_CONSIDER_INSTALLMENT";
      recommendationReason =
        "O desconto à vista é expressivo, mas pagar à vista usará sua reserva de segurança. Avalie se o parcelamento não protege melhor o seu dia a dia.";
    } else if (hasInstallmentOffer && !isInstallmentAffordable) {
      recommendation = "INSTALLMENT_UNSUSTAINABLE";
      recommendationReason =
        "A parcela oferecida excede sua capacidade de pagamento mensal. Peça mais parcelas ou um desconto maior antes de fechar.";
    } else {
      recommendation = "CASH_RISKY_CONSIDER_INSTALLMENT";
      recommendationReason =
        "Pagar à vista esgotaria seu caixa disponível. Vale a pena buscar uma opção parcelada que caiba no mês.";
    }
  } else if (hasInstallmentOffer) {
    if (isInstallmentAffordable) {
      recommendation = "PAY_INSTALLMENT";
      recommendationReason =
        "A parcela cabe dentro do seu limite de comprometimento mensal recomendado.";
    } else {
      recommendation = "INSTALLMENT_UNSUSTAINABLE";
      recommendationReason =
        "A parcela ultrapassa o que seu orçamento comporta hoje. Não aceite esta parcela sem pedir um prazo maior.";
    }
  }

  return {
    originalBalance: input.originalBalance,
    cashOfferAmount: input.cashOfferAmount,
    cashDiscountPercentage,
    cashSavingsAmount,
    isCashAffordableWithoutTouchingReserve,
    remainingCashAfterLumpSum,
    installmentTotalCost,
    installmentSavingsVsOriginal,
    installmentDiscountPercentage,
    isInstallmentAffordable,
    recommendation,
    recommendationReason,
  };
}
