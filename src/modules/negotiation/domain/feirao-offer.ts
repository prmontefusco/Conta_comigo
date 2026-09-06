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
  | "PAY_CASH" // Lump sum costs least and cash allows it safely
  | "CASH_RISKY_CONSIDER_INSTALLMENT" // Lump sum is cheaper, but would wipe out emergency cash
  | "PAY_INSTALLMENT" // Instalments fit, and cash is insufficient, needed, or more expensive
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

  /**
   * How much more the instalment plan costs than settling in cash.
   *
   * Positive when paying over time is dearer, negative when it is actually
   * cheaper - which happens more often than people expect, because a "70% off
   * for cash" headline is quoted against the inflated balance while the
   * instalment plan is quoted against a renegotiated one.
   */
  readonly installmentExtraCostVsCash?: Money;

  /**
   * True when the instalments add up to more than the debt they settle.
   *
   * An agreement that costs more than the debt is not a discount, and a
   * screen that calls it "cabe no seu mês" without saying so is helping
   * someone sign it.
   */
  readonly installmentCostsMoreThanDebt: boolean;

  readonly recommendation: FeiraoRecommendation;
  readonly recommendationReason: string;
  /** Plain warnings to show alongside the verdict, most important first. */
  readonly warnings: readonly string[];
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

  // 3. Which offer actually costs less
  //
  // This comparison used to be missing, and its absence was the worst defect
  // in the module. The first branch fired on "cash is affordable" alone and
  // announced that the lump sum "tem o maior desconto" - a sentence the code
  // had never checked. A creditor offering R$ 8.000 to settle now against
  // 10 x R$ 500 was answered with "pague à vista", costing R$ 3.000.
  //
  // So cost comes first, and liquidity second. Cash only wins when it is both
  // cheaper *and* payable without eating the cushion that keeps the household
  // off the card the next time something breaks.

  const hasCashOffer = !!input.cashOfferAmount && isPositive(input.cashOfferAmount);
  const hasInstallmentOffer =
    !!input.installmentAmount &&
    isPositive(input.installmentAmount) &&
    !!input.installmentCount &&
    input.installmentCount > 0;

  const installmentExtraCostVsCash =
    hasCashOffer && installmentTotalCost
      ? subtract(installmentTotalCost, input.cashOfferAmount!)
      : undefined;

  const installmentCostsMoreThanDebt =
    !!installmentTotalCost &&
    input.originalBalance.amount > 0 &&
    installmentTotalCost.amount > input.originalBalance.amount;

  const warnings: string[] = [];

  if (installmentCostsMoreThanDebt && installmentTotalCost) {
    const extra = subtract(installmentTotalCost, input.originalBalance);
    warnings.push(
      `Atenção: parcelado você paga ${formatBRL(installmentTotalCost)} por uma dívida de ${formatBRL(input.originalBalance)} — ${formatBRL(extra)} a mais. Isso não é desconto, é juro.`,
    );
  }

  if (installmentExtraCostVsCash && installmentExtraCostVsCash.amount < 0) {
    warnings.push(
      `O parcelado sai ${formatBRL(multiply(installmentExtraCostVsCash, -1))} mais barato que a proposta à vista, mesmo pagando ao longo do tempo.`,
    );
  }

  if (hasCashOffer && remainingCashAfterLumpSum && remainingCashAfterLumpSum.amount < 0) {
    warnings.push("Seu saldo atual não cobre o valor à vista.");
  } else if (hasCashOffer && !isCashAffordableWithoutTouchingReserve) {
    warnings.push(
      "Pagar à vista consumiria a reserva de respiro. Sem colchão, o próximo imprevisto volta para o cartão.",
    );
  }

  // 4. Recommendation
  let recommendation: FeiraoRecommendation = "INSUFFICIENT_DATA";
  let recommendationReason = "Preencha os valores da proposta para ver a análise.";

  const cashIsCheaper =
    hasCashOffer &&
    (!installmentTotalCost || input.cashOfferAmount!.amount <= installmentTotalCost.amount);

  if (hasCashOffer && !hasInstallmentOffer) {
    if (isCashAffordableWithoutTouchingReserve) {
      recommendation = "PAY_CASH";
      recommendationReason = `Pagar ${formatBRL(input.cashOfferAmount!)} à vista liquida a dívida e seu saldo cobre esse valor sem tocar na reserva de respiro.`;
    } else {
      recommendation = "CASH_RISKY_CONSIDER_INSTALLMENT";
      recommendationReason =
        "Só há proposta à vista, e ela não cabe sem consumir sua reserva. Peça ao credor uma opção parcelada antes de decidir.";
    }
  } else if (hasInstallmentOffer && !hasCashOffer) {
    if (isInstallmentAffordable) {
      recommendation = "PAY_INSTALLMENT";
      recommendationReason = installmentCostsMoreThanDebt
        ? "A parcela cabe no seu mês, mas o acordo custa mais que a própria dívida. Antes de assinar, peça desconto ou compare com o valor à vista."
        : "A parcela cabe dentro do seu limite de comprometimento mensal recomendado.";
    } else {
      recommendation = "INSTALLMENT_UNSUSTAINABLE";
      recommendationReason = `A parcela de ${formatBRL(input.installmentAmount!)} passa do que seu mês comporta (${formatBRL(input.capacity.maxInstallment)}). Peça mais prazo ou um desconto maior antes de fechar.`;
    }
  } else if (hasCashOffer && hasInstallmentOffer) {
    if (cashIsCheaper && isCashAffordableWithoutTouchingReserve) {
      recommendation = "PAY_CASH";
      recommendationReason = installmentExtraCostVsCash
        ? `À vista custa ${formatBRL(input.cashOfferAmount!)} contra ${formatBRL(installmentTotalCost!)} parcelado — ${formatBRL(installmentExtraCostVsCash)} de economia — e seu saldo cobre isso sem tocar na reserva.`
        : "À vista custa menos e seu saldo cobre o valor sem tocar na reserva de respiro.";
    } else if (cashIsCheaper && !isCashAffordableWithoutTouchingReserve) {
      if (isInstallmentAffordable) {
        recommendation = "PAY_INSTALLMENT";
        recommendationReason = `À vista sairia mais barato, mas consumiria sua reserva de respiro. A parcela de ${formatBRL(input.installmentAmount!)} cabe no mês e mantém um colchão para imprevistos.`;
      } else {
        recommendation = "CASH_RISKY_CONSIDER_INSTALLMENT";
        recommendationReason =
          "À vista é mais barato mas esgota seu caixa, e a parcela oferecida não cabe no mês. Nenhuma das duas serve como está: peça mais prazo ou desconto maior.";
      }
    } else if (isInstallmentAffordable) {
      // The instalment plan is genuinely cheaper. Rare, and exactly the case
      // the old code got wrong in the opposite direction.
      recommendation = "PAY_INSTALLMENT";
      recommendationReason = `Parcelado custa ${formatBRL(installmentTotalCost!)} contra ${formatBRL(input.cashOfferAmount!)} à vista: mesmo pagando ao longo do tempo, sai mais barato, e a parcela cabe no seu mês.`;
    } else {
      recommendation = "INSTALLMENT_UNSUSTAINABLE";
      recommendationReason = `Parcelado sai mais barato que à vista, mas a parcela de ${formatBRL(input.installmentAmount!)} não cabe no seu mês. Peça mais parcelas para chegar perto de ${formatBRL(input.capacity.maxInstallment)}.`;
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
    installmentExtraCostVsCash,
    installmentCostsMoreThanDebt,
    recommendation,
    recommendationReason,
    warnings,
  };
}

/** Reais with two decimals, for sentences that name a figure. */
function formatBRL(value: Money): string {
  const negative = value.amount < 0;
  const absolute = Math.abs(value.amount);
  const reais = Math.floor(absolute / 100);
  const cents = absolute % 100;
  return `${negative ? "-" : ""}R$ ${reais.toLocaleString("pt-BR")},${String(cents).padStart(2, "0")}`;
}
