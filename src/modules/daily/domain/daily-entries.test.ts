import { describe, expect, it } from "vitest";
import { monthKey } from "@/core/date/calendar-date";
import {
  aCardPurchase,
  anObligation,
  aTransfer,
  anExpense,
  anIncome,
  brl,
  on,
} from "@/modules/shared/testing/builders";
import {
  buildDailyEntries,
  dailyTotals,
  entriesInMonth,
  groupByDay,
  plannedEntriesInMonth,
  plannedTotals,
  spendingByCategory,
  totalsByMember,
} from "./daily-entries";

const market = anExpense({
  id: "tx-market",
  description: "Mercado",
  amount: brl(320),
  transactionDate: on("2026-08-10"),
  competenceDate: on("2026-08-10"),
  categoryId: "alimentacao",
});

const fuel = anExpense({
  id: "tx-fuel",
  description: "Combustível",
  amount: brl(180),
  transactionDate: on("2026-08-12"),
  competenceDate: on("2026-08-12"),
  categoryId: "veiculo",
  responsibleMemberId: "member-maria",
});

const salary = anIncome({
  id: "tx-salary",
  description: "Salário",
  amount: brl(5000),
  transactionDate: on("2026-08-05"),
  competenceDate: on("2026-08-05"),
  responsibleMemberId: "member-joao",
});

const fridge = aCardPurchase({
  id: "purchase-fridge",
  description: "Geladeira",
  totalAmount: brl(1200),
  installmentCount: 6,
  purchaseDate: on("2026-08-15"),
  competenceDate: on("2026-08-15"),
  categoryId: "moradia",
});

describe("building the ledger", () => {
  it("brings expenses, income and card purchases together, newest first", () => {
    const entries = buildDailyEntries({
      transactions: [market, fuel, salary],
      cardPurchases: [fridge],
    });

    expect(entries.map((entry) => entry.id)).toEqual([
      "purchase-fridge",
      "tx-fuel",
      "tx-market",
      "tx-salary",
    ]);
  });

  it("leaves transfers out: moving money is not spending", () => {
    const entries = buildDailyEntries({ transactions: [aTransfer()], cardPurchases: [] });
    expect(entries).toEqual([]);
  });

  it("leaves a refunded purchase out", () => {
    const entries = buildDailyEntries({
      transactions: [],
      cardPurchases: [aCardPurchase({ refunded: true })],
    });
    expect(entries).toEqual([]);
  });

  it("marks a card purchase as paid later, in full, on the day it happened", () => {
    const [entry] = buildDailyEntries({ transactions: [], cardPurchases: [fridge] });

    expect(entry!.paidLater).toBe(true);
    expect(entry!.amount).toEqual(brl(1200));
    expect(entry!.installmentCount).toBe(6);
  });
});

describe("the month", () => {
  it("selects by competence, not by the day cash moved", () => {
    const lateBill = anExpense({
      id: "tx-late",
      transactionDate: on("2026-09-03"),
      competenceDate: on("2026-08-31"),
    });

    const entries = buildDailyEntries({ transactions: [market, lateBill], cardPurchases: [] });
    const august = entriesInMonth(entries, monthKey("2026-08"));

    expect(august.map((entry) => entry.id)).toContain("tx-late");
  });
});

describe("totals", () => {
  const entries = buildDailyEntries({
    transactions: [market, fuel, salary],
    cardPurchases: [fridge],
  });

  it("separates what came in from what went out", () => {
    const totals = dailyTotals(entries);

    expect(totals.received).toEqual(brl(5000));
    expect(totals.spent).toEqual(brl(1700));
    expect(totals.net).toEqual(brl(3300));
  });

  it("says how much of the spending is owed on a fatura", () => {
    const totals = dailyTotals(entries);

    expect(totals.onCard).toEqual(brl(1200));
    expect(totals.fromAccounts).toEqual(brl(500));
  });

  it("is zero, not empty, for a month with nothing in it", () => {
    expect(dailyTotals([]).spent).toEqual(brl(0));
  });

  it("groups by day, most recent first, with the day's own totals", () => {
    const days = groupByDay(entries);

    expect(days.map((day) => day.date)).toEqual([
      "2026-08-15",
      "2026-08-12",
      "2026-08-10",
      "2026-08-05",
    ]);
    expect(days[3]!.received).toEqual(brl(5000));
    expect(days[3]!.spent).toEqual(brl(0));
  });
});

