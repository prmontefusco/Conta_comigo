import { describe, expect, it } from "vitest";
import { monthKey } from "@/core/date/calendar-date";
import { zero } from "@/core/money/money";
import { projectStatements } from "@/modules/cards/domain/credit-card";
import {
  aCardPurchase,
  aCreditCard,
  aDebt,
  anObligation,
  aRecurringRule,
  aTransfer,
  anExpense,
  anIncome,
  brl,
  on,
} from "@/modules/shared/testing/builders";
import type { Budget } from "@/modules/budget/domain/budget";
import type { Transaction } from "@/modules/transactions/domain/transaction";
import {
  averageOf,
  budgetHistory,
  cashFlowByMonth,
  commitmentsByNature,
  debtOutlook,
  recentMonths,
  spendingByCategory,
  spendingTrend,
  upcomingMonths,
} from "./reports";

const TODAY = on("2026-08-28");
const AUDIT = { createdAt: "x" as never, updatedAt: "x" as never, createdBy: "user-1" };

describe("janelas de meses", () => {
  it("lista os últimos meses terminando no mês corrente", () => {
    expect(recentMonths(TODAY, 4)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08"]);
  });

  it("lista os próximos meses a partir do mês corrente", () => {
    expect(upcomingMonths(TODAY, 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });
});

describe("fluxo de caixa realizado", () => {
  const months = [monthKey("2026-07"), monthKey("2026-08")];

  it("separa competência de movimentação", () => {
    const transactions: Transaction[] = [
      anIncome({
        id: "t1",
        amount: brl(5000),
        competenceDate: on("2026-08-05"),
        transactionDate: on("2026-08-05"),
      }),
      anExpense({
        id: "t2",
        amount: brl(300),
        competenceDate: on("2026-08-10"),
        transactionDate: on("2026-08-10"),
      }),
      // Fatura de julho paga em agosto: consumo de julho, caixa de agosto.
      {
        ...AUDIT,
        id: "t3",
        householdId: "household-a",
        kind: "CARD_STATEMENT_PAYMENT",
        amount: brl(900),
        transactionDate: on("2026-08-05"),
        competenceDate: on("2026-07-01"),
        description: "Fatura julho",
        visibility: "HOUSEHOLD",
        accountId: "account-1",
        creditCardId: "card-1",
        statementId: "card-1_2026-07",
      },
    ];

    const [july, august] = cashFlowByMonth(transactions, months);

    // O pagamento da fatura não é consumo em nenhum dos dois meses.
    expect(july?.spending).toEqual(brl(0));
    expect(august?.spending).toEqual(brl(300));

    // Mas o dinheiro saiu em agosto.
    expect(august?.cashOut).toEqual(brl(1200));
    expect(july?.cashOut).toEqual(brl(0));
  });

  it("não conta transferências como entrada nem como saída", () => {
    const transactions = [
      aTransfer({ id: "t1", amount: brl(2000), transactionDate: on("2026-08-10") }),
    ];

    const [, august] = cashFlowByMonth(transactions, months);

    expect(august?.cashIn).toEqual(brl(0));
    expect(august?.cashOut).toEqual(brl(0));
    expect(august?.cashResult).toEqual(brl(0));
  });

  it("conta o empréstimo como entrada de caixa, mas nunca como receita", () => {
    const transactions: Transaction[] = [
      {
        ...AUDIT,
        id: "t1",
        householdId: "household-a",
        kind: "LOAN_DISBURSEMENT",
        amount: brl(10000),
        transactionDate: on("2026-08-01"),
        competenceDate: on("2026-08-01"),
        description: "Empréstimo",
        visibility: "HOUSEHOLD",
        accountId: "account-1",
        debtId: "debt-1",
      },
    ];

    const [, august] = cashFlowByMonth(transactions, months);

    expect(august?.cashIn).toEqual(brl(10000));
    expect(august?.income).toEqual(brl(0));
  });

  it("devolve zeros para meses sem movimento", () => {
    const [july] = cashFlowByMonth([], months);
    expect(july?.income).toEqual(zero());
    expect(july?.result).toEqual(zero());
  });
});

describe("despesas por categoria", () => {
  const transactions = [
    anExpense({
      id: "t1",
      amount: brl(900),
      categoryId: "alimentacao",
      competenceDate: on("2026-08-05"),
    }),
    anExpense({
      id: "t2",
      amount: brl(200),
      categoryId: "transporte",
      competenceDate: on("2026-08-06"),
    }),
    anExpense({
      id: "t3",
      amount: brl(660),
      categoryId: "alimentacao",
      competenceDate: on("2026-07-05"),
    }),
  ];

  const obligations = [
    anObligation({
      id: "o1",
      amount: brl(400),
      categoryId: "alimentacao",
      competenceDate: on("2026-08-20"),
      dueDate: on("2026-08-20"),
    }),
  ];

  it("ordena por total e separa gasto de comprometido", () => {
    const breakdown = spendingByCategory(transactions, obligations, monthKey("2026-08"));

    expect(breakdown.lines[0]?.categoryId).toBe("alimentacao");
    expect(breakdown.lines[0]?.actual).toEqual(brl(900));
    expect(breakdown.lines[0]?.committed).toEqual(brl(400));
    expect(breakdown.lines[0]?.total).toEqual(brl(1300));
    expect(breakdown.total).toEqual(brl(1500));
  });

  it("calcula a participação de cada categoria", () => {
    const breakdown = spendingByCategory(transactions, obligations, monthKey("2026-08"));
    expect(breakdown.lines[0]?.share).toBeCloseTo(1300 / 1500, 5);
  });

  it("compara com o mês anterior", () => {
    const breakdown = spendingByCategory(transactions, obligations, monthKey("2026-08"));
    // Alimentação: 1.300 em agosto contra 660 em julho.
    expect(breakdown.lines[0]?.changeFromPrevious).toEqual(brl(640));
  });

  it("agrupa o que não tem categoria sem inventar uma", () => {
    const semCategoria = anObligation({
      id: "o2",
      amount: brl(100),
      competenceDate: on("2026-08-15"),
    });
    const { categoryId, ...rest } = semCategoria;
    void categoryId;

    const breakdown = spendingByCategory(
      transactions,
      [rest as typeof semCategoria],
      monthKey("2026-08"),
    );
    expect(breakdown.lines.some((line) => line.categoryId === null)).toBe(true);
  });

  it("ignora obrigações já quitadas", () => {
    const settled = anObligation({
      id: "o3",
      amount: brl(999),
      categoryId: "lazer",
      competenceDate: on("2026-08-15"),
      status: "SETTLED",
      settledAmount: brl(999),
    });

    const breakdown = spendingByCategory(transactions, [settled], monthKey("2026-08"));
    expect(breakdown.lines.some((line) => line.categoryId === "lazer")).toBe(false);
  });
});

describe("evolução de gastos", () => {
  const months = ["2026-06", "2026-07", "2026-08"].map(monthKey);

  const transactions = [
    anExpense({
      id: "t1",
      amount: brl(500),
      categoryId: "alimentacao",
      competenceDate: on("2026-06-10"),
    }),
    anExpense({
      id: "t2",
      amount: brl(700),
      categoryId: "alimentacao",
      competenceDate: on("2026-07-10"),
    }),
    anExpense({
      id: "t3",
      amount: brl(600),
      categoryId: "alimentacao",
      competenceDate: on("2026-08-10"),
    }),
    anExpense({
      id: "t4",
      amount: brl(100),
      categoryId: "lazer",
      competenceDate: on("2026-08-12"),
    }),
  ];

  it("acompanha uma categoria mês a mês", () => {
    const trend = spendingTrend(transactions, months, "alimentacao");
    expect(trend.map((point) => point.amount.amount)).toEqual([50000, 70000, 60000]);
  });

  it("soma todas as categorias quando nenhuma é informada", () => {
    const trend = spendingTrend(transactions, months);
    expect(trend.at(-1)?.amount).toEqual(brl(700));
  });

  it("calcula a média ignorando meses sem movimento", () => {
    const trend = spendingTrend(transactions, months, "lazer");
    expect(averageOf(trend)).toEqual(brl(100));
  });

  it("devolve zero quando não há nada", () => {
    expect(averageOf(spendingTrend([], months))).toEqual(zero());
  });
});

describe("compromissos por natureza", () => {
  const month = monthKey("2026-09");

  const rules = [
    aRecurringRule({
      id: "aluguel",
      amount: brl(1800),
      dayOfMonth: 10,
      startDate: on("2026-01-10"),
      expenseNature: "FIXED",
    }),
    aRecurringRule({
      id: "energia",
      amount: brl(300),
      dayOfMonth: 15,
      startDate: on("2026-01-15"),
      expenseNature: "VARIABLE",
    }),
  ];

  it("soma regras e obrigações por natureza", () => {
    const iptu = anObligation({
      id: "iptu",
      amount: brl(900),
      dueDate: on("2026-09-20"),
      competenceDate: on("2026-09-20"),
      expenseNature: "OCCASIONAL",
    });

    const breakdown = commitmentsByNature([iptu], rules, month);

    expect(breakdown.fixed).toEqual(brl(1800));
    expect(breakdown.variable).toEqual(brl(300));
    expect(breakdown.occasional).toEqual(brl(900));
    expect(breakdown.total).toEqual(brl(3000));
    expect(breakdown.fixedShare).toBeCloseTo(0.6, 5);
  });

  it("não conta duas vezes uma regra que já virou obrigação", () => {
    const materialised = anObligation({
      id: "aluguel-set",
      amount: brl(1850),
      dueDate: on("2026-09-10"),
      competenceDate: on("2026-09-10"),
      expenseNature: "FIXED",
      origin: "RECURRING_RULE",
      source: { recurringRuleId: "aluguel", occurrenceKey: "aluguel:2026-09-10" },
    });

    const breakdown = commitmentsByNature([materialised], rules, month);

    // 1.850 do registro concreto, não 1.850 + 1.800.
    expect(breakdown.fixed).toEqual(brl(1850));
  });

  it("ignora entradas", () => {
    const salario = aRecurringRule({
      id: "salario",
      direction: "INFLOW",
      amount: brl(9000),
      dayOfMonth: 5,
      startDate: on("2026-01-05"),
    });

    expect(commitmentsByNature([], [salario], month).total).toEqual(zero());
  });

  it("não quebra quando não há nada no mês", () => {
    const breakdown = commitmentsByNature([], [], monthKey("2030-01"));
    expect(breakdown.total).toEqual(zero());
    expect(breakdown.fixedShare).toBe(0);
  });
});

describe("orçamento ao longo dos meses", () => {
  const months = ["2026-07", "2026-08"].map(monthKey);

  const budgets: Budget[] = [
    {
      ...AUDIT,
      id: "2026-08",
      householdId: "household-a",
      month: monthKey("2026-08"),
      lines: [
        { categoryId: "alimentacao", plannedAmount: brl(1000) },
        { categoryId: "lazer", plannedAmount: brl(300) },
      ],
    },
  ];

  const transactions = [
    anExpense({
      id: "t1",
      amount: brl(1100),
      categoryId: "alimentacao",
      competenceDate: on("2026-08-10"),
    }),
    // Fora do orçamento: não entra no realizado comparável.
    anExpense({
      id: "t2",
      amount: brl(500),
      categoryId: "transporte",
      competenceDate: on("2026-08-11"),
    }),
  ];

  it("mostra planejado, realizado e comprometido", () => {
    const [, august] = budgetHistory(budgets, transactions, [], months);

    expect(august?.planned).toEqual(brl(1300));
    expect(august?.actual).toEqual(brl(1100));
    expect(august?.difference).toEqual(brl(200));
    expect(august?.hasBudget).toBe(true);
  });

  it("mostra o estouro como diferença negativa", () => {
    const committed = [
      anObligation({
        id: "o1",
        amount: brl(400),
        categoryId: "lazer",
        competenceDate: on("2026-08-20"),
        dueDate: on("2026-08-20"),
      }),
    ];

    const [, august] = budgetHistory(budgets, transactions, committed, months);
    expect(august?.committed).toEqual(brl(400));
    expect(august?.difference).toEqual(brl(-200));
  });

  it("marca meses sem orçamento em vez de fingir que estão em dia", () => {
    const [july] = budgetHistory(budgets, transactions, [], months);
    expect(july?.hasBudget).toBe(false);
    expect(july?.planned).toEqual(zero());
  });
});

describe("trajetória do endividamento", () => {
  const debt = aDebt({
    id: "emprestimo",
    description: "Empréstimo pessoal",
    principalContracted: brl(12000),
    installmentCount: 12,
    installmentAmount: brl(1000),
    firstDueDate: on("2026-09-01"),
  });

  const months = ["2026-09", "2026-10", "2026-11"].map(monthKey);

  it("mostra o saldo devedor caindo mês a mês", () => {
    const outlook = debtOutlook([debt], [], months);

    expect(outlook.points[0]?.loans).toEqual(brl(11000));
    expect(outlook.points[1]?.loans).toEqual(brl(10000));
    expect(outlook.points[2]?.loans).toEqual(brl(9000));
  });

  it("resume a redução no período", () => {
    const outlook = debtOutlook([debt], [], months);
    expect(outlook.startingTotal).toEqual(brl(11000));
    expect(outlook.endingTotal).toEqual(brl(9000));
    expect(outlook.reduction).toEqual(brl(2000));
  });

  it("diz quando cada dívida termina", () => {
    const outlook = debtOutlook([debt], [], months);
    expect(outlook.endings).toEqual([{ description: "Empréstimo pessoal", month: "2027-08" }]);
  });

  it("inclui as parcelas de cartão ainda não faturadas", () => {
    const card = aCreditCard({ closingDay: 25, dueDay: 5 });
    const statements = projectStatements(
      card,
      [
        aCardPurchase({
          totalAmount: brl(1200),
          installmentCount: 6,
          purchaseDate: on("2026-08-10"),
        }),
      ],
      [],
      monthKey("2026-08"),
      monthKey("2027-06"),
      TODAY,
    );

    const outlook = debtOutlook([], statements, months);

    // Fecha dia 25, vence dia 5: as seis faturas vencem de set/2026 a fev/2027.
    // Ao fim de setembro restam cinco (out a fev); ao fim de novembro, três.
    expect(outlook.points[0]?.cards).toEqual(brl(1000));
    expect(outlook.points[1]?.cards).toEqual(brl(800));
    expect(outlook.points[2]?.cards).toEqual(brl(600));
  });

  it("mantém a mesma premissa para empréstimo e cartão", () => {
    // Os dois lados assumem pagamento em dia. Se um assumisse e o outro não,
    // a linha do total estaria somando mundos diferentes.
    const card = aCreditCard({ closingDay: 25, dueDay: 5 });
    const statements = projectStatements(
      card,
      [
        aCardPurchase({
          totalAmount: brl(1200),
          installmentCount: 6,
          purchaseDate: on("2026-08-10"),
        }),
      ],
      [],
      monthKey("2026-08"),
      monthKey("2027-06"),
      TODAY,
    );

    const outlook = debtOutlook([debt], statements, months);

    expect(outlook.points[0]?.total).toEqual(brl(12000));
    expect(outlook.points[2]?.total).toEqual(brl(9600));
    expect(outlook.reduction).toEqual(brl(2400));
  });

  it("ignora dívidas já quitadas", () => {
    const outlook = debtOutlook([{ ...debt, status: "SETTLED" }], [], months);
    expect(outlook.startingTotal).toEqual(zero());
    expect(outlook.endings).toEqual([]);
  });
});
