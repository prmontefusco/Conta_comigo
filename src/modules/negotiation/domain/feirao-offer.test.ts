import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import type { ProposalCapacity } from "./affordable-proposal";
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
