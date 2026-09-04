import { describe, expect, it } from "vitest";
import { calendarDate, dateRange, instant } from "@/core/date/calendar-date";
import { money, zero } from "@/core/money/money";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import type { ForecastInput } from "./forecast-types";
import {
  analyzeBreakEvenIncome,
  buildSalaryVariationChange,
  buildThirteenthSalaryChanges,
  buildVacationBonusChange,
  calculateRegisteredMonthlyIncome,
} from "./salary-simulator";

function createDummyRule(
  cents: number,
  freq: "MONTHLY" | "WEEKLY" | "ANNUAL" = "MONTHLY",
): RecurringRule {
  return {
    id: `rule-${cents}`,
    householdId: "hh-1",
    description: "Salário Teste",
    direction: "INFLOW",
    amount: money(cents),
    frequency: freq,
    interval: 1,
    dayOfMonth: 5,
    startDate: calendarDate("2026-01-01"),
    weekendPolicy: "KEEP",
    expenseNature: "FIXED",
    confidence: "CONFIRMED",
    visibility: "HOUSEHOLD",
    active: true,
    createdBy: "user-1",
    createdAt: instant(),
    updatedAt: instant(),
  };
}

describe("salary-simulator domain", () => {
  it("calcula soma de receitas recorrentes mensais", () => {
    const rules: RecurringRule[] = [
      createDummyRule(300000), // R$ 3.000 mensal
      createDummyRule(100000), // R$ 1.000 mensal
    ];

    const total = calculateRegisteredMonthlyIncome(rules);
    expect(total.amount).toBe(400000);
  });

  it("calcula 13º salário em duas parcelas de 50%", () => {
    const salary = money(500000); // R$ 5.000,00
    const events = buildThirteenthSalaryChanges({
      monthlySalary: salary,
      referenceYear: 2026,
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.amount.amount).toBe(250000);
    expect(events[0]?.date).toBe("2026-11-30");
    expect(events[1]?.amount.amount).toBe(250000);
    expect(events[1]?.date).toBe("2026-12-20");
    expect((events[0]?.amount.amount ?? 0) + (events[1]?.amount.amount ?? 0)).toBe(500000);
  });

  it("calcula terço de férias corretamente", () => {
    const salary = money(300000); // R$ 3.000,00
    const vacation = buildVacationBonusChange(salary, calendarDate("2026-07-15"));

    expect(vacation.amount.amount).toBe(100000); // R$ 1.000,00
    expect(vacation.date).toBe("2026-07-15");
  });

  it("cria ajuste salarial (aumento de R$ 500)", () => {
    const delta = money(50000); // R$ 500
    const change = buildSalaryVariationChange(delta, calendarDate("2026-06-01"), 5);

    expect(change.kind).toBe("INCOME_CHANGE");
    expect(change.monthlyDelta.amount).toBe(50000);
    expect(change.startDate).toBe("2026-06-01");
  });

  it("analisa ponto de equilíbrio com base nas saídas do forecast", () => {
    const input: ForecastInput = {
      asOf: calendarDate("2026-05-01"),
      horizon: dateRange(calendarDate("2026-05-01"), calendarDate("2026-08-31")),
      openingBalance: money(100000),
      protectedReserve: zero("BRL"),
      obligations: [],
      recurringRules: [createDummyRule(200000)], // R$ 2.000 de renda
      cardStatements: [],
      debts: [],
    };

    const analysis = analyzeBreakEvenIncome(input);
    expect(analysis.currentMonthlyIncome.amount).toBe(200000);
    expect(analysis.isComfortable).toBe(true);
  });
});
