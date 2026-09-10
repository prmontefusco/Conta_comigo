import { describe, expect, it } from "vitest";
import { calendarDate } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import type { Account } from "@/modules/accounts/domain/account";
import type { Category } from "@/modules/categories/domain/category";
import type { Transaction } from "@/modules/transactions/domain/transaction";
import {
  buildQuickEntry,
  suggestQuickAccount,
  suggestQuickCategories,
  suggestQuickIncomeAccount,
  suggestQuickIncomeCategories,
} from "./quick-entry";

/**
 * O cálculo que decide esta tela não é financeiro: registrar precisa custar
 * menos do que não registrar. Estes testes guardam os padrões que fazem sobrar
 * dois toques — e a regra de nunca adivinhar a categoria, que é o único campo
 * em que errar sai caro.
 */
const asOf = calendarDate("2026-09-20");

const category = (id: string, name: string, sortOrder: number, kind = "EXPENSE"): Category =>
  ({
    id,
    householdId: "h1",
    name,
    kind,
    isSystem: true,
    archived: false,
    sortOrder,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  }) as unknown as Category;

const account = (id: string, type = "CHECKING", archived = false): Account =>
  ({
    id,
    householdId: "h1",
    name: id,
    type,
    openingBalance: money(0),
    openingBalanceDate: asOf,
    visibility: "HOUSEHOLD",
    includeInTotals: true,
    archived,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  }) as unknown as Account;

const expense = (id: string, categoryId: string, date: string, accountId = "conta"): Transaction =>
  ({
    id,
    householdId: "h1",
    kind: "EXPENSE",
    amount: money(1000),
    transactionDate: calendarDate(date),
    competenceDate: calendarDate(date),
    description: id,
    accountId,
    categoryId,
    visibility: "HOUSEHOLD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  }) as unknown as Transaction;

describe("suggestQuickCategories", () => {
  const categories = [
    category("alimentacao", "Alimentação", 0),
    category("transporte", "Transporte", 1),
    category("saude", "Saúde", 2),
    category("lazer", "Lazer", 3),
    category("salario", "Salário", 4, "INCOME"),
  ];

  it("ordena pelo que a casa mais usa, não pelo maior valor", () => {
    const result = suggestQuickCategories({
      categories,
      transactions: [
        expense("t1", "transporte", "2026-09-18"),
        expense("t2", "transporte", "2026-09-17"),
        expense("t3", "transporte", "2026-09-16"),
        expense("t4", "saude", "2026-09-15"),
      ],
      asOf,
    });

    expect(result[0]?.category.id).toBe("transporte");
    expect(result[0]?.uses).toBe(3);
    expect(result[1]?.category.id).toBe("saude");
  });

  it("não oferece categoria de receita num atalho de gasto", () => {
    const result = suggestQuickCategories({ categories, transactions: [], asOf });

    expect(result.map((item) => item.category.id)).not.toContain("salario");
  });

  it("ignora uso antigo demais para descrever o hábito de hoje", () => {
    const result = suggestQuickCategories({
      categories,
      transactions: [expense("velho", "lazer", "2026-01-10")],
      asOf,
    });

    expect(result.find((item) => item.category.id === "lazer")?.uses).toBe(0);
  });

  it("casa nova cai na ordem padrão, em vez de mostrar fileira vazia", () => {
    const result = suggestQuickCategories({ categories, transactions: [], asOf, limit: 3 });

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.category.id)).toEqual(["alimentacao", "transporte", "saude"]);
  });

  it("conta o gasto lançado hoje, que é o caso do lançamento rápido", () => {
    const result = suggestQuickCategories({
      categories,
      // Mesmo dia de `asOf`: idade zero. É exatamente o que acontece quando
      // alguém acaba de lançar pela barra rápida.
      transactions: [expense("hoje", "lazer", "2026-09-20")],
      asOf,
    });

    expect(result[0]?.category.id).toBe("lazer");
    expect(result[0]?.uses).toBe(1);
  });

  it("deixa de fora categoria arquivada", () => {
    const arquivada = { ...category("antiga", "Antiga", 9), archived: true } as Category;
    const result = suggestQuickCategories({
      categories: [...categories, arquivada],
      transactions: [expense("t1", "antiga", "2026-09-18")],
      asOf,
    });

    expect(result.map((item) => item.category.id)).not.toContain("antiga");
  });
});

describe("suggestQuickAccount", () => {
  it("usa a conta do último gasto", () => {
    const result = suggestQuickAccount({
      accounts: [account("conta"), account("carteira", "CASH")],
      transactions: [
        expense("t1", "alimentacao", "2026-09-10", "conta"),
        expense("t2", "alimentacao", "2026-09-18", "carteira"),
      ],
      asOf,
    });

    expect(result?.id).toBe("carteira");
  });

  it("sem histórico, prefere a conta corrente", () => {
    const result = suggestQuickAccount({
      accounts: [account("carteira", "CASH"), account("conta", "CHECKING")],
      transactions: [],
      asOf,
    });

    expect(result?.id).toBe("conta");
  });

  it("nunca sugere conta arquivada", () => {
    const result = suggestQuickAccount({
      accounts: [account("antiga", "CHECKING", true), account("conta")],
      transactions: [expense("t1", "alimentacao", "2026-09-18", "antiga")],
      asOf,
    });

    expect(result?.id).toBe("conta");
  });

  it("devolve null quando não há conta cadastrada", () => {
    expect(suggestQuickAccount({ accounts: [], transactions: [], asOf })).toBeNull();
  });
});

