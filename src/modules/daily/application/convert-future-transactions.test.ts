import { describe, expect, it } from "vitest";
import { anExpense, anIncome, aTransfer, on } from "@/modules/shared/testing/builders";
import { futureTransactions } from "./convert-future-transactions";

/**
 * O que a conversão pode tocar.
 *
 * Escolher errado aqui é caro nos dois sentidos: deixar de fora um lançamento
 * futuro o mantém fora do saldo e fora da projeção; incluir um que não devia
 * apaga um documento que outra coisa referencia.
 */
const HOJE = on("2026-09-09");

describe("futureTransactions", () => {
  it("pega receita e despesa com data ainda por vir", () => {
    const salario = anIncome({ id: "tx-1", transactionDate: on("2026-09-30") });
    const conta = anExpense({ id: "tx-2", transactionDate: on("2026-09-25") });

    const pendentes = futureTransactions([salario, conta], HOJE);

    expect(pendentes.map((t) => t.id)).toEqual(["tx-1", "tx-2"]);
  });

  it("deixa em paz o que já aconteceu", () => {
    const ontem = anExpense({ id: "tx-ontem", transactionDate: on("2026-09-08") });

    expect(futureTransactions([ontem], HOJE)).toEqual([]);
  });

  it("não toca no que aconteceu hoje", () => {
    // A fronteira é inclusiva: um lançamento de hoje já é dinheiro movido.
    const hoje = anIncome({ id: "tx-hoje", transactionDate: HOJE });

    expect(futureTransactions([hoje], HOJE)).toEqual([]);
  });

  it("ignora transferência, que não é plano de ninguém", () => {
    const transferencia = aTransfer({ id: "tx-tr", transactionDate: on("2026-09-30") });

    expect(futureTransactions([transferencia], HOJE)).toEqual([]);
  });

  it("preserva o lançamento que liquidou uma conta", () => {
    // Ele é a prova de que a conta foi paga; convertê-lo apagaria essa prova e
    // deixaria a obrigação quitada sem nada por trás.
    const liquidacao = anIncome({
      id: "tx-liq",
      transactionDate: on("2026-09-30"),
      settlesObligationId: "ob-1",
    });

    expect(futureTransactions([liquidacao], HOJE)).toEqual([]);
  });
});
