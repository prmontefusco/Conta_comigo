import { describe, expect, it } from "vitest";
import { advisorRequestSchema, MAX_QUESTION_LENGTH } from "./advisor-request-schema";

/**
 * O corpo desta rota vira prompt de um modelo cobrado por token. Aqui, aceitar
 * demais custa dinheiro — não é só higiene de validação.
 */

function context(overrides: Record<string, unknown> = {}) {
  return {
    score: 62,
    statusLabel: "Atenção",
    totalCashFormatted: "R$ 1.200,00",
    monthlyIncomeFormatted: "R$ 4.000,00",
    monthlyExpensesFormatted: "R$ 3.500,00",
    monthlyNetFormatted: "R$ 500,00",
    debtCommitmentRatio: 34,
    totalDebtFormatted: "R$ 12.000,00",
    overdueBillsCount: 2,
    overdueBillsTotalFormatted: "R$ 800,00",
    emergencyFundMonths: 0.5,
    monthsToDebtFree: 24,
    debtFreeDateFormatted: "01/09/2028",
    ...overrides,
  };
}

describe("advisorRequestSchema", () => {
  it("aceita um pedido completo", () => {
    const result = advisorRequestSchema.safeParse({
      message: "Qual dívida pagar primeiro?",
      context: context(),
    });

    expect(result.success).toBe(true);
  });

  it("aceita pedido sem pergunta, que é o diagnóstico automático", () => {
    const result = advisorRequestSchema.safeParse({ context: context() });

    expect(result.success).toBe(true);
  });

  it("recusa pergunta acima do teto em vez de truncar", () => {
    const result = advisorRequestSchema.safeParse({
      message: "a".repeat(MAX_QUESTION_LENGTH + 1),
      context: context(),
    });

    // Truncar em silêncio responderia a uma pergunta que ninguém fez.
    expect(result.success).toBe(false);
  });

  it("recusa um campo monetário longo", () => {
    // O valor chega formatado do navegador; sem teto, ele é texto livre indo
    // direto para o prompt.
    const result = advisorRequestSchema.safeParse({
      context: context({ totalCashFormatted: "R$ ".concat("9".repeat(200)) }),
    });

    expect(result.success).toBe(false);
  });

  it("recusa corpo sem contexto", () => {
    expect(advisorRequestSchema.safeParse({ message: "oi" }).success).toBe(false);
  });

  it("recusa corpo nulo, que é o que um JSON malformado vira", () => {
    expect(advisorRequestSchema.safeParse(null).success).toBe(false);
  });

  it("recusa score fora da escala", () => {
    expect(advisorRequestSchema.safeParse({ context: context({ score: 9000 }) }).success).toBe(
      false,
    );
  });

  it("recusa número não finito", () => {
    // `NaN` e `Infinity` atravessam JSON como `null`, mas chegam assim quando o
    // corpo é montado no próprio processo.
    expect(
      advisorRequestSchema.safeParse({ context: context({ debtCommitmentRatio: Infinity }) })
        .success,
    ).toBe(false);
  });

  it("recusa contagem de contas em atraso fracionada", () => {
    expect(
      advisorRequestSchema.safeParse({ context: context({ overdueBillsCount: 1.5 }) }).success,
    ).toBe(false);
  });
});
