import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import { proposalCapacity, type ProposalCapacity } from "./affordable-proposal";
import { evaluateFeiraoOffer, type FeiraoOfferInput } from "./feirao-offer";

const mockCapacity: ProposalCapacity = {
  leftOver: money(600),
  ratioCeiling: money(900),
  maxInstallment: money(400),
  currentCommitmentRatio: 0.15,
  limitedBy: "CASH",
};

describe("evaluateFeiraoOffer", () => {
  it("recomenda pagamento à vista quando o desconto é alto e o caixa cobre sem ferir a reserva", () => {
    const input: FeiraoOfferInput = {
      originalBalance: money(5000),
      cashOfferAmount: money(800), // 84% de desconto
      availableCash: money(2500),
      minimumReserveCushion: money(1000), // sobra 1500 de caixa livre
      capacity: mockCapacity,
    };

    const result = evaluateFeiraoOffer(input);

    expect(result.cashDiscountPercentage).toBe(84);
    expect(result.isCashAffordableWithoutTouchingReserve).toBe(true);
    expect(result.recommendation).toBe("PAY_CASH");
    expect(result.cashSavingsAmount?.amount).toBe(4200);
  });

  it("alerta sobre risco à vista quando consumiria a reserva essencial, mas aprova parcelamento cabível", () => {
    const input: FeiraoOfferInput = {
      originalBalance: money(5000),
      cashOfferAmount: money(1500),
      installmentAmount: money(200), // 10x de 200 = 2000 (cabe no maxInstallment de 400)
      installmentCount: 10,
      availableCash: money(1800),
      minimumReserveCushion: money(1000), // caixa livre seria só 800, 1500 feriria a reserva
      capacity: mockCapacity,
    };

    const result = evaluateFeiraoOffer(input);

    expect(result.isCashAffordableWithoutTouchingReserve).toBe(false);
    expect(result.isInstallmentAffordable).toBe(true);
    expect(result.recommendation).toBe("PAY_INSTALLMENT");
    expect(result.installmentTotalCost?.amount).toBe(2000);
    expect(result.installmentDiscountPercentage).toBe(60);
  });

  it("rejeita parcelamento quando a parcela ultrapassa a capacidade de pagamento", () => {
    const tightCapacity: ProposalCapacity = {
      leftOver: money(150),
      ratioCeiling: money(300),
      maxInstallment: money(150),
      currentCommitmentRatio: 0.25,
      limitedBy: "CASH",
    };

    const input: FeiraoOfferInput = {
      originalBalance: money(4000),
      installmentAmount: money(350), // excede os 150 de capacidade
      installmentCount: 12,
      availableCash: money(500),
      minimumReserveCushion: money(1000),
      capacity: tightCapacity,
    };

    const result = evaluateFeiraoOffer(input);

    expect(result.isInstallmentAffordable).toBe(false);
    expect(result.recommendation).toBe("INSTALLMENT_UNSUSTAINABLE");
  });
});

/**
 * O confronto entre as duas propostas.
 *
 * Este bloco existe porque o módulo tinha três testes e nenhum comparava o
 * custo das duas ofertas. O primeiro ramo da decisão disparava só com "o
 * dinheiro dá", e anunciava que o pagamento à vista "tem o maior desconto" —
 * uma frase que o código nunca havia verificado.
 */
describe("qual das duas propostas custa menos", () => {
  const capacidadeFolgada = proposalCapacity({
    monthlyIncome: money(300000),
    monthlyEssentials: money(180000),
    monthlyDebtPayments: money(0),
  });

  it("não manda pagar à vista quando o parcelado custa menos", () => {
    const result = evaluateFeiraoOffer({
      originalBalance: money(1000000), // dívida de R$ 10.000
      cashOfferAmount: money(800000), // à vista R$ 8.000
      installmentAmount: money(50000), // 10x R$ 500 = R$ 5.000
      installmentCount: 10,
      availableCash: money(900000),
      minimumReserveCushion: money(50000),
      capacity: capacidadeFolgada,
    });

    expect(result.recommendation).toBe("PAY_INSTALLMENT");
    expect(result.recommendationReason).not.toMatch(/maior desconto/i);
    // R$ 5.000 parcelado contra R$ 8.000 à vista: R$ 3.000 mais barato.
    expect(result.installmentExtraCostVsCash).toEqual(money(-300000));
  });

  it("manda pagar à vista quando à vista é realmente mais barato e o caixa cobre", () => {
    const result = evaluateFeiraoOffer({
      originalBalance: money(1000000),
      cashOfferAmount: money(300000), // R$ 3.000 à vista
      installmentAmount: money(60000), // 10x R$ 600 = R$ 6.000
      installmentCount: 10,
      availableCash: money(500000),
      minimumReserveCushion: money(100000),
      capacity: capacidadeFolgada,
    });

    expect(result.recommendation).toBe("PAY_CASH");
    expect(result.installmentExtraCostVsCash).toEqual(money(300000));
  });

  it("avisa quando o acordo parcelado custa mais que a própria dívida", () => {
    const result = evaluateFeiraoOffer({
      originalBalance: money(100000), // R$ 1.000
      installmentAmount: money(20000), // 12x R$ 200 = R$ 2.400
      installmentCount: 12,
      availableCash: money(0),
      minimumReserveCushion: money(0),
      capacity: capacidadeFolgada,
    });

    expect(result.installmentCostsMoreThanDebt).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/não é desconto/i);
    expect(result.recommendationReason).toMatch(/custa mais que a própria dívida/i);
  });

  it("protege a reserva: parcelado quando o à vista mais barato esgotaria o colchão", () => {
    const result = evaluateFeiraoOffer({
      originalBalance: money(1000000),
      cashOfferAmount: money(300000),
      installmentAmount: money(35000),
      installmentCount: 10,
      availableCash: money(320000),
      minimumReserveCushion: money(100000), // sobrariam só R$ 200 de colchão
      capacity: capacidadeFolgada,
    });

    expect(result.recommendation).toBe("PAY_INSTALLMENT");
    expect(result.warnings.join(" ")).toMatch(/reserva de respiro/i);
  });

  it("recusa as duas quando nenhuma serve, em vez de escolher a menos ruim", () => {
    const semFolga = proposalCapacity({
      monthlyIncome: money(300000),
      monthlyEssentials: money(295000),
      monthlyDebtPayments: money(0),
    });

    const result = evaluateFeiraoOffer({
      originalBalance: money(1000000),
      cashOfferAmount: money(300000),
      installmentAmount: money(90000),
      installmentCount: 10,
      availableCash: money(310000),
      minimumReserveCushion: money(100000),
      capacity: semFolga,
    });

    expect(result.recommendation).toBe("CASH_RISKY_CONSIDER_INSTALLMENT");
    expect(result.recommendationReason).toMatch(/nenhuma das duas/i);
  });
});
