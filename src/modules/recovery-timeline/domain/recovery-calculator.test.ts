import { describe, expect, it } from "vitest";
import { calendarDate, dateRange } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import { calculateRecoveryTimeline } from "./recovery-calculator";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { Debt } from "@/modules/debts/domain/debt";

describe("calculateRecoveryTimeline", () => {
  const dummyForecast: ForecastResult = {
    asOf: calendarDate("2026-09-01"),
    horizon: dateRange(calendarDate("2026-09-01"), calendarDate("2027-09-01")),
    openingBalance: money(100000),
    protectedReserve: money(0),
    days: [],
    months: [],
    events: [],
    summary: {
      projectedCashBalance: money(150000),
      protectedReserve: money(0),
      freeProjectedBalance: money(150000),
      committedOutflows: money(300000),
      expectedInflows: money(350000),
      debtCommitment: money(40000),
      overdueAmount: money(0),
      upcomingAmount: money(150000),
      lowestProjectedBalance: money(50000),
      lowestProjectedBalanceDate: calendarDate("2026-09-15"),
    },
  };

  it("calcula marcos e tempo de quitação para dívidas ativas", () => {
    const mockDebt = {
      id: "debt-1",
      householdId: "h1",
      kind: "PERSONAL_LOAN",
      description: "Empréstimo Caixa",
      principalContracted: money(240000),
      amountDisbursed: money(240000),
      disbursementDate: calendarDate("2026-01-01"),
      amortisationSystem: "PRICE",
      interestRateMonthly: 2.0,
      installmentCount: 12,
      installmentAmount: money(20000),
      firstDueDate: calendarDate("2026-02-01"),
      status: "ACTIVE",
      visibility: "HOUSEHOLD",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
    } as unknown as Debt;

    const result = calculateRecoveryTimeline({
      asOf: calendarDate("2026-09-01"),
      openingBalance: money(100000),
      totalCash: money(100000),
      protectedReserve: money(0),
      forecast: dummyForecast,
      debts: [mockDebt],
      cardStatements: [],
      reserves: [],
    });

    expect(result.monthsToDebtFree).toBeGreaterThan(0);
    expect(result.debtFreeDate).toBeDefined();
    expect(result.milestones.length).toBeGreaterThanOrEqual(3);
    expect(result.snowballPlan.strategy).toBe("SNOWBALL");
    expect(result.avalanchePlan.strategy).toBe("AVALANCHE");
  });

  it("identifica usuário sem dívidas e projeta formação de reserva e estabilidade", () => {
    const result = calculateRecoveryTimeline({
      asOf: calendarDate("2026-09-01"),
      openingBalance: money(500000),
      totalCash: money(500000),
      protectedReserve: money(200000),
      forecast: dummyForecast,
      debts: [],
      cardStatements: [],
      reserves: [],
    });

    expect(result.monthsToDebtFree).toBe(0);
    expect(result.totalDebtAmount.amount).toBe(0);
    expect(result.milestones.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * The numbers the plan stands on.
 *
 * These cover the three ways this module used to lie: a monthly surplus taken
 * from horizon totals, a balance that ignored every payment already made, and
 * an "economia" that was a fixed 20% of the interest.
 */
describe("what the plan is built from", () => {
  const asOf = calendarDate("2026-09-01");

  function forecastWithMonths(inflow: number, outflow: number): ForecastResult {
    const months = Array.from({ length: 12 }, (_unused, index) => ({
      month: `2026-${String(index + 1).padStart(2, "0")}` as never,
      expectedInflows: money(inflow),
      committedOutflows: money(outflow),
      debtCommitment: money(0),
      net: money(inflow - outflow),
      openingCashBalance: money(0),
      endingCashBalance: money(0),
      freeEndingBalance: money(0),
      lowestBalance: money(0),
      lowestBalanceDate: asOf,
      isDeficit: outflow > inflow,
      deficitAmount: money(Math.max(0, outflow - inflow)),
      isPartial: false,
    }));

    return {
      asOf,
      horizon: dateRange(asOf, calendarDate("2027-09-01")),
      openingBalance: money(0),
      protectedReserve: money(0),
      days: [],
      months,
      events: [],
      summary: {
        // Horizon totals: twelve times the monthly figures. Using these as if
        // they were monthly is exactly the bug these tests guard.
        projectedCashBalance: money(0),
        protectedReserve: money(0),
        freeProjectedBalance: money(0),
        committedOutflows: money(outflow * 12),
        expectedInflows: money(inflow * 12),
        debtCommitment: money(0),
        overdueAmount: money(0),
        upcomingAmount: money(0),
        lowestProjectedBalance: money(0),
        lowestProjectedBalanceDate: asOf,
      },
    } as ForecastResult;
  }

  const debt = {
    id: "debt-1",
    householdId: "h1",
    kind: "PERSONAL_LOAN",
    description: "Empréstimo",
    principalContracted: money(1200000),
    amountDisbursed: money(1200000),
    disbursementDate: calendarDate("2026-01-01"),
    amortisationSystem: "PRICE",
    interestRateMonthly: 2,
    installmentCount: 24,
    installmentAmount: money(63000),
    firstDueDate: calendarDate("2026-02-01"),
    status: "ACTIVE",
    visibility: "HOUSEHOLD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  } as unknown as Debt;

  it("takes the surplus from a month, not from the whole horizon", () => {
    const result = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [],
      cardStatements: [],
      reserves: [],
    });

    // R$ 5.000 in, R$ 4.000 out: R$ 1.000 a month, not R$ 12.000.
    expect(result.monthlySurplus).toEqual(money(100000));
  });

  it("counts only what is still owed", () => {
    const untouched = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [debt],
      cardStatements: [],
      reserves: [],
    });

    const halfPaid = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [debt],
      cardStatements: [],
      reserves: [],
      paidDebtInstallments: new Map([["debt-1", Array.from({ length: 12 }, (_u, i) => i + 1)]]),
    });

    expect(halfPaid.totalDebtAmount.amount).toBeLessThan(untouched.totalDebtAmount.amount);
    expect(halfPaid.monthsToDebtFree).toBeLessThanOrEqual(untouched.monthsToDebtFree);
  });

  it("measures the interest saved instead of assuming a fraction of it", () => {
    const result = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [debt],
      cardStatements: [],
      reserves: [],
    });

    const plan = result.avalanchePlan;
    // Paying extra every month cannot cost more interest than paying minimums.
    expect(plan.interestSavedVsMinimum.amount).toBeGreaterThanOrEqual(0);
    expect(plan.interestSavedVsMinimum.amount).not.toBe(
      Math.round(plan.totalInterestPaid.amount * 0.2),
    );
  });

  it("puts the starter reserve before the payoff milestone", () => {
    const result = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [debt],
      cardStatements: [],
      reserves: [],
    });

    const categories = result.milestones.map((milestone) => milestone.category);
    expect(categories.indexOf("STARTER_RESERVE")).toBeLessThan(categories.indexOf("DEBT_FREE"));
    expect(result.starterReserve.isComplete).toBe(false);
    // Half of R$ 4.000 of monthly expenses, capped at R$ 1.000.
    expect(result.starterReserve.target).toEqual(money(100000));
  });
});
