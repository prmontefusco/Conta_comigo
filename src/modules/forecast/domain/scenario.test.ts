import { describe, expect, it } from "vitest";
import { dateRange } from "@/core/date/calendar-date";
import { zero } from "@/core/money/money";
import { aRecurringRule, brl, on } from "@/modules/shared/testing/builders";
import type { ForecastInput } from "./forecast-types";
import { simulate, simulatePurchase } from "./scenario";

const TODAY = on("2026-08-28");

const salary = aRecurringRule({
  id: "salary",
  direction: "INFLOW",
  description: "Salário",
  amount: brl(5000),
  dayOfMonth: 5,
  startDate: on("2026-01-05"),
});

const living = aRecurringRule({
  id: "living",
  description: "Custo de vida",
  amount: brl(4200),
  dayOfMonth: 10,
  startDate: on("2026-01-10"),
});

const base: ForecastInput = {
  asOf: TODAY,
  horizon: dateRange(TODAY, on("2027-08-31")),
  openingBalance: brl(2000),
  protectedReserve: brl(1000),
  obligations: [],
  recurringRules: [salary, living],
  cardStatements: [],
  debts: [],
};

describe("can I afford this purchase?", () => {
  it("spreads the installments across the coming months", () => {
    const result = simulate(base, [
      {
        kind: "INSTALLMENT_PURCHASE",
        description: "Notebook",
        totalAmount: brl(3000),
        installments: 10,
        firstDueDate: on("2026-09-15"),
      },
    ]);

    const added = result.scenario.events.filter((event) => event.source === "SIMULATED");
    expect(added).toHaveLength(10);
    expect(added.every((event) => event.amount.amount === 30000)).toBe(true);
    expect(result.additionalOutflows).toEqual(brl(3000));
  });

  it("leaves the baseline untouched so the two can be compared", () => {
    const result = simulate(base, [
      {
        kind: "INSTALLMENT_PURCHASE",
        description: "Notebook",
        totalAmount: brl(3000),
        installments: 10,
        firstDueDate: on("2026-09-15"),
      },
    ]);

    expect(result.baseline.summary.committedOutflows.amount).toBeLessThan(
      result.scenario.summary.committedOutflows.amount,
    );
    expect(
      result.scenario.summary.committedOutflows.amount -
        result.baseline.summary.committedOutflows.amount,
    ).toBe(300000);
  });

  it("reports the months that would go short", () => {
    const tight = { ...base, openingBalance: brl(500), protectedReserve: zero() };
    const result = simulate(tight, [
      {
        kind: "INSTALLMENT_PURCHASE",
        description: "Móveis",
        totalAmount: brl(9000),
        installments: 6,
        firstDueDate: on("2026-09-15"),
      },
    ]);

    expect(result.newDeficitMonths.length).toBeGreaterThan(0);
    expect(result.staysAboveZero).toBe(false);
    expect(result.shortfallAtWorstPoint.amount).toBeGreaterThan(0);
  });

  it("says a small purchase fits without going negative", () => {
    const result = simulatePurchase(
      { ...base, openingBalance: brl(4000), protectedReserve: zero() },
      {
        description: "Fone",
        totalAmount: brl(600),
        installments: 6,
        firstDueDate: on("2026-09-15"),
      },
    );

    expect(result.staysAboveZero).toBe(true);
    expect(result.shortfallAtWorstPoint).toEqual(brl(0));
  });
});

describe("can I travel?", () => {
  it("shows the hit on the month of the trip and what remains", () => {
    const result = simulate(base, [
      {
        kind: "ONE_OFF_EXPENSE",
        description: "Viagem de dezembro",
        amount: brl(5000),
        date: on("2026-12-20"),
      },
    ]);

    const december = result.months.find((month) => month.month === "2026-12");
    expect(december?.difference).toEqual(brl(-5000));
    expect(result.additionalOutflows).toEqual(brl(5000));
  });
});

describe("what if my income drops?", () => {
  it("turns a monthly reduction into a recurring gap", () => {
    const result = simulate(base, [
      {
        kind: "INCOME_CHANGE",
        description: "Redução de renda",
        monthlyDelta: brl(-1500),
        startDate: on("2026-10-05"),
        endDate: on("2027-03-05"),
      },
    ]);

    expect(result.newDeficitMonths).toContain("2026-10");
    expect(result.scenario.summary.expectedInflows.amount).toBe(
      result.baseline.summary.expectedInflows.amount,
    );
    // The reduction is modelled as an outflow so the drop is visible as such.
    expect(result.additionalOutflows).toEqual(brl(9000));
  });

  it("handles an increase in income too", () => {
    const result = simulate(base, [
      {
        kind: "INCOME_CHANGE",
        description: "Aumento",
        monthlyDelta: brl(500),
        startDate: on("2026-09-05"),
        endDate: on("2026-12-05"),
      },
    ]);

    expect(result.additionalOutflows).toEqual(brl(0));
    expect(result.scenario.summary.expectedInflows.amount).toBeGreaterThan(
      result.baseline.summary.expectedInflows.amount,
    );
  });
});

describe("what if an emergency happens?", () => {
  it("shows the shortfall as a number, not a verdict", () => {
    const result = simulate({ ...base, openingBalance: brl(1200), protectedReserve: zero() }, [
      {
        kind: "ONE_OFF_EXPENSE",
        description: "Emergência",
        amount: brl(4000),
        date: on("2026-09-01"),
      },
    ]);

    expect(result.staysAboveZero).toBe(false);
    expect(result.shortfallAtWorstPoint.amount).toBeGreaterThan(0);
    // The result is descriptive: amounts and dates, no judgement attached.
    expect(Object.keys(result)).not.toContain("recommendation");
  });
});

describe("a new fixed cost", () => {
  it("adds the same amount every month", () => {
    const result = simulate(base, [
      {
        kind: "RECURRING_EXPENSE",
        description: "Plano de saúde",
        monthlyAmount: brl(700),
        startDate: on("2026-09-10"),
        endDate: on("2026-12-10"),
      },
    ]);

    expect(result.additionalOutflows).toEqual(brl(2800));
    expect(
      result.scenario.events.filter((event) => event.description === "Plano de saúde"),
    ).toHaveLength(4);
  });
});

describe("combining changes", () => {
  it("applies several what-ifs at once", () => {
    const result = simulate(base, [
      {
        kind: "RECURRING_EXPENSE",
        description: "Academia",
        monthlyAmount: brl(150),
        startDate: on("2026-09-05"),
        endDate: on("2026-11-05"),
      },
      {
        kind: "ONE_OFF_EXPENSE",
        description: "Presente",
        amount: brl(800),
        date: on("2026-12-15"),
      },
    ]);

    expect(result.additionalOutflows).toEqual(brl(150 * 3 + 800));
    expect(result.changes).toHaveLength(2);
  });
});
