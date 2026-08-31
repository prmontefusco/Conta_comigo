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
