import { describe, expect, it } from "vitest";
import { anAccount, anExpense, anIncome, brl, on } from "@/modules/shared/testing/builders";
import { overdraftGraceStatus } from "./overdraft-grace";

describe("período sem juros do cheque especial (overdraftGraceStatus)", () => {
  const conta = anAccount({
    id: "acc-1",
    openingBalance: brl(1000),
    openingBalanceDate: on("2026-08-01"),
    overdraftLimit: brl(2000),
    overdraftGraceDays: 10,
  });

  it("não avalia nada quando a conta não tem carência configurada", () => {
    const semCarencia = anAccount({ ...conta, overdraftGraceDays: undefined });
    const transactions = [
      anExpense({ accountId: "acc-1", amount: brl(1500), transactionDate: on("2026-09-01") }),
    ];

    expect(overdraftGraceStatus(semCarencia, transactions, on("2026-09-05"))).toBeNull();
  });

  it("não avalia nada quando o saldo de hoje não está negativo", () => {
    const transactions = [
      anExpense({ accountId: "acc-1", amount: brl(500), transactionDate: on("2026-09-01") }),
    ];

    expect(overdraftGraceStatus(conta, transactions, on("2026-09-05"))).toBeNull();
  });

  it("conta os dias corridos negativos, dentro do período de carência", () => {
    // Saldo inicial 1000; gasto de 1500 em 01/09 deixa a conta em -500.
    const transactions = [
      anExpense({ accountId: "acc-1", amount: brl(1500), transactionDate: on("2026-09-01") }),
    ];

    const status = overdraftGraceStatus(conta, transactions, on("2026-09-05"));
    expect(status).toEqual({
      graceDays: 10,
      daysUsed: 5,
      daysRemaining: 5,
      withinGracePeriod: true,
      sinceDate: on("2026-09-01"),
    });
  });

  it("marca fora do período quando os dias negativos passam da carência", () => {
    const transactions = [
      anExpense({ accountId: "acc-1", amount: brl(1500), transactionDate: on("2026-09-01") }),
    ];

    const status = overdraftGraceStatus(conta, transactions, on("2026-09-12"));
    expect(status?.daysUsed).toBe(12);
    expect(status?.withinGracePeriod).toBe(false);
    expect(status?.daysRemaining).toBe(0);
  });

  it("reinicia a contagem quando o saldo volta a ficar positivo antes de negativar de novo", () => {
    const transactions = [
      anExpense({
        id: "tx-1",
        accountId: "acc-1",
        amount: brl(1500),
        transactionDate: on("2026-09-01"),
      }),
      anIncome({
        id: "tx-2",
        accountId: "acc-1",
        amount: brl(1000),
        transactionDate: on("2026-09-03"),
      }),
      anExpense({
        id: "tx-3",
        accountId: "acc-1",
        amount: brl(700),
        transactionDate: on("2026-09-04"),
      }),
    ];

    // 01/09: -500 · 03/09: +500 (positivo, quebra a sequência) · 04/09: -200
    const status = overdraftGraceStatus(conta, transactions, on("2026-09-06"));
    expect(status?.sinceDate).toBe(on("2026-09-04"));
    expect(status?.daysUsed).toBe(3);
  });
});
