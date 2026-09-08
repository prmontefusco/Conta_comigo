import { describe, expect, it } from "vitest";
import { instant } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import { detectarDespesasFantasmas } from "./ghost-subscriptions";
import type { RecurringRule } from "./recurring-rule";

describe("ghost-subscriptions domain", () => {
  const testInstant = instant("2026-01-01T00:00:00.000Z");

  const regrasExemplo: RecurringRule[] = [
    {
      id: "r1",
      householdId: "h1",
      description: "Assinatura Netflix Premium",
      amount: money(5590, "BRL"), // R$ 55,90
      direction: "OUTFLOW",
      frequency: "MONTHLY",
      dayOfMonth: 10,
      active: true,
      createdAt: testInstant,
      updatedAt: testInstant,
    },
    {
      id: "r2",
      householdId: "h1",
      description: "Spotify Família",
      amount: money(3490, "BRL"), // R$ 34,90
      direction: "OUTFLOW",
      frequency: "MONTHLY",
      dayOfMonth: 15,
      active: true,
      createdAt: testInstant,
      updatedAt: testInstant,
    },
    {
      id: "r3",
      householdId: "h1",
      description: "Aluguel Apartamento",
      amount: money(250000, "BRL"), // R$ 2.500,00 (não é micro-assinatura)
      direction: "OUTFLOW",
      frequency: "MONTHLY",
      dayOfMonth: 5,
      active: true,
      createdAt: testInstant,
      updatedAt: testInstant,
    },
  ] as unknown as RecurringRule[];

  it("identifica streamings e micro-despesas excluindo contas estruturais altas", () => {
    const resultado = detectarDespesasFantasmas(regrasExemplo);

    expect(resultado.itens).toHaveLength(2);
    expect(resultado.itens.map((i) => i.nome)).toContain("Assinatura Netflix Premium");
    expect(resultado.itens.map((i) => i.nome)).toContain("Spotify Família");
    expect(resultado.totalMensal.amount).toBe(5590 + 3490);
  });

  it("projeta o impacto acumulado em 1 ano e 5 anos", () => {
    const resultado = detectarDespesasFantasmas(regrasExemplo);

    expect(resultado.custoAcumulado1Ano.amount).toBe((5590 + 3490) * 12);
    expect(resultado.projecaoInvestido5Anos.amount).toBeGreaterThan(
      resultado.custoAcumulado1Ano.amount * 5,
    );
  });
});
