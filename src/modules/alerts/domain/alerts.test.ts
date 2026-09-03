import { describe, expect, it } from "vitest";
import { calendarDate, dateRange } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import type { DashboardOverview } from "@/modules/dashboard/domain/overview";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import { aDebt, anObligation, brl, on } from "@/modules/shared/testing/builders";
import { buildAlerts, type AlertInput } from "./alerts";

/**
 * These cover the alerts that exist to rank a bill by its *consequence*
 * rather than by its amount.
 */

const ASOF = on("2026-09-10");

const emptyForecast = {
  asOf: ASOF,
  horizon: dateRange(ASOF, calendarDate("2027-09-10")),
  openingBalance: money(0),
  protectedReserve: money(0),
  days: [],
  months: [],
  events: [],
  summary: {
    projectedCashBalance: money(0),
    protectedReserve: money(0),
    freeProjectedBalance: money(0),
    committedOutflows: money(0),
    expectedInflows: money(0),
    debtCommitment: money(0),
    overdueAmount: money(0),
    upcomingAmount: money(0),
    lowestProjectedBalance: money(0),
    lowestProjectedBalanceDate: ASOF,
  },
} as ForecastResult;

function overviewWith(overdue: DashboardOverview["today"]["overdue"]): DashboardOverview {
  return {
    today: {
      totalCash: money(0),
      protectedReserve: money(0),
      spendableCash: money(0),
      payables: { total: money(0), overdue: money(0), dueSoon: money(0), open: money(0) },
      receivables: { total: money(0), overdue: money(0), dueSoon: money(0), open: money(0) },
      dueSoon: [],
      overdue,
      cardDebt: money(0),
      loanDebt: money(0),
      totalDebt: money(0),
      uncommittedCash: money(0),
      committedThisMonth: money(0),
    },
  } as unknown as DashboardOverview;
}

function inputWith(overrides: Partial<AlertInput>): AlertInput {
  return {
    asOf: ASOF,
    overview: overviewWith([]),
    forecast: emptyForecast,
    cards: [],
    cardStatements: [],
    reserves: [],
    ...overrides,
  };
}

describe("bills that cut off something essential", () => {
  it("names what is at risk, not just the amount", () => {
    const alerts = buildAlerts(
      inputWith({
        overview: overviewWith([
          anObligation({
            id: "ob-energia",
            description: "Conta de luz",
            categoryId: "energia",
            dueDate: on("2026-09-01"),
            amount: brl(180),
          }),
        ]),
      }),
    );

    const alert = alerts.find((item) => item.kind === "ESSENTIAL_SERVICE_AT_RISK");
    expect(alert?.severity).toBe("URGENT");
    expect(alert?.message).toContain("corte de energia");
  });

  it("stays quiet about an overdue bill with no such consequence", () => {
    const alerts = buildAlerts(
      inputWith({
        overview: overviewWith([
          anObligation({ id: "ob-presente", categoryId: "presentes", dueDate: on("2026-09-01") }),
        ]),
      }),
    );

    expect(alerts.some((item) => item.kind === "ESSENTIAL_SERVICE_AT_RISK")).toBe(false);
  });
});

describe("debts that can cost the household a good", () => {
  const financedCar = aDebt({
    id: "car",
    kind: "VEHICLE_FINANCING",
    description: "Financiamento do carro",
    installmentCount: 24,
    firstDueDate: on("2026-06-05"),
  });

  it("warns when instalments due have not been paid", () => {
    // Four instalments were due by 10/09; only two are recorded as paid.
    const alerts = buildAlerts(
      inputWith({
        debts: [financedCar],
        paidDebtInstallments: new Map([["car", [1, 2]]]),
      }),
    );

    const alert = alerts.find((item) => item.kind === "COLLATERAL_AT_RISK");
    expect(alert?.severity).toBe("URGENT");
    expect(alert?.message).toContain("busca e apreensão");
  });

  it("stays quiet when the payments are up to date", () => {
    const alerts = buildAlerts(
      inputWith({
        debts: [financedCar],
        paidDebtInstallments: new Map([["car", [1, 2, 3, 4, 5, 6]]]),
      }),
    );

    expect(alerts.some((item) => item.kind === "COLLATERAL_AT_RISK")).toBe(false);
  });

  it("says nothing about an unsecured debt in the same state", () => {
    const alerts = buildAlerts(
      inputWith({
        debts: [aDebt({ id: "loan", kind: "PERSONAL_LOAN", firstDueDate: on("2026-06-05") })],
        paidDebtInstallments: new Map(),
      }),
    );

    expect(alerts.some((item) => item.kind === "COLLATERAL_AT_RISK")).toBe(false);
  });
});
