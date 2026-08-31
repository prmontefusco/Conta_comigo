import { describe, expect, it } from "vitest";
import { calendarDate, dateRange } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import { evaluateFinancialHealth } from "./financial-health";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { Obligation } from "@/modules/obligations/domain/obligation";

describe("evaluateFinancialHealth", () => {
  const dummyForecast: ForecastResult = {
    asOf: calendarDate("2026-09-01"),
    horizon: dateRange(calendarDate("2026-09-01"), calendarDate("2026-12-31")),
    openingBalance: money(150000),
    protectedReserve: money(0),
    days: [],
    months: [],
    events: [],
    summary: {
      projectedCashBalance: money(250000),
      protectedReserve: money(0),
      freeProjectedBalance: money(250000),
      committedOutflows: money(300000),
      expectedInflows: money(450000),
      debtCommitment: money(50000),
      overdueAmount: money(0),
      upcomingAmount: money(200000),
      lowestProjectedBalance: money(120000),
      lowestProjectedBalanceDate: calendarDate("2026-09-10"),
    },
  };

  it("calcula score alto para finanças saudáveis sem dívidas atrasadas", () => {
    const report = evaluateFinancialHealth({
      asOf: calendarDate("2026-09-01"),
      openingBalance: money(500000),
      totalCash: money(500000),
      protectedReserve: money(200000),
      forecast: dummyForecast,
      debts: [],
      cards: [],
      cardStatements: [],
      obligations: [],
      recurringRules: [],
      reserves: [],
    });

    expect(report.score).toBeGreaterThanOrEqual(70);
    expect(report.status).toMatch(/HEALTHY|EXCELLENT/);
    expect(report.overdueBillsCount).toBe(0);
    expect(report.pillars.length).toBe(4);
  });

  it("penaliza score e adiciona ação de emergência quando há contas vencidas", () => {
    const mockObligation = {
      id: "ob-1",
      householdId: "h1",
      direction: "OUTFLOW",
      amount: money(30000),
      settledAmount: money(0),
      settlementTransactionIds: [],
      dueDate: calendarDate("2026-08-20"),
      competenceDate: calendarDate("2026-08-01"),
      description: "Conta de Luz Atrasada",
      status: "SCHEDULED",
      origin: "MANUAL",
      confidence: "CONFIRMED",
      visibility: "HOUSEHOLD",
      expenseNature: "ESSENTIAL",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      createdBy: "u1",
    } as unknown as Obligation;

    const report = evaluateFinancialHealth({
      asOf: calendarDate("2026-09-01"),
      openingBalance: money(50000),
      totalCash: money(50000),
      protectedReserve: money(0),
      forecast: dummyForecast,
      debts: [],
      cards: [],
      cardStatements: [],
      obligations: [mockObligation],
      recurringRules: [],
      reserves: [],
    });

    expect(report.overdueBillsCount).toBe(1);
    expect(report.overdueBillsTotal.amount).toBe(30000);
    const emergencyAction = report.actionPlan.find((a) => a.category === "EMERGENCY");
    expect(emergencyAction).toBeDefined();
  });
});
