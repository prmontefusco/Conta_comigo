import { describe, expect, it } from "vitest";
import { anAccount, anExpense, anIncome, aTransfer, brl, on } from "@/modules/shared/testing/builders";
import {
  ACCOUNT_TYPE_LABELS,
  computeBalance,
  computeBalances,
  totalCash,
  totalOverdraftLimit,
} from "./account";

describe("domínio de contas financeiras (account)", () => {
  const contaCorrente = anAccount({
    id: "acc-corrente",
    name: "Banco do Brasil",
    type: "CHECKING",
    openingBalance: brl(1000),
    openingBalanceDate: on("2026-08-01"),
    overdraftLimit: brl(1500),
    includeInTotals: true,
    archived: false,
  });

  const contaPoupanca = anAccount({
    id: "acc-poupanca",
    name: "Poupança Caixa",
    type: "SAVINGS",
    openingBalance: brl(5000),
    openingBalanceDate: on("2026-08-01"),
    includeInTotals: true,
    archived: false,
  });

  const contaExcluida = anAccount({
    id: "acc-antiga",
    name: "Conta Antiga",
    type: "CHECKING",
    openingBalance: brl(200),
    openingBalanceDate: on("2026-08-01"),
    includeInTotals: false, // Fora do totalizador
    archived: false,
  });

  const transactions = [
    anIncome({
      accountId: "acc-corrente",
      amount: brl(3000),
      transactionDate: on("2026-08-05"),
    }),
    anExpense({
      accountId: "acc-corrente",
      amount: brl(800),
      transactionDate: on("2026-08-10"),
    }),
    aTransfer({
      fromAccountId: "acc-corrente",
      toAccountId: "acc-poupanca",
      amount: brl(1200),
      transactionDate: on("2026-08-15"),
    }),
  ];

  it("calcula saldo histórico baseado no saldo inicial e transações acumuladas", () => {
    // Inicial: 1000 + Entrada: 3000 - Saída: 800 - Transferência enviada: 1200 = 2000
    const saldoCorrente = computeBalance(contaCorrente, transactions);
    expect(saldoCorrente).toEqual(brl(2000));

    // Poupança: Inicial 5000 + Transferência recebida 1200 = 6200
    const saldoPoupanca = computeBalance(contaPoupanca, transactions);
    expect(saldoPoupanca).toEqual(brl(6200));
  });

  it("permite calcular o saldo até uma data de corte retroativa (asOf)", () => {
    // Até 08/08: Inicial 1000 + Entrada 3000 = 4000 (ignora saída de 10/08 e transf de 15/08)
    const saldoAte8 = computeBalance(contaCorrente, transactions, on("2026-08-08"));
    expect(saldoAte8).toEqual(brl(4000));
  });

  it("calcula mapa de saldos e o total em caixa disponível", () => {
    const accounts = [contaCorrente, contaPoupanca, contaExcluida];
    const balances = computeBalances(accounts, transactions);

    expect(balances.get("acc-corrente")).toEqual(brl(2000));
    expect(balances.get("acc-poupanca")).toEqual(brl(6200));

    // Total em caixa considera apenas contas ativas com includeInTotals = true
    // 2000 + 6200 = 8200 (exclui acc-antiga de 200)
    expect(totalCash(accounts, balances)).toEqual(brl(8200));
  });

  it("calcula o limite total de cheque especial separadamente do caixa", () => {
    const accounts = [contaCorrente, contaPoupanca];
    expect(totalOverdraftLimit(accounts)).toEqual(brl(1500));
  });

  it("possui dicionário legível de tipos de conta em português", () => {
    expect(ACCOUNT_TYPE_LABELS.CHECKING).toBe("Conta corrente");
    expect(ACCOUNT_TYPE_LABELS.SAVINGS).toBe("Poupança");
    expect(ACCOUNT_TYPE_LABELS.WALLET).toBe("Carteira digital");
  });
});
