import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import { on, brl, anAccount, aCreditCard, aDebt, anExpense, aRecurringRule, aReserve } from "@/modules/shared/testing/builders";
import type { Category } from "@/modules/categories/domain/category";
import {
  buildAccountsCsv,
  buildCardsCsv,
  buildDebtsCsv,
  buildRecurringCsv,
  buildReservesCsv,
  buildTransactionsCsv,
  escapeCsv,
  formatMoneyCsv,
  UTF8_BOM,
} from "./export-csv";

describe("export-csv", () => {
  it("formata dinheiro no padrão brasileiro para Excel", () => {
    expect(formatMoneyCsv(money(123456))).toBe("1234,56");
    expect(formatMoneyCsv(money(5000))).toBe("50,00");
    expect(formatMoneyCsv(money(0))).toBe("0,00");
  });

  it("escapa células com ponto-e-vírgula e aspas", () => {
    expect(escapeCsv("Normal")).toBe("Normal");
    expect(escapeCsv("Mercado; feira")).toBe('"Mercado; feira"');
    expect(escapeCsv('Nota "fiscal"')).toBe('"Nota ""fiscal"""');
    expect(escapeCsv(null)).toBe("");
  });

  it("gera CSV de transações com UTF-8 BOM e cabeçalhos em português", () => {
    const expense = anExpense({
      id: "t1",
      competenceDate: on("2026-09-10"),
      transactionDate: on("2026-09-10"),
      description: "Supermercado Semanal",
      categoryId: "cat-alim",
      accountId: "acc-1",
      amount: brl(350),
      notes: "Compra do mês",
    });

    const category: Category = {
      id: "cat-alim",
      householdId: "household-a",
      name: "Alimentação",
      kind: "EXPENSE",
      isSystem: true,
      archived: false,
      sortOrder: 1,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      createdBy: expense.createdBy,
    };

    const account = anAccount({
      id: "acc-1",
      name: "Nubank",
      institution: "Nubank",
      openingBalance: brl(1000),
    });

    const csv = buildTransactionsCsv([expense], [category], [account]);

    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toContain("Data de Competência;Tipo de Lançamento;Descrição;Categoria;Conta Bancária;Valor (R$);Moeda;Observações");
    expect(csv).toContain("2026-09-10;Despesa;Supermercado Semanal;Alimentação;Nubank;350,00;BRL;Compra do mês");
  });

  it("gera CSV de contas bancárias", () => {
    const account = anAccount({
      id: "acc-1",
      name: "Itaú Corrente",
      institution: "Banco Itaú",
      openingBalance: brl(500),
    });

    const csv = buildAccountsCsv([account]);

    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toContain("Itaú Corrente;Banco Itaú;Conta Corrente;500,00;BRL");
  });

  it("gera CSV de dívidas com status e parcelas", () => {
    const debt = aDebt({
      id: "d1",
      description: "Empréstimo Pessoal",
      institution: "Banco Santander",
      kind: "PERSONAL_LOAN",
      principalContracted: brl(12000),
      installmentAmount: brl(500),
      installmentCount: 24,
      firstDueDate: on("2026-02-10"),
      interestRateMonthly: 2.5,
    });

    const paidMap = new Map([["d1", [1, 2, 3]]]);
    const csv = buildDebtsCsv([debt], paidMap);

    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toContain("Empréstimo Pessoal;Banco Santander;Empréstimo Pessoal;12000,00;500,00;24;3;2026-02-10;2.5%");
  });

  it("gera CSV de cartões de crédito", () => {
    const card = aCreditCard({
      id: "c1",
      name: "Cartão Black",
      brand: "Mastercard",
      creditLimit: brl(15000),
      closingDay: 25,
      dueDay: 5,
    });

    const csv = buildCardsCsv([card]);

    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toContain("Cartão Black;Mastercard;15000,00;25;5");
  });

  it("gera CSV de regras recorrentes e reservas", () => {
    const rule = aRecurringRule({
      id: "r1",
      direction: "OUTFLOW",
      description: "Netflix",
      amount: brl(55.9),
      dayOfMonth: 15,
      frequency: "MONTHLY",
      active: true,
    });

    const csvRec = buildRecurringCsv([rule]);
    expect(csvRec).toContain("Netflix;Despesa Fixa;Sem categoria;55,90;Mensal;15;Sim");

    const reserve = aReserve({
      id: "res1",
      name: "Colchão de Emergência",
      currentAmount: brl(10000),
      targetAmount: brl(15000),
      isProtected: true,
    });

    const csvRes = buildReservesCsv([reserve]);
    expect(csvRes).toContain("Reserva Financeira;Colchão de Emergência;10000,00;15000,00;Ativa");
  });
});
