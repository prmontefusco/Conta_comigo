import { describe, expect, it } from "vitest";
import { calendarDate } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import { estimateLateFees, totalLateFees } from "./late-fees";
import type { Obligation } from "./obligation";

/**
 * O número que faltava.
 *
 * "Regularize para estancar juros de mora" nunca moveu ninguém. "Esta conta
 * custa R$ 4,20 por dia parada" move — e é a diferença entre um aviso e uma
 * decisão.
 */
describe("estimateLateFees", () => {
  const hoje = calendarDate("2026-09-30");

  it("não cobra nada de conta que ainda não venceu", () => {
    const resultado = estimateLateFees({
      amount: money(50000),
      dueDate: calendarDate("2026-10-10"),
      asOf: hoje,
    });

    expect(resultado.daysLate).toBe(0);
    expect(resultado.totalCharges).toEqual(money(0));
    expect(resultado.totalDue).toEqual(money(50000));
    expect(resultado.dailyCost).toEqual(money(0));
  });

  it("aplica a multa uma única vez e a mora proporcional aos dias", () => {
    // R$ 1.000 vencidos há 30 dias: multa 2% = R$ 20, mora 1% = R$ 10.
    const resultado = estimateLateFees({
      amount: money(100000),
      dueDate: calendarDate("2026-08-31"),
      asOf: hoje,
    });

    expect(resultado.daysLate).toBe(30);
    expect(resultado.penalty).toEqual(money(2000));
    expect(resultado.arrears).toEqual(money(1000));
    expect(resultado.totalDue).toEqual(money(103000));
  });

  it("a multa não cresce com o tempo; só a mora cresce", () => {
    const base = { amount: money(100000), asOf: hoje };
    const trintaDias = estimateLateFees({ ...base, dueDate: calendarDate("2026-08-31") });
    const sessentaDias = estimateLateFees({ ...base, dueDate: calendarDate("2026-08-01") });

    expect(sessentaDias.penalty).toEqual(trintaDias.penalty);
    expect(sessentaDias.arrears.amount).toBeGreaterThan(trintaDias.arrears.amount);
  });

  it("o custo diário é só a mora, porque a multa não se repete", () => {
    // 1% ao mês sobre R$ 1.000, dividido por 30 dias: R$ 0,33 por dia.
    const resultado = estimateLateFees({
      amount: money(100000),
      dueDate: calendarDate("2026-09-01"),
      asOf: hoje,
    });

    expect(resultado.dailyCost).toEqual(money(33));
  });
});

describe("totalLateFees", () => {
  const hoje = calendarDate("2026-09-30");

  const conta = (id: string, amount: number, dueDate: string): Obligation =>
    ({
      id,
      householdId: "h1",
      direction: "OUTFLOW",
      origin: "MANUAL",
      description: id,
      amount: money(amount),
      dueDate: calendarDate(dueDate),
      competenceDate: calendarDate(dueDate),
      status: "SCHEDULED",
      settledAmount: money(0),
      settlementTransactionIds: [],
      visibility: "HOUSEHOLD",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
    }) as unknown as Obligation;

  it("soma só o que está vencido e ignora o que está em dia", () => {
    const totais = totalLateFees(
      [
        conta("luz", 31000, "2026-08-31"),
        conta("agua", 14200, "2026-08-31"),
        conta("internet", 18000, "2026-10-12"),
      ],
      hoje,
    );

    expect(totais.count).toBe(2);
    expect(totais.principal).toEqual(money(45200));
    expect(totais.charges.amount).toBeGreaterThan(0);
    expect(totais.totalDue.amount).toBeGreaterThan(totais.principal.amount);
  });

  it("devolve zero quando nada venceu", () => {
    const totais = totalLateFees([conta("internet", 18000, "2026-10-12")], hoje);

    expect(totais.count).toBe(0);
    expect(totais.dailyCost).toEqual(money(0));
  });
});