describe("where it went and who spent it", () => {
  const entries = buildDailyEntries({
    transactions: [market, fuel, salary],
    cardPurchases: [fridge],
  });

  it("ranks categories by how much left, ignoring income", () => {
    const byCategory = spendingByCategory(entries);

    expect(byCategory.map((line) => line.categoryId)).toEqual([
      "moradia",
      "alimentacao",
      "veiculo",
    ]);
    expect(byCategory[0]!.total).toEqual(brl(1200));
  });

  it("attributes to a person only what was recorded as theirs", () => {
    const byMember = totalsByMember(entries);
    const maria = byMember.find((line) => line.memberId === "member-maria");
    const group = byMember.find((line) => line.memberId === undefined);

    expect(maria!.spent).toEqual(brl(180));
    // The market run and the fridge carry no responsible member: they are the
    // group's, and must not be pinned on whoever happens to be listed first.
    expect(group!.spent).toEqual(brl(1520));
  });

  it("keeps income visible per person", () => {
    const joao = totalsByMember(entries).find((line) => line.memberId === "member-joao");
    expect(joao!.received).toEqual(brl(5000));
  });
});

/**
 * O que está planejado não é o que aconteceu.
 *
 * Estes testes existem porque a tela do Dia a dia contava um salário datado
 * para o fim do mês como se já tivesse caído — e o mesmo dinheiro sumia da
 * projeção, que não lê transações. A lista de planejado é separada de
 * propósito: `buildDailyEntries` define o que conta como gasto para o
 * sugeridor de orçamento, e obrigação ali dentro inflaria todo teto sugerido.
 */
describe("plannedEntriesInMonth", () => {
  const setembro = monthKey("2026-09");
  const hoje = on("2026-09-09");

  const salario = anObligation({
    id: "ob-salario",
    direction: "INFLOW",
    description: "Salário",
    amount: brl(2000),
    dueDate: on("2026-09-30"),
    competenceDate: on("2026-09-01"),
  });

  const luz = anObligation({
    id: "ob-luz",
    direction: "OUTFLOW",
    description: "Luz",
    amount: brl(180),
    dueDate: on("2026-09-15"),
    competenceDate: on("2026-09-01"),
  });

  it("lista o que está em aberto no mês, do mais próximo ao mais distante", () => {
    const planejado = plannedEntriesInMonth({
      obligations: [salario, luz],
      month: setembro,
      asOf: hoje,
    });

    expect(planejado.map((entry) => entry.id)).toEqual(["ob-luz", "ob-salario"]);
    expect(planejado[0]?.direction).toBe("OUT");
    expect(planejado[1]?.direction).toBe("IN");
  });

  it("mostra o que ainda falta, não o valor cheio, quando houve pagamento parcial", () => {
    const parcial = anObligation({
      ...luz,
      settledAmount: brl(80),
      status: "PARTIALLY_SETTLED",
    });

    const planejado = plannedEntriesInMonth({
      obligations: [parcial],
      month: setembro,
      asOf: hoje,
    });

    expect(planejado[0]?.amount).toEqual(brl(100));
  });

  it("não lista o que já foi confirmado nem o que foi cancelado", () => {
    const confirmada = anObligation({ ...salario, status: "SETTLED", settledAmount: brl(1850) });
    const cancelada = anObligation({ ...luz, status: "CANCELED" });

    const planejado = plannedEntriesInMonth({
      obligations: [confirmada, cancelada],
      month: setembro,
      asOf: hoje,
    });

    expect(planejado).toEqual([]);
  });

  it("marca como atrasado o que venceu sem confirmação", () => {
    const vencida = anObligation({ ...luz, dueDate: on("2026-09-05") });

    const planejado = plannedEntriesInMonth({
      obligations: [vencida, salario],
      month: setembro,
      asOf: hoje,
    });

    expect(planejado[0]?.late).toBe(true);
    expect(planejado[1]?.late).toBe(false);
  });

  it("ignora outros meses", () => {
    const outubro = anObligation({ ...luz, competenceDate: on("2026-10-01") });

    expect(plannedEntriesInMonth({ obligations: [outubro], month: setembro, asOf: hoje })).toEqual(
      [],
    );
  });

  it("soma entradas e saídas separadamente", () => {
    const totais = plannedTotals(
      plannedEntriesInMonth({ obligations: [salario, luz], month: setembro, asOf: hoje }),
    );

    expect(totais.toReceive).toEqual(brl(2000));
    expect(totais.toPay).toEqual(brl(180));
  });
});
