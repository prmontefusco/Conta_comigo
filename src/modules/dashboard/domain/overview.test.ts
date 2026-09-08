import { describe, expect, it } from "vitest";
import {
  aCreditCard,
  aDebt,
  anAccount,
  anExpense,
  anIncome,
  anObligation,
  aReserve,
  brl,
  on,
} from "@/modules/shared/testing/builders";
import { buildOverview, cardsOverview, safeToSpendToday } from "./overview";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { CardStatement } from "@/modules/cards/domain/credit-card";

const TODAY = on("2026-09-08");

describe("visão geral do painel (dashboard overview)", () => {
  const account = anAccount({
    id: "acc-1",
    openingBalance: brl(5000),
    openingBalanceDate: on("2026-09-01"),
  });

  const reserve = aReserve({
    id: "res-1",
    currentAmount: brl(1500),
    isProtected: true,
  });

  const card = aCreditCard({
    id: "card-1",
    creditLimit: brl(4000),
  });

  const cardStatement = {
    id: "stmt-1",
    creditCardId: "card-1",
    referenceMonth: "2026-09",
    closingDate: on("2026-09-25"),
    dueDate: on("2026-09-30"),
    status: "OPEN",
    total: brl(800),
    paid: brl(0),
    remainingAmount: brl(800),
    installments: [],
  } as unknown as CardStatement;

  const debt = aDebt({
    id: "debt-1",
    principalContracted: brl(10000),
    firstDueDate: on("2026-09-10"),
    installmentAmount: brl(1000),
    installmentCount: 10,
  });

  const obligationSoon = anObligation({
    id: "ob-soon",
    amount: brl(300),
    dueDate: on("2026-09-11"), // Em 3 dias
    direction: "OUTFLOW",
  });

  const obligationOverdue = anObligation({
    id: "ob-overdue",
    amount: brl(200),
    dueDate: on("2026-09-03"), // Atrasada
    direction: "OUTFLOW",
  });

  const mockForecast = {
    openingBalance: brl(5000),
    horizon: { from: TODAY, to: on("2026-10-08") },
    days: [
      {
        date: TODAY,
        projectedCashBalance: brl(5000),
        freeProjectedBalance: brl(5000),
        inflow: brl(0),
        outflow: brl(0),
        net: brl(0),
        events: [],
      },
      {
        date: on("2026-09-15"),
        projectedCashBalance: brl(3500),
        freeProjectedBalance: brl(3500),
        inflow: brl(0),
        outflow: brl(1500),
        net: brl(-1500),
        events: [],
      },
    ],
    events: [
      {
        date: on("2026-09-10"),
        direction: "OUTFLOW",
        amount: brl(1000),
        description: "Parcela Empréstimo",
        source: "DEBT_INSTALLMENT",
        isDebtCommitment: true,
        competenceMonth: "2026-09",
        confidence: "CONFIRMED",
      },
      {
        date: on("2026-09-20"),
        direction: "INFLOW",
        amount: brl(4000),
        description: "Salário Adiantamento",
        source: "OBLIGATION",
        isDebtCommitment: false,
        competenceMonth: "2026-09",
        confidence: "CONFIRMED",
      },
    ],
  } as unknown as ForecastResult;

  it("monta visão completa de saldo, reservas protegidas e dinheiro livre", () => {
    const txIncome = anIncome({
      amount: brl(4500),
      competenceDate: on("2026-09-05"),
      transactionDate: on("2026-09-05"),
      accountId: "acc-1",
    });
    const txExpense = anExpense({
      amount: brl(1200),
      competenceDate: on("2026-09-06"),
      transactionDate: on("2026-09-06"),
      accountId: "acc-1",
    });

    const obligationInflow = anObligation({
      id: "ob-inflow",
      amount: brl(1500),
      dueDate: on("2026-09-18"),
      competenceDate: on("2026-09-18"),
      direction: "INFLOW",
      status: "SCHEDULED",
    });

    const overview = buildOverview({
      asOf: TODAY,
      accounts: [account],
      transactions: [txIncome, txExpense],
      obligations: [obligationSoon, obligationOverdue, obligationInflow],
      reserves: [reserve],
      cards: [card],
      cardStatements: [cardStatement],
      debts: [debt],
      forecast: mockForecast,
    });

    // Caixa total: 5000 + 4500 (income) - 1200 (expense) = 8300
    expect(overview.today.totalCash).toEqual(brl(8300));
    // Reserva protegida: 1500
    expect(overview.today.protectedReserve).toEqual(brl(1500));
    // Dinheiro gastável: 8300 - 1500 = 6800
    expect(overview.today.spendableCash).toEqual(brl(6800));

    // Vencendo nos próximos 7 dias
    expect(overview.today.dueSoon).toHaveLength(1);
    expect(overview.today.dueSoon[0]!.id).toBe("ob-soon");

    // Atrasadas
    expect(overview.today.overdue).toHaveLength(1);
    expect(overview.today.overdue[0]!.id).toBe("ob-overdue");

    // Dívidas
    expect(overview.today.cardDebt).toEqual(brl(800));
    expect(overview.today.totalDebt.amount).toBeGreaterThan(0);

    // Próximos 30 dias
    expect(overview.next30Days.lowestProjectedBalance).toEqual(brl(3500));
  });

  it("calcula quanto é seguro gastar hoje (safeToSpendToday) antes da próxima receita", () => {
    const overview = buildOverview({
      asOf: TODAY,
      accounts: [account],
      transactions: [],
      obligations: [obligationSoon],
      reserves: [reserve],
      cards: [card],
      cardStatements: [cardStatement],
      debts: [debt],
      forecast: mockForecast,
    });

    // spendableCash é 3500, saídas antes do salário em 20/09 somam 1000
    // Saldo seguro para gastar: 3500 - 1000 = 2500
    const safe = safeToSpendToday(overview, mockForecast);
    expect(safe.amount).toEqual(brl(2500));
    expect(safe.untilDate).toBe(on("2026-09-20"));
  });

  it("monta visão de cartões (cardsOverview) calculando o limite e uso de cada um", () => {
    const cards = cardsOverview([card], [cardStatement]);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.card.id).toBe("card-1");
    expect(cards[0]!.status.creditLimit).toEqual(brl(4000));
    expect(cards[0]!.status.committed).toEqual(brl(800));
    expect(cards[0]!.status.available).toEqual(brl(3200));
  });
});