describe("buildQuickEntry", () => {
  const alimentacao = category("alimentacao", "Alimentação", 0);
  const conta = account("conta");

  it("monta o lançamento com o que foi tocado e o resto deduzido", () => {
    const result = buildQuickEntry({
      amount: money(1200),
      category: alimentacao,
      account: conta,
      asOf,
    });

    expect("draft" in result).toBe(true);
    if (!("draft" in result)) return;

    expect(result.draft.amount).toEqual(money(1200));
    expect(result.draft.categoryId).toBe("alimentacao");
    expect(result.draft.accountId).toBe("conta");
    expect(result.draft.date).toBe(asOf);
  });

  it("usa o nome da categoria quando a descrição fica em branco", () => {
    const result = buildQuickEntry({
      amount: money(1200),
      category: alimentacao,
      account: conta,
      asOf,
    });

    if (!("draft" in result)) throw new Error("esperava um rascunho");
    expect(result.draft.description).toBe("Alimentação");
  });

  it("respeita a descrição digitada", () => {
    const result = buildQuickEntry({
      amount: money(1200),
      category: alimentacao,
      account: conta,
      asOf,
      description: "  Pão e leite  ",
    });

    if (!("draft" in result)) throw new Error("esperava um rascunho");
    expect(result.draft.description).toBe("Pão e leite");
  });

  it("diz o que falta em vez de gravar pela metade", () => {
    const semValor = buildQuickEntry({
      amount: null,
      category: alimentacao,
      account: conta,
      asOf,
    });
    const semCategoria = buildQuickEntry({
      amount: money(1200),
      category: null,
      account: conta,
      asOf,
    });
    const semConta = buildQuickEntry({
      amount: money(1200),
      category: alimentacao,
      account: null,
      asOf,
    });

    expect(semValor).toEqual({ problem: "NO_AMOUNT" });
    expect(semCategoria).toEqual({ problem: "NO_CATEGORY" });
    expect(semConta).toEqual({ problem: "NO_ACCOUNT" });
  });

  it("recusa valor zero ou negativo", () => {
    expect(
      buildQuickEntry({ amount: money(0), category: alimentacao, account: conta, asOf }),
    ).toEqual({ problem: "NO_AMOUNT" });
  });
});

describe("suggestQuickIncomeCategories", () => {
  const categories = [
    category("alimentacao", "Alimentação", 0, "EXPENSE"),
    category("salario", "Salário", 1, "INCOME"),
    category("renda-extra", "Renda extra", 2, "INCOME"),
    category("outras", "Outras receitas", 3, "INCOME"),
  ];

  const incomeTx = (id: string, categoryId: string, date: string, accountId = "conta"): Transaction =>
    ({
      id,
      householdId: "h1",
      kind: "INCOME",
      amount: money(5000),
      transactionDate: calendarDate(date),
      competenceDate: calendarDate(date),
      description: id,
      accountId,
      categoryId,
      visibility: "HOUSEHOLD",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
    }) as unknown as Transaction;

  it("retorna somente categorias de entrada", () => {
    const result = suggestQuickIncomeCategories({ categories, transactions: [], asOf });
    expect(result.map((r) => r.category.id)).not.toContain("alimentacao");
    expect(result.map((r) => r.category.id)).toContain("salario");
  });

  it("ordena por frequência recente de entradas", () => {
    const result = suggestQuickIncomeCategories({
      categories,
      transactions: [
        incomeTx("i1", "renda-extra", "2026-09-18"),
        incomeTx("i2", "renda-extra", "2026-09-15"),
        incomeTx("i3", "salario", "2026-09-05"),
      ],
      asOf,
    });

    expect(result[0]?.category.id).toBe("renda-extra");
    expect(result[0]?.uses).toBe(2);
  });
});

describe("suggestQuickIncomeAccount", () => {
  const conta1 = account("banco-a");
  const conta2 = account("banco-b");

  it("sugere a conta onde a última entrada ocorreu", () => {
    const incomeTx = (id: string, accountId: string, date: string): Transaction =>
      ({
        id,
        householdId: "h1",
        kind: "INCOME",
        amount: money(1000),
        transactionDate: calendarDate(date),
        competenceDate: calendarDate(date),
        description: id,
        accountId,
        visibility: "HOUSEHOLD",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        createdBy: "u1",
      }) as unknown as Transaction;

    const result = suggestQuickIncomeAccount({
      accounts: [conta1, conta2],
      transactions: [incomeTx("i1", "banco-b", "2026-09-19"), incomeTx("i2", "banco-a", "2026-09-10")],
      asOf,
    });

    expect(result?.id).toBe("banco-b");
  });
});

