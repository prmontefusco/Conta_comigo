import { describe, expect, it } from "vitest";
import { anObligation, aRecurringRule, brl, on } from "@/modules/shared/testing/builders";
import { pendingOccurrences } from "./pending-occurrences";

/**
 * A lista de "a receber" precisa mostrar o salário **depois** de ele cair.
 *
 * A projeção olha só para frente, e está certa nisso. A confirmação olha para
 * trás, porque ninguém confirma um recebimento antes de ele acontecer.
 */
const HOJE = on("2026-09-09");

const salario = aRecurringRule({
  id: "rule-salario",
  direction: "INFLOW",
  description: "Salário",
  amount: brl(2000),
  frequency: "MONTHLY",
  dayOfMonth: 5,
  startDate: on("2026-01-05"),
});

describe("pendingOccurrences", () => {
  it("mostra a ocorrência que já venceu e ainda não foi confirmada", () => {
    const pendentes = pendingOccurrences({
      rules: [salario],
      obligations: [],
      asOf: HOJE,
    });

    const setembro = pendentes.find((item) => item.occurrence.competenceDate === "2026-09-05");
    expect(setembro).toBeDefined();
    expect(setembro?.late).toBe(true);
  });

  it("some da lista depois de confirmada", () => {
    // Sem esta deduplicação, a pessoa apertaria 'Recebi' de novo e o salário
    // entraria duas vezes no saldo.
    const confirmada = anObligation({
      id: "rule-salario:2026-09-05",
      direction: "INFLOW",
      status: "SETTLED",
      source: { recurringRuleId: "rule-salario", occurrenceKey: "rule-salario:2026-09-05" },
    });

    const pendentes = pendingOccurrences({
      rules: [salario],
      obligations: [confirmada],
      asOf: HOJE,
    });

    expect(pendentes.some((item) => item.occurrence.competenceDate === "2026-09-05")).toBe(false);
  });

  it("some também quando a resposta foi 'não recebi'", () => {
    const cancelada = anObligation({
      id: "rule-salario:2026-09-05",
      direction: "INFLOW",
      status: "CANCELED",
      source: { recurringRuleId: "rule-salario", occurrenceKey: "rule-salario:2026-09-05" },
    });

    const pendentes = pendingOccurrences({
      rules: [salario],
      obligations: [cancelada],
      asOf: HOJE,
    });

    expect(pendentes.some((item) => item.occurrence.competenceDate === "2026-09-05")).toBe(false);
  });

  it("ordena pelo que precisa de resposta primeiro", () => {
    const pendentes = pendingOccurrences({ rules: [salario], obligations: [], asOf: HOJE });
    const datas = pendentes.map((item) => item.occurrence.dueDate);

    expect([...datas].sort()).toEqual(datas);
  });

  it("ignora regra desativada", () => {
    const desativada = aRecurringRule({ ...salario, active: false });

    expect(pendingOccurrences({ rules: [desativada], obligations: [], asOf: HOJE })).toEqual([]);
  });

  it("filtra por direção quando pedido", () => {
    const internet = aRecurringRule({
      id: "rule-internet",
      direction: "OUTFLOW",
      description: "Internet",
      amount: brl(120),
      frequency: "MONTHLY",
      dayOfMonth: 10,
      startDate: on("2026-01-10"),
    });

    const soEntradas = pendingOccurrences({
      rules: [salario, internet],
      obligations: [],
      asOf: HOJE,
      direction: "INFLOW",
    });

    expect(soEntradas.every((item) => item.rule.id === "rule-salario")).toBe(true);
  });

  it("não volta indefinidamente no tempo", () => {
    // Uma janela sem limite ressuscitaria meses de ocorrências que ninguém vai
    // confirmar, e a lista deixaria de ser útil.
    const pendentes = pendingOccurrences({
      rules: [salario],
      obligations: [],
      asOf: HOJE,
      lookbackDays: 10,
    });

    expect(pendentes.every((item) => item.occurrence.dueDate >= "2026-08-30")).toBe(true);
  });
});
