import { describe, expect, it } from "vitest";
import { monthlyEquivalentOf, parseLoanContractReading } from "./loan-contract-reading";

describe("parseLoanContractReading", () => {
  it("lê um consignado completo", () => {
    const response = JSON.stringify({
      instituicao: "Banco Pan",
      tipo: "PAYROLL_LOAN",
      descricao: "Consignado INSS",
      valorContratado: 12000,
      valorLiberado: 11400.5,
      dataContratacao: "2026-03-10",
      taxaJurosMensal: 1.79,
      cetAnual: 28.4,
      quantidadeParcelas: 72,
      valorParcela: 289.9,
      primeiroVencimento: "2026-04-10",
      seguroMensal: 12.3,
      confianca: "ALTA",
    });

    const reading = parseLoanContractReading(response);

    expect(reading).not.toBeNull();
    expect(reading?.institution).toBe("Banco Pan");
    expect(reading?.kind).toBe("PAYROLL_LOAN");
    expect(reading?.principalContractedCents).toBe(1_200_000);
    expect(reading?.amountDisbursedCents).toBe(1_140_050);
    expect(reading?.interestRateMonthly).toBe(1.79);
    expect(reading?.rateSource).toBe("CONTRACT");
    expect(reading?.cetAnnual).toBe(28.4);
    expect(reading?.installmentCount).toBe(72);
    expect(reading?.installmentAmountCents).toBe(28_990);
    expect(reading?.firstDueDate).toBe("2026-04-10");
    expect(reading?.monthlyInsuranceCents).toBe(1230);
    // Com taxa conhecida, o cronograma pode separar juros de amortização.
    expect(reading?.amortisationSystem).toBe("PRICE");
  });

  it("converte a taxa anual em mensal de forma composta, e diz que converteu", () => {
    const response = JSON.stringify({
      valorContratado: 5000,
      taxaJurosAnual: 30,
      quantidadeParcelas: 24,
    });

    const reading = parseLoanContractReading(response);

    // 30% ao ano são 2,21% ao mês, não 2,5%.
    expect(reading?.interestRateMonthly).toBeCloseTo(2.2104, 3);
    expect(reading?.rateSource).toBe("CONVERTED_FROM_ANNUAL");
  });

  it("prefere a taxa mensal escrita no contrato à conversão da anual", () => {
    const response = JSON.stringify({
      valorContratado: 5000,
      taxaJurosMensal: 2.5,
      taxaJurosAnual: 30,
      quantidadeParcelas: 24,
    });

    expect(parseLoanContractReading(response)?.interestRateMonthly).toBe(2.5);
    expect(parseLoanContractReading(response)?.rateSource).toBe("CONTRACT");
  });

  it("não confunde CET com juros", () => {
    const response = JSON.stringify({
      valorContratado: 8000,
      cetAnual: 41.2,
      quantidadeParcelas: 36,
    });

    const reading = parseLoanContractReading(response);

    expect(reading?.cetAnnual).toBe(41.2);
    expect(reading?.interestRateMonthly).toBeUndefined();
    expect(reading?.rateSource).toBe("UNKNOWN");
    // Sem taxa, o cronograma não pode fingir que sabe o rateio.
    expect(reading?.amortisationSystem).toBe("SIMPLE");
  });

  it("anualiza o CET mensal quando o contrato só traz esse", () => {
    const response = JSON.stringify({
      valorContratado: 8000,
      cetMensal: 3,
      quantidadeParcelas: 36,
    });

    // (1,03^12 - 1) = 42,58% ao ano.
    expect(parseLoanContractReading(response)?.cetAnnual).toBeCloseTo(42.58, 1);
  });

  it("lê um carnê que só traz parcelas e valor da parcela", () => {
    const response = JSON.stringify({
      descricao: null,
      instituicao: "Casas Bahia",
      tipo: "OTHER",
      quantidadeParcelas: 10,
      valorParcela: 189,
      primeiroVencimento: "2026-10-15",
    });

    const reading = parseLoanContractReading(response);

    expect(reading?.installmentCount).toBe(10);
    expect(reading?.installmentAmountCents).toBe(18_900);
    expect(reading?.principalContractedCents).toBeUndefined();
    expect(reading?.description).toBe("Contrato de crédito - Casas Bahia");
  });

  it("descarta parcelas fora do que o domínio aceita", () => {
    const response = JSON.stringify({ valorContratado: 1000, quantidadeParcelas: 900 });

    expect(parseLoanContractReading(response)?.installmentCount).toBeUndefined();
  });

  it("descarta valores negativos em vez de virá-los", () => {
    const response = JSON.stringify({
      valorContratado: 5000,
      valorLiberado: -300,
      quantidadeParcelas: 12,
    });

    expect(parseLoanContractReading(response)?.amountDisbursedCents).toBeUndefined();
  });

  it("devolve null quando não há valor, parcela nem quantidade", () => {
    const response = JSON.stringify({ instituicao: "Banco X", taxaJurosMensal: 2 });

    expect(parseLoanContractReading(response)).toBeNull();
  });

  it("devolve null quando a resposta não é JSON", () => {
    expect(parseLoanContractReading("Não identifiquei um contrato.")).toBeNull();
  });
});

describe("monthlyEquivalentOf", () => {
  it("não divide por doze", () => {
    expect(monthlyEquivalentOf(12)).toBeCloseTo(0.9489, 3);
    expect(monthlyEquivalentOf(12)).not.toBeCloseTo(1, 2);
  });
});
