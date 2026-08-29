import { describe, expect, it } from "vitest";
import { dateRange, monthKey } from "@/core/date/calendar-date";
import { zero } from "@/core/money/money";
import { projectStatements } from "@/modules/cards/domain/credit-card";
import {
  aCardPurchase,
  aCreditCard,
  aDebt,
  anObligation,
  aRecurringRule,
  brl,
  on,
} from "@/modules/shared/testing/builders";
import { forecast, forecastWindows } from "./forecast";
import type { ForecastInput } from "./forecast-types";

const TODAY = on("2026-08-28");

function anInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    asOf: TODAY,
    horizon: dateRange(TODAY, on("2026-12-31")),
    openingBalance: brl(5000),
    protectedReserve: zero(),
    obligations: [],
    recurringRules: [],
    cardStatements: [],
    debts: [],
    ...overrides,
  };
}

describe("the empty case", () => {
  it("keeps the balance flat when nothing is expected", () => {
    const result = forecast(anInput());
    expect(result.summary.projectedCashBalance).toEqual(brl(5000));
    expect(result.summary.expectedInflows).toEqual(brl(0));
    expect(result.summary.committedOutflows).toEqual(brl(0));
    expect(result.summary.firstDeficitMonth).toBeUndefined();
  });

  it("covers every day of the horizon", () => {
    const result = forecast(anInput({ horizon: dateRange(TODAY, on("2026-09-03")) }));
    expect(result.days.map((day) => day.date)).toEqual([
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
  });
});

describe("expected income is a projection, never a balance", () => {
  it("does not change today's balance", () => {
    const result = forecast(
      anInput({
        obligations: [
          anObligation({
            id: "salary",
            direction: "INFLOW",
            description: "Salário",
            amount: brl(6000),
            dueDate: on("2026-09-05"),
            competenceDate: on("2026-09-01"),
          }),
        ],
      }),
    );

    expect(result.days[0]?.projectedCashBalance).toEqual(brl(5000));
    expect(result.days.find((d) => d.date === "2026-09-05")?.projectedCashBalance).toEqual(
      brl(11000),
    );
  });

  it("can be excluded when only certain money should count", () => {
    const estimated = anObligation({
      id: "commission",
      direction: "INFLOW",
      description: "Comissão",
      amount: brl(2000),
      dueDate: on("2026-09-20"),
      confidence: "ESTIMATED",
    });

    const optimistic = forecast(anInput({ obligations: [estimated] }));
    const conservative = forecast(anInput({ obligations: [estimated], includeEstimated: false }));

    expect(optimistic.summary.expectedInflows).toEqual(brl(2000));
    expect(conservative.summary.expectedInflows).toEqual(brl(0));
  });
});

describe("overdue bills stay in the projection", () => {
  const late = anObligation({
    id: "late-bill",
    description: "Conta de água em atraso",
    amount: brl(180),
    dueDate: on("2026-08-10"),
    competenceDate: on("2026-08-01"),
  });

  it("does not silently disappear because the date has passed", () => {
    const result = forecast(anInput({ obligations: [late] }));
    expect(result.summary.overdueAmount).toEqual(brl(180));
  });

  it("is charged against the first day of the projection", () => {
    const result = forecast(anInput({ obligations: [late] }));
    expect(result.days[0]?.projectedCashBalance).toEqual(brl(4820));
  });

  it("stops counting once it is settled", () => {
    const settled = { ...late, status: "SETTLED" as const, settledAmount: brl(180) };
    expect(forecast(anInput({ obligations: [settled] })).summary.overdueAmount).toEqual(brl(0));
  });

  it("counts only what is still owed after a partial payment", () => {
    const partial = {
      ...late,
      status: "PARTIALLY_SETTLED" as const,
      settledAmount: brl(80),
    };
    expect(forecast(anInput({ obligations: [partial] })).summary.overdueAmount).toEqual(brl(100));
  });
});

describe("reserves are protected, not spent", () => {
  it("reports total cash and free cash as different numbers", () => {
    const result = forecast(anInput({ openingBalance: brl(10000), protectedReserve: brl(6000) }));

    expect(result.summary.projectedCashBalance).toEqual(brl(10000));
    expect(result.summary.protectedReserve).toEqual(brl(6000));
    expect(result.summary.freeProjectedBalance).toEqual(brl(4000));
  });

  it("flags the day the free balance goes negative even while cash is positive", () => {
    const result = forecast(
      anInput({
        openingBalance: brl(10000),
        protectedReserve: brl(6000),
        obligations: [
          anObligation({
            id: "big-bill",
            amount: brl(5000),
            dueDate: on("2026-09-15"),
            competenceDate: on("2026-09-01"),
          }),
        ],
      }),
    );

    expect(result.summary.firstNegativeDate).toBe("2026-09-15");
    expect(result.summary.projectedCashBalance).toEqual(brl(5000));
    expect(result.summary.freeProjectedBalance).toEqual(brl(-1000));
  });
});

describe("recurring bills project into future months", () => {
  it("expands a monthly rule across the horizon", () => {
    const result = forecast(
      anInput({
        recurringRules: [
          aRecurringRule({
            id: "internet",
            description: "Internet",
            amount: brl(120),
            dayOfMonth: 10,
            startDate: on("2026-01-10"),
          }),
        ],
      }),
    );

    // September, October, November, December.
    expect(result.summary.committedOutflows).toEqual(brl(480));
  });

  it("does not count a bill twice when it has already been materialised", () => {
    const rule = aRecurringRule({
      id: "internet",
      description: "Internet",
      amount: brl(120),
      dayOfMonth: 10,
      startDate: on("2026-01-10"),
    });

    const materialised = anObligation({
      id: "internet-sep",
      description: "Internet",
      amount: brl(135),
      dueDate: on("2026-09-10"),
      competenceDate: on("2026-09-10"),
      origin: "RECURRING_RULE",
      source: { recurringRuleId: rule.id, occurrenceKey: "internet:2026-09-10" },
    });

    const result = forecast(anInput({ recurringRules: [rule], obligations: [materialised] }));

    // September comes from the concrete record (135), the other three months
    // from the rule (120 each). Never 120 + 135 for September.
    expect(result.summary.committedOutflows).toEqual(brl(135 + 120 * 3));
  });
});

describe("credit card statements enter the projection once", () => {
  const card = aCreditCard({ closingDay: 25, dueDay: 5 });
  const purchase = aCardPurchase({
    totalAmount: brl(1200),
    installmentCount: 6,
    purchaseDate: on("2026-08-10"),
  });

  const statements = projectStatements(
    card,
    [purchase],
    [],
    monthKey("2026-08"),
    monthKey("2027-06"),
    TODAY,
  );

  it("charges each fatura on its own due date", () => {
    const result = forecast(anInput({ cardStatements: statements }));
    const events = result.events.filter((event) => event.source === "CARD_STATEMENT");

    expect(events.map((event) => event.date)).toEqual([
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
      "2026-12-05",
    ]);
    expect(events.every((event) => event.amount.amount === 20000)).toBe(true);
  });

  it("counts the purchase once across the whole horizon", () => {
    const result = forecast(
      anInput({ horizon: dateRange(TODAY, on("2027-06-30")), cardStatements: statements }),
    );
    expect(result.summary.committedOutflows).toEqual(brl(1200));
  });

  it("marks fatura payments as debt commitment", () => {
    const result = forecast(anInput({ cardStatements: statements }));
    expect(result.summary.debtCommitment).toEqual(brl(800));
  });

  it("drops from the projection once paid", () => {
    const paid = projectStatements(
      card,
      [purchase],
      [{ transactionId: "tx-1", statementId: statements[0]!.id, amount: brl(200) }],
      monthKey("2026-08"),
      monthKey("2027-06"),
      TODAY,
    );
    const result = forecast(anInput({ cardStatements: paid }));
    expect(result.events.filter((e) => e.source === "CARD_STATEMENT")).toHaveLength(3);
  });
});

describe("loan installments are commitments, not consumption", () => {
  it("appears in the projection with its own flag", () => {
    const result = forecast(
      anInput({
        debts: [
          aDebt({
            id: "loan",
            description: "Empréstimo",
            installmentCount: 10,
            installmentAmount: brl(800),
            firstDueDate: on("2026-09-01"),
          }),
        ],
      }),
    );

    // September through December.
    expect(result.summary.committedOutflows).toEqual(brl(3200));
    expect(result.summary.debtCommitment).toEqual(brl(3200));
  });

  it("skips installments already paid", () => {
    const result = forecast(
      anInput({
        debts: [
          aDebt({
            id: "loan",
            installmentCount: 10,
            installmentAmount: brl(800),
            firstDueDate: on("2026-09-01"),
          }),
        ],
        paidDebtInstallments: new Map([["loan", [1, 2]]]),
      }),
    );
    expect(result.summary.committedOutflows).toEqual(brl(1600));
  });
});

describe("the November problem", () => {
  /**
   * The scenario from the product brief: three months where the third one
   * goes short. The whole point is that November is visible in August.
   */
  const salary = aRecurringRule({
    id: "salary",
    direction: "INFLOW",
    description: "Salário",
    amount: brl(8000),
    dayOfMonth: 5,
    startDate: on("2026-01-05"),
  });

  const living = aRecurringRule({
    id: "living",
    description: "Custo de vida",
    amount: brl(6200),
    dayOfMonth: 10,
    startDate: on("2026-01-10"),
  });

  const extraOctober = anObligation({
    id: "extra-oct",
    description: "IPTU",
    amount: brl(1200),
    dueDate: on("2026-10-20"),
    competenceDate: on("2026-10-20"),
  });

  const extraNovember = anObligation({
    id: "extra-nov",
    description: "Matrícula escolar",
    amount: brl(2500),
    dueDate: on("2026-11-15"),
    competenceDate: on("2026-11-15"),
  });

  const result = forecast(
    anInput({
      asOf: on("2026-08-28"),
      horizon: dateRange(on("2026-08-28"), on("2026-11-30")),
      openingBalance: brl(3000),
      recurringRules: [salary, living],
      obligations: [extraOctober, extraNovember],
    }),
  );

  it("shows each month's inflows and commitments", () => {
    const september = result.months.find((m) => m.month === "2026-09");
    const october = result.months.find((m) => m.month === "2026-10");
    const november = result.months.find((m) => m.month === "2026-11");

    expect(september?.expectedInflows).toEqual(brl(8000));
    expect(september?.committedOutflows).toEqual(brl(6200));
    expect(september?.net).toEqual(brl(1800));

    expect(october?.committedOutflows).toEqual(brl(7400));
    expect(october?.net).toEqual(brl(600));

    expect(november?.committedOutflows).toEqual(brl(8700));
    expect(november?.net).toEqual(brl(-700));
  });

  it("names November as the first month that goes short, months in advance", () => {
    expect(result.summary.firstDeficitMonth).toBe("2026-11");
    const november = result.months.find((m) => m.month === "2026-11");
    expect(november?.isDeficit).toBe(true);
    expect(november?.deficitAmount).toEqual(brl(700));
  });

  it("does not flag months that balance", () => {
    expect(result.months.find((m) => m.month === "2026-09")?.isDeficit).toBe(false);
    expect(result.months.find((m) => m.month === "2026-10")?.isDeficit).toBe(false);
  });

  it("reports the lowest point the balance reaches and when", () => {
    // The trough is the stretch before the first salary lands on 5 September.
    expect(result.summary.lowestProjectedBalance).toEqual(brl(3000));
    expect(result.summary.lowestProjectedBalanceDate).toBe("2026-08-28");
  });

  it("tracks the trough inside each month", () => {
    const november = result.months.find((m) => m.month === "2026-11");
    // Balance dips to 4.700 after the school fee on the 15th, then holds.
    expect(november?.lowestBalance).toEqual(brl(4700));
    expect(november?.lowestBalanceDate).toBe("2026-11-15");
    expect(november?.endingCashBalance).toEqual(brl(4700));
  });

  it("still ends the horizon with cash even though November alone is short", () => {
    // The surplus from earlier months absorbs November's gap. Reporting only
    // the closing balance would hide the squeeze; reporting only the month
    // would overstate it. The dashboard shows both.
    expect(result.summary.projectedCashBalance).toEqual(brl(4700));
    expect(result.summary.firstDeficitMonth).toBe("2026-11");
  });
});

describe("forecast windows", () => {
  it("produces a consistent story across horizons", () => {
    const windows = forecastWindows(
      {
        asOf: TODAY,
        openingBalance: brl(5000),
        protectedReserve: brl(1000),
        obligations: [],
        recurringRules: [
          aRecurringRule({
            id: "rent",
            description: "Aluguel",
            amount: brl(2000),
            dayOfMonth: 5,
            startDate: on("2026-01-05"),
          }),
        ],
        cardStatements: [],
        debts: [],
      },
      [7, 30, 90],
    );

    expect(windows.map((w) => w.days)).toEqual([7, 30, 90]);
    // Each longer window must include at least as much as the shorter one.
    expect(windows[0]!.summary.committedOutflows.amount).toBeLessThanOrEqual(
      windows[1]!.summary.committedOutflows.amount,
    );
    expect(windows[1]!.summary.committedOutflows.amount).toBeLessThanOrEqual(
      windows[2]!.summary.committedOutflows.amount,
    );
  });
});

describe("the first month is only partly ahead of us", () => {
  it("marks it as partial when the projection starts mid-month", () => {
    const result = forecast(anInput({ asOf: on("2026-08-28") }));
    expect(result.months[0]?.month).toBe("2026-08");
    expect(result.months[0]?.isPartial).toBe(true);
    expect(result.months[1]?.isPartial).toBe(false);
  });

  it("is not partial when the projection starts on the first of the month", () => {
    const result = forecast(
      anInput({ asOf: on("2026-09-01"), horizon: dateRange(on("2026-09-01"), on("2026-12-31")) }),
    );
    expect(result.months[0]?.isPartial).toBe(false);
  });

  it("does not report a partial month as the first deficit", () => {
    // The salary already arrived on the 5th, so what remains of August is all
    // outflow. That is an artefact of the start date, not a month that fails.
    const result = forecast(
      anInput({
        asOf: on("2026-08-28"),
        horizon: dateRange(on("2026-08-28"), on("2026-10-31")),
        recurringRules: [
          aRecurringRule({
            id: "salary",
            direction: "INFLOW",
            amount: brl(5000),
            dayOfMonth: 5,
            startDate: on("2026-01-05"),
          }),
          aRecurringRule({
            id: "rent",
            amount: brl(1500),
            dayOfMonth: 30,
            startDate: on("2026-01-30"),
          }),
        ],
      }),
    );

    expect(result.months[0]?.isDeficit).toBe(true);
    expect(result.months[0]?.isPartial).toBe(true);
    // September is whole and comfortably positive, so nothing is flagged.
    expect(result.summary.firstDeficitMonth).toBeUndefined();
  });
});

describe("bills whose month has already passed", () => {
  it("shows an overdue bill in the first month rather than losing it", () => {
    const result = forecast(
      anInput({
        asOf: on("2026-08-28"),
        horizon: dateRange(on("2026-08-28"), on("2026-10-31")),
        obligations: [
          anObligation({
            id: "july-bill",
            description: "Energia de julho",
            amount: brl(310),
            dueDate: on("2026-07-20"),
            competenceDate: on("2026-07-01"),
          }),
        ],
      }),
    );

    // Its competence month (July) is outside the horizon, but the money still
    // has to leave, so it appears in the first month shown.
    expect(result.months[0]?.committedOutflows).toEqual(brl(310));
    expect(result.summary.overdueAmount).toEqual(brl(310));
  });

  it("keeps the month totals consistent with the summary", () => {
    const result = forecast(
      anInput({
        asOf: on("2026-08-28"),
        horizon: dateRange(on("2026-08-28"), on("2026-10-31")),
        obligations: [
          anObligation({
            id: "old",
            amount: brl(200),
            dueDate: on("2026-06-10"),
            competenceDate: on("2026-06-01"),
          }),
          anObligation({
            id: "new",
            amount: brl(150),
            dueDate: on("2026-09-10"),
            competenceDate: on("2026-09-01"),
          }),
        ],
      }),
    );

    const monthTotal = result.months.reduce(
      (acc, month) => acc + month.committedOutflows.amount,
      0,
    );
    expect(monthTotal).toBe(result.summary.committedOutflows.amount);
  });
});

describe("ordering within a day", () => {
  it("applies money arriving before money leaving on the same date", () => {
    const result = forecast(
      anInput({
        openingBalance: brl(0),
        horizon: dateRange(TODAY, on("2026-09-30")),
        obligations: [
          anObligation({
            id: "in",
            direction: "INFLOW",
            amount: brl(1000),
            dueDate: on("2026-09-05"),
          }),
          anObligation({ id: "out", amount: brl(900), dueDate: on("2026-09-05") }),
        ],
      }),
    );

    const day = result.days.find((d) => d.date === "2026-09-05");
    expect(day?.events[0]?.direction).toBe("INFLOW");
    expect(day?.projectedCashBalance).toEqual(brl(100));
  });
});
