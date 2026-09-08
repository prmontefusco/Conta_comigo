import { describe, expect, it } from "vitest";
import { instant } from "@/core/date/calendar-date";
import { anObligation, brl, on } from "@/modules/shared/testing/builders";
import {
  byUrgency,
  cancel,
  displayStatus,
  isOpen,
  isOverdue,
  projectedCashDelta,
  remainingAmount,
  settle,
  summarise,
  unsettle,
} from "./obligation";

const NOW = instant("2026-09-08T10:00:00.000Z");
const TODAY = on("2026-09-08");

describe("ciclo de vida de obrigações (obligation)", () => {
  const conta = anObligation({
    id: "ob-luz",
    amount: brl(250),
    dueDate: on("2026-09-10"),
    status: "SCHEDULED",
    settledAmount: brl(0),
  });

  describe("status e atrasos derivados", () => {
    it("deriva status OVERDUE para contas com vencimento no passado sem alterar o banco", () => {
      const atrasada = anObligation({ dueDate: on("2026-09-05"), status: "SCHEDULED" });
      expect(displayStatus(atrasada, TODAY)).toBe("OVERDUE");
      expect(isOverdue(atrasada, TODAY)).toBe(true);
      expect(isOpen(atrasada)).toBe(true);
    });

    it("mantém status SCHEDULED para vencimento futuro e SETTLED para conta já paga", () => {
      expect(displayStatus(conta, TODAY)).toBe("SCHEDULED");
      expect(isOverdue(conta, TODAY)).toBe(false);

      const quitada = anObligation({ dueDate: on("2026-09-01"), status: "SETTLED" });
      expect(displayStatus(quitada, TODAY)).toBe("SETTLED");
      expect(isOverdue(quitada, TODAY)).toBe(false);
      expect(isOpen(quitada)).toBe(false);
    });
  });

  describe("saldos restantes e fluxo projetado", () => {
    it("calcula remainingAmount subtraindo o valor já liquidado", () => {
      const parcial = anObligation({ amount: brl(500), settledAmount: brl(200) });
      expect(remainingAmount(parcial)).toEqual(brl(300));
    });

    it("gera projectedCashDelta negativo para saídas e positivo para entradas", () => {
      const despesa = anObligation({
        direction: "OUTFLOW",
        amount: brl(300),
        settledAmount: brl(0),
      });
      expect(projectedCashDelta(despesa)).toEqual({ amount: -30000, currency: "BRL" });

      const receita = anObligation({
        direction: "INFLOW",
        amount: brl(1200),
        settledAmount: brl(0),
      });
      expect(projectedCashDelta(receita)).toEqual(brl(1200));
    });
  });

  describe("liquidação parcial e total (settle / unsettle)", () => {
    it("permite liquidação parcial mantendo a obrigação aberta como PARTIALLY_SETTLED", () => {
      const parcialmentePaga = settle(conta, {
        transactionId: "tx-1",
        amount: brl(100),
        at: NOW,
      });

      expect(parcialmentePaga.status).toBe("PARTIALLY_SETTLED");
      expect(parcialmentePaga.settledAmount).toEqual(brl(100));
      expect(remainingAmount(parcialmentePaga)).toEqual(brl(150));
      expect(parcialmentePaga.settlementTransactionIds).toEqual(["tx-1"]);
      expect(parcialmentePaga.settledAt).toBeUndefined();
    });

    it("conclui a obrigação como SETTLED ao atingir o valor total", () => {
      const totalmentePaga = settle(conta, {
        transactionId: "tx-2",
        amount: brl(250),
        at: NOW,
      });

      expect(totalmentePaga.status).toBe("SETTLED");
      expect(totalmentePaga.settledAmount).toEqual(brl(250));
      expect(remainingAmount(totalmentePaga)).toEqual(brl(0));
      expect(totalmentePaga.settledAt).toBe(NOW);
    });

    it("reverte liquidação via unsettle restaurando o saldo pendente", () => {
      const paga = settle(conta, { transactionId: "tx-1", amount: brl(250), at: NOW });
      const estornada = unsettle(paga, "tx-1", brl(250), NOW);

      expect(estornada.status).toBe("SCHEDULED");
      expect(estornada.settledAmount).toEqual(brl(0));
      expect(estornada.settlementTransactionIds).toEqual([]);
      expect(estornada.settledAt).toBeUndefined();
    });

    it("recusa liquidação de obrigação cancelada ou com valor inválido", () => {
      const cancelada = cancel(conta, NOW);
      expect(() => settle(cancelada, { transactionId: "tx-1", amount: brl(50), at: NOW })).toThrow();
      expect(() => settle(conta, { transactionId: "tx-1", amount: brl(0), at: NOW })).toThrow();
    });
  });

  describe("sumário e ordenação por urgência (summarise & byUrgency)", () => {
    const ob1Atrasada = anObligation({
      id: "ob-1",
      dueDate: on("2026-09-02"),
      amount: brl(100),
      direction: "OUTFLOW",
    });
    const ob2Hoje = anObligation({
      id: "ob-2",
      dueDate: TODAY,
      amount: brl(200),
      direction: "OUTFLOW",
    });
    const ob3Futura = anObligation({
      id: "ob-3",
      dueDate: on("2026-09-20"),
      amount: brl(500),
      direction: "OUTFLOW",
    });

    it("totaliza obrigações em atrasadas, vencendo hoje e futuras", () => {
      const resumo = summarise([ob1Atrasada, ob2Hoje, ob3Futura], TODAY, "OUTFLOW");

      expect(resumo.overdue).toEqual(brl(100));
      expect(resumo.dueToday).toEqual(brl(200));
      expect(resumo.upcoming).toEqual(brl(500));
      expect(resumo.total).toEqual(brl(800));
      expect(resumo.count).toBe(3);
    });

    it("ordena pela data de vencimento mais próxima e desempata pelo maior valor", () => {
      const ob2BHojeMaior = anObligation({
        id: "ob-2b",
        dueDate: TODAY,
        amount: brl(800),
      });

      const lista = [ob3Futura, ob2Hoje, ob1Atrasada, ob2BHojeMaior];
      lista.sort(byUrgency);

      expect(lista.map((o) => o.id)).toEqual(["ob-1", "ob-2b", "ob-2", "ob-3"]);
    });
  });
});
