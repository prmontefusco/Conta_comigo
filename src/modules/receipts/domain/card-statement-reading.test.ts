import { describe, expect, it } from "vitest";
import { monthKey } from "@/core/date/calendar-date";
import {
  buildCardStatementPrompt,
  groupImportedPurchases,
  importStatementMonth,
  parseCardStatementReading,
  remainingInstallments,
} from "./card-statement-reading";

describe("parseCardStatementReading", () => {
  it("reads current statement totals and installment purchases", () => {
    const reading = parseCardStatementReading(`{
      "emissor": "Itaú",
      "nomeCartao": "Passaí Gold",
      "bandeira": "Mastercard",
      "finalCartao": "8895",
      "vencimento": "2026-09-17",
      "fechamento": "2026-09-10",
      "referencia": "2026-09",
      "totalFatura": 309.45,
      "pagamentoMinimo": 66.23,
      "limiteTotal": 1180,
      "confianca": "ALTA",
      "compras": [
        {
          "data": "2026-07-19",
          "descricao": "Assai 97 Cg Ae 02/03",
          "valorParcela": 254.52,
          "parcelaAtual": 2,
          "totalParcelas": 3
        },
        {
          "data": "2026-05-15",
          "descricao": "PARCELA DE REF 04/06",
          "valorParcela": 38.28,
          "parcelaAtual": 4,
          "totalParcelas": 6
        }
      ]
    }`);

    expect(reading).not.toBeNull();
    expect(reading?.statementTotalCents).toBe(30945);
    expect(reading?.minimumPaymentCents).toBe(6623);
    expect(reading?.creditLimitCents).toBe(118000);
    expect(reading?.referenceMonth).toBe("2026-09");
    expect(reading?.purchases).toHaveLength(2);
    expect(reading?.purchases[0]).toMatchObject({
      description: "Assai 97 Cg Ae",
      installmentAmountCents: 25452,
      installmentNumber: 2,
      installmentCount: 3,
      firstStatementMonth: "2026-08",
    });
    expect(reading?.purchases[1]).toMatchObject({
      description: "PARCELA DE REF",
      installmentAmountCents: 3828,
      installmentNumber: 4,
      installmentCount: 6,
      firstStatementMonth: "2026-06",
    });
  });

  it("rejects impossible installment rows without discarding the whole statement", () => {
    const reading = parseCardStatementReading(`{
      "vencimento": "2026-09-17",
      "fechamento": "2026-09-10",
      "confianca": "MEDIA",
      "compras": [
        {
          "data": "2026-09-01",
          "descricao": "Linha ruim 05/03",
          "valorParcela": 10,
          "parcelaAtual": 5,
          "totalParcelas": 3
        },
        {
          "data": "2026-09-01",
          "descricao": "Mercado",
          "valorParcela": 20,
          "parcelaAtual": 1,
          "totalParcelas": 1
        }
      ]
    }`);

    expect(reading?.purchases).toHaveLength(1);
    expect(reading?.discarded).toEqual([
      {
        reason: "parcela atual maior que total de parcelas",
        line: "2026-09-01 Linha ruim 05/03",
      },
    ]);
  });

  it("limits accepted purchases when the caller asks for a smaller read", () => {
    const rows = Array.from(
      { length: 21 },
      (_, index) =>
        `{ "data": "2026-09-01", "descricao": "Compra ${index + 1}", "valorParcela": ${index + 1}, "parcelaAtual": 1, "totalParcelas": 1 }`,
    ).join(",");
    const reading = parseCardStatementReading(
      `{
        "vencimento": "2026-09-17",
        "fechamento": "2026-09-10",
        "confianca": "MEDIA",
        "compras": [${rows}]
      }`,
      { maxPurchases: 20 },
    );

    expect(reading?.purchases).toHaveLength(20);
    expect(reading?.discarded).toContainEqual({
      reason: "acima do limite de linhas por arquivo",
      line: "2026-09-01 Compra 21",
    });
  });

  it("puts the purchase limit in the prompt", () => {
    expect(buildCardStatementPrompt(80)).toContain("Retorne no máximo 80 compras");
  });
});

describe("groupImportedPurchases", () => {
  it("descarta a prévia de 'próximas faturas' quando a compra já apareceu na fatura atual", () => {
    // Fatura real da Passaí: cada uma destas compras aparece duas vezes na
    // leitura — uma vez nos lançamentos desta fatura, outra no resumo de
    // "compras parceladas - próximas faturas", com o número de parcela
    // seguinte. As duas descrevem a mesma compra parcelada.
    const purchases = [
      {
        description: "Assai 97 Cg Ae",
        installmentAmount: 25452,
        installmentNumber: 2,
        installmentCount: 3,
      },
      {
        description: "Assai 97 Cg Ae",
        installmentAmount: 25452,
        installmentNumber: 3,
        installmentCount: 3,
      },
      {
        description: "PARCELA DE REF",
        installmentAmount: 3828,
        installmentNumber: 4,
        installmentCount: 6,
      },
      {
        description: "PARCELA DE REF",
        installmentAmount: 3828,
        installmentNumber: 5,
        installmentCount: 6,
      },
      {
        description: "Mensalidade - Plano do Anuidade Diferenciada",
        installmentAmount: 1665,
        installmentNumber: 1,
        installmentCount: 1,
      },
    ];

    const grouped = groupImportedPurchases(purchases);

    expect(grouped).toHaveLength(3);
    expect(grouped.find((p) => p.description === "Assai 97 Cg Ae")).toMatchObject({
      installmentNumber: 2,
      installmentCount: 3,
    });
    expect(grouped.find((p) => p.description === "PARCELA DE REF")).toMatchObject({
      installmentNumber: 4,
      installmentCount: 6,
    });
  });

  it("mantém compras diferentes com o mesmo valor de parcela", () => {
    const purchases = [
      {
        description: "Mercado",
        installmentAmount: 5000,
        installmentNumber: 1,
        installmentCount: 1,
      },
      { description: "Posto", installmentAmount: 5000, installmentNumber: 1, installmentCount: 1 },
    ];

    expect(groupImportedPurchases(purchases)).toHaveLength(2);
  });
});

describe("remainingInstallments e importStatementMonth", () => {
  it("conta só as parcelas que ainda faltam, a partir da parcela lida", () => {
    // Assai: parcela 2 de 3, lida na fatura de setembro (primeira em agosto).
    const assai = {
      installmentNumber: 2,
      installmentCount: 3,
      firstStatementMonth: monthKey("2026-08"),
    };
    expect(remainingInstallments(assai)).toBe(2);
    expect(importStatementMonth(assai)).toBe(monthKey("2026-09"));
  });

  it("não inventa parcelas passadas para uma compra na última parcela", () => {
    // 12 de 12: só a última entra, não as 11 já pagas fora do app.
    const ultimaParcela = {
      installmentNumber: 12,
      installmentCount: 12,
      firstStatementMonth: monthKey("2025-10"),
    };
    expect(remainingInstallments(ultimaParcela)).toBe(1);
    expect(importStatementMonth(ultimaParcela)).toBe(monthKey("2026-09"));
  });

  it("mantém o total de parcelas para uma compra nova, começando agora", () => {
    const novaCompra = {
      installmentNumber: 1,
      installmentCount: 12,
      firstStatementMonth: monthKey("2026-09"),
    };
    expect(remainingInstallments(novaCompra)).toBe(12);
    expect(importStatementMonth(novaCompra)).toBe(monthKey("2026-09"));
  });
});
