import { describe, expect, it } from "vitest";
import { instant, monthKey } from "@/core/date/calendar-date";
import { anExpense, anObligation, brl, on } from "@/modules/shared/testing/builders";
import {
  carryForward,
  computeBudgetStatus,
  totalPlanned,
  type Budget,
} from "./budget";

const NOW = instant("2026-09-01T10:00:00.000Z");
const AUDIT = { createdAt: NOW, updatedAt: NOW, createdBy: "user-1" };

describe("cálculo e standing do orçamento (budget)", () => {
  const sampleBudget: Budget = {
    ...AUDIT,
    id: "2026-09",
    householdId: "household-a",
    month: monthKey("2026-09"),
    lines: [
      { categoryId: "cat-mercado", plannedAmount: brl(1500) },
      { categoryId: "cat-lazer", plannedAmount: brl(400) },
      { categoryId: "cat-transporte", plannedAmount: brl(300) },
    ],
  };

  it("calcula valores de realizado, comprometido e disponível corretamente", () => {
    const transactions = [
      anExpense({
        categoryId: "cat-mercado",
        amount: brl(800),
        competenceDate: on("2026-09-05"),
      }),
      anExpense({
        categoryId: "cat-lazer",
        amount: brl(450), // Estourou o planejado de 400
        competenceDate: on("2026-09-10"),
      }),
      anExpense({
        // Outro mês - não deve contar no orçamento de setembro
        categoryId: "cat-mercado",
        amount: brl(500),
        competenceDate: on("2026-08-25"),
      }),
    ];

    const obligations = [
      anObligation({
        categoryId: "cat-mercado",
        amount: brl(300), // Prometido mas ainda não pago
        competenceDate: on("2026-09-15"),
        status: "SCHEDULED",
      }),
      anObligation({
        categoryId: "cat-transporte",
        amount: brl(100),
        competenceDate: on("2026-09-20"),
        status: "SCHEDULED",
      }),
      anObligation({
        // Obrigação já quitada - não conta como comprometida
        categoryId: "cat-mercado",
        amount: brl(200),
        competenceDate: on("2026-09-01"),
        status: "SETTLED",
      }),
    ];

    const status = computeBudgetStatus(sampleBudget, transactions, obligations);

    expect(status.month).toBe(monthKey("2026-09"));
    expect(status.lines).toHaveLength(3);

    // Mercado: Planejado 1500, Realizado 800, Comprometido 300 -> Disponível 400, Excesso 0
    const mercado = status.lines.find((l) => l.categoryId === "cat-mercado")!;
    expect(mercado.planned).toEqual(brl(1500));
    expect(mercado.actual).toEqual(brl(800));
    expect(mercado.committed).toEqual(brl(300));
    expect(mercado.available).toEqual(brl(400));
    expect(mercado.overspend).toEqual(brl(0));
    expect(mercado.usage).toBeCloseTo((800 + 300) / 1500);

    // Lazer: Planejado 400, Realizado 450, Comprometido 0 -> Disponível 0, Excesso 50
    const lazer = status.lines.find((l) => l.categoryId === "cat-lazer")!;
    expect(lazer.planned).toEqual(brl(400));
    expect(lazer.actual).toEqual(brl(450));
    expect(lazer.committed).toEqual(brl(0));
    expect(lazer.available).toEqual(brl(0));
    expect(lazer.overspend).toEqual(brl(50));
    expect(lazer.usage).toBeCloseTo(450 / 400);

    // Transporte: Planejado 300, Realizado 0, Comprometido 100 -> Disponível 200, Excesso 0
    const transporte = status.lines.find((l) => l.categoryId === "cat-transporte")!;
    expect(transporte.planned).toEqual(brl(300));
    expect(transporte.actual).toEqual(brl(0));
    expect(transporte.committed).toEqual(brl(100));
    expect(transporte.available).toEqual(brl(200));

    // Totais: Planejado 2200, Realizado 1250, Comprometido 400 -> Usado 1650, Disponível 550
    expect(status.totals.planned).toEqual(brl(2200));
    expect(status.totals.actual).toEqual(brl(1250));
    expect(status.totals.committed).toEqual(brl(400));
    expect(status.totals.available).toEqual(brl(550));
    expect(status.totals.overspend).toEqual(brl(0));
  });

  it("identifica gastos não orçados (unbudgeted) em categorias sem linha", () => {
    const transactions = [
      anExpense({
        categoryId: "cat-farmacia", // Não está no orçamento
        amount: brl(180),
        competenceDate: on("2026-09-08"),
      }),
    ];

    const obligations = [
      anObligation({
        categoryId: "cat-veterinario", // Não está no orçamento
        amount: brl(120),
        competenceDate: on("2026-09-12"),
        status: "SCHEDULED",
      }),
    ];

    const status = computeBudgetStatus(sampleBudget, transactions, obligations);

    // 180 + 120 = 300 não orçados
    expect(status.unbudgeted).toEqual(brl(300));
  });

  it("copia o orçamento para o mês seguinte preservando linhas e atualizando mês", () => {
    const nextMonth = monthKey("2026-10");
    const nextAudit = {
      createdAt: instant("2026-10-01T08:00:00.000Z"),
      updatedAt: instant("2026-10-01T08:00:00.000Z"),
      createdBy: "user-2",
    };

    const carried = carryForward(sampleBudget, nextMonth, nextAudit);

    expect(carried.id).toBe("2026-10");
    expect(carried.month).toBe(nextMonth);
    expect(carried.lines).toEqual(sampleBudget.lines);
    expect(carried.createdBy).toBe("user-2");
  });

  it("calcula o total planejado somando todas as linhas", () => {
    expect(totalPlanned(sampleBudget)).toEqual(brl(2200));
  });
});
