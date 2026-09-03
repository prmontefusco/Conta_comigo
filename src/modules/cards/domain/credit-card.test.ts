import { describe, expect, it } from "vitest";
import { monthKey } from "@/core/date/calendar-date";
import { sum } from "@/core/money/money";
import { aCardPurchase, aCreditCard, brl, on } from "@/modules/shared/testing/builders";
import {
  billingSchedule,
  buildInstallments,
  closingDateFor,
  computeLimitStatus,
  dueDateFor,
  openInstallmentPlans,
  projectStatements,
  splitStatements,
  statementId,
  statementMonthForPurchase,
  totalCardDebt,
} from "./credit-card";

const card = aCreditCard({ closingDay: 25, dueDay: 5, creditLimit: brl(5000) });
const TODAY = on("2026-08-28");

describe("statement calendar", () => {
  it("closes on the configured day", () => {
    expect(closingDateFor(card, monthKey("2026-08"))).toBe("2026-08-25");
  });

  it("clamps the closing day in short months", () => {
    const lateCard = aCreditCard({ closingDay: 31, dueDay: 10 });
    expect(closingDateFor(lateCard, monthKey("2026-02"))).toBe("2026-02-28");
  });

  it("puts the due date in the next month when it falls before the closing day", () => {
    expect(dueDateFor(card, monthKey("2026-08"))).toBe("2026-09-05");
  });

  it("keeps the due date in the same month when it falls after the closing day", () => {
    const sameMonth = aCreditCard({ closingDay: 5, dueDay: 15 });
    expect(dueDateFor(sameMonth, monthKey("2026-08"))).toBe("2026-08-15");
  });
});

describe("which statement a purchase lands in", () => {
  it("uses the current statement for a purchase before the closing date", () => {
    expect(statementMonthForPurchase(card, on("2026-08-10"))).toBe("2026-08");
  });

  it("includes a purchase made exactly on the closing date", () => {
    expect(statementMonthForPurchase(card, on("2026-08-25"))).toBe("2026-08");
  });

  it("rolls a purchase made after the closing date into the next statement", () => {
    expect(statementMonthForPurchase(card, on("2026-08-26"))).toBe("2026-09");
    expect(statementMonthForPurchase(card, on("2026-08-31"))).toBe("2026-09");
  });
});

