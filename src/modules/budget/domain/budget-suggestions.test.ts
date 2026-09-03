import { describe, expect, it } from "vitest";
import { monthKey } from "@/core/date/calendar-date";
import {
  aCardPurchase,
  aTransfer,
  anExpense,
  anIncome,
  brl,
  on,
} from "@/modules/shared/testing/builders";
import { suggestBudgetLines, totalSuggested } from "./budget-suggestions";

const PLANNING = monthKey("2026-09");

function expenseIn(date: string, categoryId: string, amount: number, id: string) {
  return anExpense({
    id,
    categoryId,
    amount: brl(amount),
    transactionDate: on(date),
    competenceDate: on(date),
  });
}

describe("suggesting ceilings from history", () => {
  const transactions = [
    expenseIn("2026-06-05", "alimentacao", 1000, "t1"),
    expenseIn("2026-07-05", "alimentacao", 1200, "t2"),
    expenseIn("2026-08-05", "alimentacao", 1100, "t3"),
  ];

  it("averages the complete months before the one being planned", () => {
    const [line] = suggestBudgetLines({ transactions, cardPurchases: [], month: PLANNING });

    expect(line!.categoryId).toBe("alimentacao");
    expect(line!.average).toEqual(brl(1100));
    expect(line!.monthsObserved).toBe(3);
  });

  it("rounds the suggestion up, so it reads as a decision and not a calculation", () => {
    const odd = [
      expenseIn("2026-06-05", "mercado", 483.17, "t1"),
      expenseIn("2026-07-05", "mercado", 483.17, "t2"),
      expenseIn("2026-08-05", "mercado", 483.17, "t3"),
    ];

    const [line] = suggestBudgetLines({ transactions: odd, cardPurchases: [], month: PLANNING });
    expect(line!.suggested).toEqual(brl(490));
  });

  it("ignores the month being planned: it is still happening", () => {
    const withCurrent = [...transactions, expenseIn("2026-09-02", "alimentacao", 100, "t4")];

    const [line] = suggestBudgetLines({
      transactions: withCurrent,
      cardPurchases: [],
      month: PLANNING,
    });

    expect(line!.average).toEqual(brl(1100));
  });

  it("counts a month with nothing spent as zero", () => {
    // R$ 900 of clothes once in three months is R$ 300 a month of allowance.
    const occasional = [expenseIn("2026-07-10", "vestuario", 900, "t1")];

    const [line] = suggestBudgetLines({
      transactions: occasional,
      cardPurchases: [],
      month: PLANNING,
    });

    expect(line!.average).toEqual(brl(300));
    expect(line!.typical).toEqual(brl(0));
    expect(line!.highest).toEqual(brl(900));
  });

  it("reports the typical month apart from the average when one month distorts it", () => {
    const spiky = [
      expenseIn("2026-06-05", "saude", 100, "t1"),
      expenseIn("2026-07-05", "saude", 100, "t2"),
      expenseIn("2026-08-05", "saude", 1600, "t3"),
    ];

    const [line] = suggestBudgetLines({ transactions: spiky, cardPurchases: [], month: PLANNING });

    expect(line!.average).toEqual(brl(600));
    expect(line!.typical).toEqual(brl(100));
    expect(line!.highest).toEqual(brl(1600));
    // The suggestion follows the higher of the two: a ceiling under the
    // average is broken every other month.
    expect(line!.suggested).toEqual(brl(600));
  });
});

describe("what counts as spending", () => {
  it("includes card purchases, by the month the purchase happened", () => {
    const lines = suggestBudgetLines({
      transactions: [],
      cardPurchases: [
        aCardPurchase({
          id: "p1",
          categoryId: "moradia",
          totalAmount: brl(1200),
          purchaseDate: on("2026-07-15"),
          competenceDate: on("2026-07-15"),
          installmentCount: 6,
        }),
      ],
      month: PLANNING,
    });

    // The whole purchase belongs to July, not the instalments to six months.
    expect(lines[0]?.average).toEqual(brl(400));
  });

  it("leaves out transfers and income", () => {
    const lines = suggestBudgetLines({
      transactions: [aTransfer(), anIncome({ transactionDate: on("2026-07-05") })],
      cardPurchases: [],
      month: PLANNING,
    });

    expect(lines).toEqual([]);
  });

  it("says nothing about a category with no history", () => {
    expect(suggestBudgetLines({ transactions: [], cardPurchases: [], month: PLANNING })).toEqual(
      [],
    );
  });
});

describe("the plan as a whole", () => {
  it("adds the suggested ceilings up", () => {
    const lines = suggestBudgetLines({
      transactions: [
        expenseIn("2026-07-05", "alimentacao", 900, "t1"),
        expenseIn("2026-07-06", "transporte", 300, "t2"),
      ],
      cardPurchases: [],
      month: PLANNING,
    });

    expect(totalSuggested(lines)).toEqual(brl(400));
  });

  it("puts the biggest ceiling first", () => {
    const lines = suggestBudgetLines({
      transactions: [
        expenseIn("2026-07-05", "lazer", 150, "t1"),
        expenseIn("2026-07-06", "alimentacao", 1200, "t2"),
      ],
      cardPurchases: [],
      month: PLANNING,
    });

    expect(lines.map((line) => line.categoryId)).toEqual(["alimentacao", "lazer"]);
  });
});
