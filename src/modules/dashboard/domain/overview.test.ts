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

  /**
   * "Recebido" tem que querer dizer recebido.
   *
   * Um salário lançado para o dia 30 quando hoje é dia 8 é um plano. Contá-lo
   * como realizado fazia este bloco discordar do saldo — que exclui o futuro
   * por `transactionDate` — e da projeção, que nem lê transações. O dinheiro
   * aparecia como certo em um lugar e não existia no outro.
   */
  describe("lançamento com data futura", () => {
    const base = {
      asOf: TODAY,
      accounts: [account],
      obligations: [],
      reserves: [reserve],
      cards: [card],
      cardStatements: [],
      debts: [],
      forecast: mockForecast,
    };

    const salarioFuturo = anIncome({
      id: "tx-futuro",
      amount: brl(2000),
      transactionDate: on("2026-09-30"),
      competenceDate: on("2026-09-30"),
      accountId: "acc-1",
    });

    it("não conta como recebido, conta como previsto", () => {
      const overview = buildOverview({ ...base, transactions: [salarioFuturo] });

      expect(overview.thisMonth.incomeReceived).toEqual(brl(0));
      expect(overview.thisMonth.incomeExpected).toEqual(brl(2000));
    });

    it("não entra no saldo de hoje", () => {
      const overview = buildOverview({ ...base, transactions: [salarioFuturo] });

      expect(overview.today.totalCash).toEqual(brl(5000));
    });

    it("não some do resultado do mês, só muda de coluna", () => {
      // A classificação preserva `expectedResult`. Descartar o lançamento
      // apagaria do aplicativo inteiro o dinheiro que já está cadastrado: o
      // saldo já o exclui e a projeção não o enxerga.
      const futuro = buildOverview({ ...base, transactions: [salarioFuturo] });
      const passado = buildOverview({
        ...base,
        transactions: [
          anIncome({
            id: "tx-passado",
            amount: brl(2000),
            transactionDate: on("2026-09-05"),
            competenceDate: on("2026-09-05"),
            accountId: "acc-1",
          }),
        ],
      });

      expect(futuro.thisMonth.expectedResult).toEqual(passado.thisMonth.expectedResult);
    });

    it("uma despesa futura conta como pendente, não como paga", () => {
      const contaFutura = anExpense({
        id: "tx-futura-out",
        amount: brl(180),
        transactionDate: on("2026-09-25"),
        competenceDate: on("2026-09-25"),
        accountId: "acc-1",
      });

      const overview = buildOverview({ ...base, transactions: [contaFutura] });

      expect(overview.thisMonth.expensesPaid).toEqual(brl(0));
      expect(overview.thisMonth.expensesPending).toEqual(brl(180));
    });

    it("o que aconteceu hoje continua sendo realizado", () => {
      // A fronteira é inclusiva: um recebimento de hoje já é dinheiro.
      const salarioHoje = anIncome({
        id: "tx-hoje",
        amount: brl(2000),
        transactionDate: TODAY,
        competenceDate: TODAY,
        accountId: "acc-1",
      });

      const overview = buildOverview({ ...base, transactions: [salarioHoje] });

      expect(overview.thisMonth.incomeReceived).toEqual(brl(2000));
      expect(overview.thisMonth.incomeExpected).toEqual(brl(0));
    });

    it("uma conta de agosto paga hoje conta como paga, apesar da competência antiga", () => {
      // O critério é a data do caixa, não a competência: filtrar pela
      // competência inverteria a pergunta.
      const boletoAtrasado = anExpense({
        id: "tx-atrasado",
        amount: brl(150),
        transactionDate: TODAY,
        competenceDate: on("2026-09-01"),
        accountId: "acc-1",
      });

      const overview = buildOverview({ ...base, transactions: [boletoAtrasado] });

      expect(overview.thisMonth.expensesPaid).toEqual(brl(150));
    });
  });

  it("não conta a fatura duas vezes quando ela já virou obrigação", () => {
    // A dedução por `cardStatementId` existe no motor de projeção desde
    // sempre; este bloco era o único agregador sem ela.
    const faturaMaterializada = anObligation({
      id: "ob-fatura",
      direction: "OUTFLOW",
      amount: brl(800),
      dueDate: on("2026-09-30"),
      competenceDate: on("2026-09-01"),
      origin: "CARD_STATEMENT",
      source: { cardStatementId: "stmt-1" },
    });

    const overview = buildOverview({
      asOf: TODAY,
      accounts: [account],
      transactions: [],
      obligations: [faturaMaterializada],
      reserves: [reserve],
      cards: [card],
      cardStatements: [cardStatement],
      debts: [],
      forecast: mockForecast,
    });

    expect(overview.thisMonth.cardCommitment).toEqual(brl(0));
    expect(overview.thisMonth.expensesPending).toEqual(brl(800));
  });

  it("uma entrada só prevista não aumenta o que é seguro gastar hoje", () => {
    // A fronteira encurta a janela de saídas descontadas, então uma entrada
    // mais próxima libera mais dinheiro. Anotar "meu irmão me paga amanhã" não
    // pode ter esse efeito.
    const comPromessa = {
      ...mockForecast,
      events: [
        {
          date: on("2026-09-09"),
          direction: "INFLOW",
          amount: brl(50),
          description: "Promessa",
          source: "OBLIGATION",
          isDebtCommitment: false,
          competenceMonth: "2026-09",
          confidence: "ESTIMATED",
        },
        ...mockForecast.events,
      ],
    } as unknown as ForecastResult;

    const overview = buildOverview({
      asOf: TODAY,
      accounts: [account],
      transactions: [],
      obligations: [obligationSoon],
      reserves: [reserve],
      cards: [card],
      cardStatements: [cardStatement],
      debts: [debt],
      forecast: comPromessa,
    });

    const safe = safeToSpendToday(overview, comPromessa);

    // A fronteira continua sendo o salário confirmado do dia 20.
    expect(safe.untilDate).toBe(on("2026-09-20"));
    expect(safe.amount).toEqual(brl(2500));
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