describe("installments", () => {
  it("splits R$ 1.200 in 6 parts of exactly R$ 200", () => {
    const purchase = aCardPurchase({ totalAmount: brl(1200), installmentCount: 6 });
    const installments = buildInstallments(purchase, card);

    expect(installments).toHaveLength(6);
    expect(installments.every((item) => item.amount.amount === 20000)).toBe(true);
    expect(sum(installments.map((item) => item.amount))).toEqual(brl(1200));
  });

  it("spreads the installments across consecutive statements", () => {
    const purchase = aCardPurchase({
      purchaseDate: on("2026-08-10"),
      totalAmount: brl(1200),
      installmentCount: 6,
    });
    expect(buildInstallments(purchase, card).map((item) => item.statementMonth)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("gives each installment the due date of its own statement", () => {
    const purchase = aCardPurchase({ purchaseDate: on("2026-08-10"), installmentCount: 3 });
    expect(buildInstallments(purchase, card).map((item) => item.dueDate)).toEqual([
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
    ]);
  });

  it("never loses a centavo on an uneven split", () => {
    const purchase = aCardPurchase({ totalAmount: brl(1000), installmentCount: 7 });
    const installments = buildInstallments(purchase, card);
    expect(sum(installments.map((item) => item.amount))).toEqual(brl(1000));
    expect(installments[0]?.amount.amount).toBe(14286);
  });

  it("labels installments so a person can recognise them", () => {
    const purchase = aCardPurchase({ description: "Geladeira", installmentCount: 6 });
    expect(buildInstallments(purchase, card)[2]?.description).toBe("Geladeira (3/6)");
  });

  it("does not label a single-installment purchase", () => {
    const purchase = aCardPurchase({ description: "Café", installmentCount: 1 });
    expect(buildInstallments(purchase, card)[0]?.description).toBe("Café");
  });

  it("produces nothing for a refunded purchase", () => {
    expect(buildInstallments(aCardPurchase({ refunded: true }), card)).toEqual([]);
  });
});

describe("statements", () => {
  const purchases = [
    aCardPurchase({
      id: "p1",
      description: "Geladeira",
      totalAmount: brl(1200),
      installmentCount: 6,
      purchaseDate: on("2026-08-10"),
    }),
    aCardPurchase({
      id: "p2",
      description: "Supermercado",
      totalAmount: brl(350),
      installmentCount: 1,
      purchaseDate: on("2026-08-12"),
    }),
  ];

  it("groups installments into the right fatura", () => {
    const statements = projectStatements(
      card,
      purchases,
      [],
      monthKey("2026-08"),
      monthKey("2027-01"),
      TODAY,
    );

    const august = statements.find((s) => s.referenceMonth === "2026-08");
    expect(august?.total).toEqual(brl(550)); // 200 + 350
    expect(august?.dueDate).toBe("2026-09-05");

    const september = statements.find((s) => s.referenceMonth === "2026-09");
    expect(september?.total).toEqual(brl(200));
  });

  it("totals every statement back to the full purchase amounts", () => {
    const statements = projectStatements(
      card,
      purchases,
      [],
      monthKey("2026-08"),
      monthKey("2027-06"),
      TODAY,
    );
    expect(sum(statements.map((s) => s.total))).toEqual(brl(1550));
  });

  it("marks a statement paid once a payment covers it", () => {
    const augustId = statementId(card.id, monthKey("2026-08"));
    const statements = projectStatements(
      card,
      purchases,
      [{ transactionId: "tx-1", statementId: augustId, amount: brl(550) }],
      monthKey("2026-08"),
      monthKey("2026-09"),
      TODAY,
    );

    const august = statements.find((s) => s.id === augustId);
    expect(august?.status).toBe("PAID");
    expect(august?.remainingAmount).toEqual(brl(0));
  });

  it("recognises a partial payment", () => {
    const augustId = statementId(card.id, monthKey("2026-08"));
    const statements = projectStatements(
      card,
      purchases,
      [{ transactionId: "tx-1", statementId: augustId, amount: brl(200) }],
      monthKey("2026-08"),
      monthKey("2026-09"),
      TODAY,
    );

    const august = statements.find((s) => s.id === augustId);
    expect(august?.status).toBe("PARTIALLY_PAID");
    expect(august?.remainingAmount).toEqual(brl(350));
  });

  it("skips months with no activity", () => {
    const statements = projectStatements(
      card,
      [aCardPurchase({ installmentCount: 1, purchaseDate: on("2026-08-10") })],
      [],
      monthKey("2026-08"),
      monthKey("2026-12"),
      TODAY,
    );
    expect(statements.map((s) => s.referenceMonth)).toEqual(["2026-08"]);
  });

  it("counts a purchase once, not once per statement", () => {
    // A purchase in 6 parts must appear as 1200 in total across all faturas,
    // never as 1200 in each.
    const statements = projectStatements(
      card,
      [purchases[0]!],
      [],
      monthKey("2026-08"),
      monthKey("2027-06"),
      TODAY,
    );
    expect(sum(statements.map((s) => s.total))).toEqual(brl(1200));
    expect(statements).toHaveLength(6);
  });
});

describe("limit", () => {
  it("counts future installments as already committed", () => {
    const statements = projectStatements(
      card,
      [aCardPurchase({ totalAmount: brl(1200), installmentCount: 6 })],
      [],
      monthKey("2026-08"),
      monthKey("2027-06"),
      TODAY,
    );

    const status = computeLimitStatus(card, statements);
    expect(status.committed).toEqual(brl(1200));
    expect(status.available).toEqual(brl(3800));
    expect(status.utilisation).toBeCloseTo(0.24, 5);
  });

  it("frees the limit as statements are paid", () => {
    const augustId = statementId(card.id, monthKey("2026-08"));
    const statements = projectStatements(
      card,
      [aCardPurchase({ totalAmount: brl(1200), installmentCount: 6 })],
      [{ transactionId: "tx-1", statementId: augustId, amount: brl(200) }],
      monthKey("2026-08"),
      monthKey("2027-06"),
      TODAY,
    );

    expect(computeLimitStatus(card, statements).available).toEqual(brl(4000));
    expect(totalCardDebt(statements)).toEqual(brl(1000));
  });

  it("never reports a negative available limit", () => {
    const smallCard = aCreditCard({ creditLimit: brl(500) });
    const statements = projectStatements(
      smallCard,
      [aCardPurchase({ creditCardId: smallCard.id, totalAmount: brl(2000), installmentCount: 1 })],
      [],
      monthKey("2026-08"),
      monthKey("2026-09"),
      TODAY,
    );
    const status = computeLimitStatus(smallCard, statements);
    expect(status.available.amount).toBe(0);
  });

  it("reports utilisation above 100% instead of rounding the problem away", () => {
    // A card committed beyond its limit is a materially different situation
    // from one at exactly 100%, and the person needs to see which it is.
    const smallCard = aCreditCard({ creditLimit: brl(500) });
    const statements = projectStatements(
      smallCard,
      [aCardPurchase({ creditCardId: smallCard.id, totalAmount: brl(2000), installmentCount: 1 })],
      [],
      monthKey("2026-08"),
      monthKey("2026-09"),
      TODAY,
    );
    const status = computeLimitStatus(smallCard, statements);
    expect(status.utilisation).toBe(4);
    expect(status.isOverLimit).toBe(true);
  });

  it("is not over the limit when it exactly fits", () => {
    const card500 = aCreditCard({ creditLimit: brl(500) });
    const statements = projectStatements(
      card500,
      [aCardPurchase({ creditCardId: card500.id, totalAmount: brl(500), installmentCount: 1 })],
      [],
      monthKey("2026-08"),
      monthKey("2026-09"),
      TODAY,
    );
    const status = computeLimitStatus(card500, statements);
    expect(status.utilisation).toBe(1);
    expect(status.isOverLimit).toBe(false);
    expect(status.available).toEqual(brl(0));
  });
});

describe("splitStatements", () => {
  const card = aCreditCard({ closingDay: 25, dueDay: 5 });

  const statements = projectStatements(
    card,
    [
      aCardPurchase({
        totalAmount: brl(1200),
        installmentCount: 6,
        purchaseDate: on("2026-05-10"),
      }),
    ],
    [],
    monthKey("2026-05"),
    monthKey("2026-12"),
    TODAY,
  );

  it("never calls an overdue statement the next one", () => {
    const { overdue, next } = splitStatements(statements, TODAY);

    expect(overdue.length).toBeGreaterThan(0);
    expect(overdue.every((statement) => statement.dueDate < TODAY)).toBe(true);
    expect(next?.dueDate).toBeDefined();
    expect(next!.dueDate >= TODAY).toBe(true);
  });

  it("orders overdue statements oldest first", () => {
    const { overdue } = splitStatements(statements, TODAY);
    const dates = overdue.map((statement) => statement.dueDate);
    expect([...dates].sort()).toEqual(dates);
  });

  it("separates settled statements out", () => {
    const paid = projectStatements(
      card,
      [
        aCardPurchase({
          totalAmount: brl(1200),
          installmentCount: 6,
          purchaseDate: on("2026-05-10"),
        }),
      ],
      [
        {
          transactionId: "tx-1",
          statementId: statementId(card.id, monthKey("2026-05")),
          amount: brl(200),
        },
      ],
      monthKey("2026-05"),
      monthKey("2026-12"),
      TODAY,
    );

    const { settled, overdue } = splitStatements(paid, TODAY);
    expect(settled.map((statement) => statement.referenceMonth)).toContain("2026-05");
    expect(overdue.map((statement) => statement.referenceMonth)).not.toContain("2026-05");
  });
});

describe("open installment plans", () => {
  const purchase = aCardPurchase({
    id: "purchase-fridge",
    totalAmount: brl(1200),
    installmentCount: 6,
    purchaseDate: on("2026-08-10"),
  });

  it("counts what was already billed apart from what is still coming", () => {
    const [plan] = openInstallmentPlans([card], [purchase], TODAY);

    // The August statement closed on the 25th; today is the 28th.
    expect(plan!.chargedCount).toBe(1);
    expect(plan!.remainingCount).toBe(5);
    expect(plan!.remainingAmount).toEqual(brl(1000));
  });

  it("says when the last installment falls", () => {
    const [plan] = openInstallmentPlans([card], [purchase], TODAY);

    expect(plan!.firstMonth).toBe("2026-08");
    expect(plan!.lastMonth).toBe("2027-01");
    expect(plan!.next?.statementMonth).toBe("2026-09");
  });

  it("ignores a purchase that was not split", () => {
    const single = aCardPurchase({ installmentCount: 1, purchaseDate: on("2026-08-10") });
    expect(openInstallmentPlans([card], [single], TODAY)).toEqual([]);
  });

  it("drops a plan once every installment has been billed", () => {
    const finished = aCardPurchase({
      totalAmount: brl(600),
      installmentCount: 3,
      purchaseDate: on("2026-01-10"),
    });
    expect(openInstallmentPlans([card], [finished], TODAY)).toEqual([]);
  });

  it("orders by the month the commitment ends", () => {
    const longer = aCardPurchase({
      id: "purchase-sofa",
      totalAmount: brl(2400),
      installmentCount: 12,
      purchaseDate: on("2026-08-10"),
    });

    const plans = openInstallmentPlans([card], [longer, purchase], TODAY);
    expect(plans.map((plan) => plan.purchaseId)).toEqual(["purchase-fridge", "purchase-sofa"]);
  });
});

describe("billing schedule", () => {
  const other = aCreditCard({ id: "card-2", name: "Cartão da Maria", closingDay: 5, dueDay: 15 });

  const statements = [
    ...projectStatements(
      card,
      [
        aCardPurchase({
          totalAmount: brl(600),
          installmentCount: 3,
          purchaseDate: on("2026-09-10"),
        }),
      ],
      [],
      monthKey("2026-09"),
      monthKey("2027-02"),
      TODAY,
    ),
    ...projectStatements(
      other,
      [
        aCardPurchase({
          id: "purchase-2",
          creditCardId: "card-2",
          totalAmount: brl(300),
          installmentCount: 1,
          purchaseDate: on("2026-09-02"),
        }),
      ],
      [],
      monthKey("2026-09"),
      monthKey("2027-02"),
      TODAY,
    ),
  ];

  it("sums every card in the same month", () => {
    const schedule = billingSchedule([card, other], statements, monthKey("2026-09"), 6);
    const september = schedule.find((month) => month.month === "2026-09");

    expect(september!.total).toEqual(brl(500));
    expect(september!.cards.map((line) => line.cardName)).toEqual([
      "Cartão da Maria",
      "Cartão principal",
    ]);
  });

  it("keeps each card's own due date", () => {
    const schedule = billingSchedule([card, other], statements, monthKey("2026-09"), 6);
    const september = schedule.find((month) => month.month === "2026-09");

    expect(september!.cards.map((line) => line.dueDate)).toEqual(["2026-09-15", "2026-10-05"]);
  });

  it("omits months with nothing to bill instead of showing a zero", () => {
    const schedule = billingSchedule([card, other], statements, monthKey("2026-09"), 12);
    expect(schedule.map((month) => month.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("stops at the requested number of months", () => {
    const schedule = billingSchedule([card, other], statements, monthKey("2026-09"), 2);
    expect(schedule).toHaveLength(2);
  });
});
