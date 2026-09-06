import { describe, expect, it } from "vitest";
import { calendarDate } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import { buildCommittedInstallments } from "./committed-installments";
import type { CardPurchase, CreditCard } from "./credit-card";

/**
 * O número que a tela de cartões não dava.
 *
 * Cada parcelamento já aparecia numa linha. O que faltava era a soma: quanto
 * de cada mês à frente já tem dono, e quando isso alivia.
 */
const asOf = calendarDate("2026-09-20");

const card: CreditCard = {
  id: "card-a",
  householdId: "h1",
  name: "Nubank",
  creditLimit: money(500000),
  closingDay: 25,
  dueDay: 5,
  visibility: "HOUSEHOLD",
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdBy: "u1",
} as unknown as CreditCard;

const purchase = (
  id: string,
  total: number,
  installments: number,
  purchaseDate: string,
): CardPurchase =>
  ({
    id,
    householdId: "h1",
    creditCardId: "card-a",
    description: id,
    totalAmount: money(total),
    purchaseDate: calendarDate(purchaseDate),
    competenceDate: calendarDate(purchaseDate),
    categoryId: "outros-gastos",
    installmentCount: installments,
    visibility: "HOUSEHOLD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  }) as unknown as CardPurchase;

describe("buildCommittedInstallments", () => {
  it("soma as parcelas de compras diferentes que caem no mesmo mês", () => {
    const result = buildCommittedInstallments({
      cards: [card],
      purchases: [
        purchase("geladeira", 120000, 10, "2026-09-10"),
        purchase("pneus", 60000, 10, "2026-09-12"),
      ],
      asOf,
    });

    const comParcela = result.months.filter((month) => month.amount.amount > 0);

    // R$ 120 + R$ 60 por mês, duas compras em cada.
    expect(comParcela[0]?.amount).toEqual(money(18000));
    expect(comParcela[0]?.purchaseCount).toBe(2);
  });

  it("diz quando o compromisso acaba e qual é o primeiro mês livre", () => {
    const result = buildCommittedInstallments({
      cards: [card],
      purchases: [purchase("geladeira", 60000, 3, "2026-09-10")],
      asOf,
    });

    expect(result.lastCommittedMonth).toBe("2026-11");
    expect(result.firstFreeMonth).toBe("2026-12");
  });

  it("aponta o mês que mais pesa", () => {
    const result = buildCommittedInstallments({
      cards: [card],
      purchases: [
        purchase("longa", 120000, 12, "2026-09-10"),
        // Esta só cobre três meses: eles somam mais que os demais.
        purchase("curta", 90000, 3, "2026-09-10"),
      ],
      asOf,
    });

    expect(result.heaviestMonth?.month).toBe("2026-09");
    expect(result.heaviestMonth?.purchaseCount).toBe(2);
  });

  it("conta no total o que passa do horizonte, sem inventar coluna para isso", () => {
    const result = buildCommittedInstallments({
      cards: [card],
      purchases: [purchase("longa", 240000, 24, "2026-09-10")],
      asOf,
      horizonMonths: 12,
    });

    expect(result.months).toHaveLength(12);
    // As 24 parcelas inteiras entram no total.
    expect(result.totalRemaining).toEqual(money(240000));
  });

  it("ignora compra à vista: ela não compromete mês nenhum à frente", () => {
    const result = buildCommittedInstallments({
      cards: [card],
      purchases: [purchase("mercado", 42000, 1, "2026-09-10")],
      asOf,
    });

    expect(result.totalRemaining).toEqual(money(0));
    expect(result.lastCommittedMonth).toBeNull();
  });

  it("devolve zeros quando não há nada parcelado", () => {
    const result = buildCommittedInstallments({ cards: [card], purchases: [], asOf });

    expect(result.totalRemaining).toEqual(money(0));
    expect(result.heaviestMonth).toBeNull();
    expect(result.averageWhileCommitted).toEqual(money(0));
    expect(result.firstFreeMonth).toBe("2026-09");
  });
});
