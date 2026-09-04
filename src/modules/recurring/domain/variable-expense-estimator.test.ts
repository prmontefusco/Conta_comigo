import { describe, expect, it } from "vitest";
import { anExpense, anObligation, brl, on } from "@/modules/shared/testing/builders";
import { estimateVariableExpense } from "./variable-expense-estimator";

describe("estimateVariableExpense", () => {
  const asOf = on("2026-09-15"); // September 2026. Prior complete months: 2026-08, 2026-07, 2026-06.

  it("calculates average, median, min, max and safety margin for 3 past months", () => {
    const transactions = [
      anExpense({
        id: "tx-jun",
        amount: brl(150),
        competenceDate: on("2026-06-10"),
        categoryId: "cat-luz",
        description: "Conta de Energia Junho",
      }),
      anExpense({
        id: "tx-jul",
        amount: brl(180),
        competenceDate: on("2026-07-10"),
        categoryId: "cat-luz",
        description: "Conta de Energia Julho",
      }),
      anExpense({
        id: "tx-ago",
        amount: brl(210),
        competenceDate: on("2026-08-10"),
        categoryId: "cat-luz",
        description: "Conta de Energia Agosto",
      }),
    ];

    const estimate = estimateVariableExpense({
      transactions,
      obligations: [],
      asOf,
      categoryId: "cat-luz",
      lookbackMonths: 3,
    });

    expect(estimate.hasSufficientData).toBe(true);
    expect(estimate.sampleCount).toBe(3);
    // (150 + 180 + 210) / 3 = 180
    expect(estimate.average).toEqual(brl(180));
    expect(estimate.median).toEqual(brl(180));
    expect(estimate.lowest).toEqual(brl(150));
    expect(estimate.highest).toEqual(brl(210));
    // 180 + 10% = 198
    expect(estimate.withSafetyMargin).toEqual(brl(198));
  });

  it("ignores the current partial month (asOf month) to avoid partial-month distortion", () => {
    const transactions = [
      anExpense({
        id: "tx-ago",
        amount: brl(200),
        competenceDate: on("2026-08-10"),
        categoryId: "cat-agua",
      }),
      anExpense({
        id: "tx-set-atual",
        amount: brl(50), // bill only partially paid or early payment in current month
        competenceDate: on("2026-09-02"),
        categoryId: "cat-agua",
      }),
    ];

    const estimate = estimateVariableExpense({
      transactions,
      obligations: [],
      asOf,
      categoryId: "cat-agua",
      lookbackMonths: 3,
    });

    expect(estimate.sampleCount).toBe(1);
    expect(estimate.average).toEqual(brl(200));
  });

  it("deduplicates when a transaction settled an obligation so the bill is not counted twice", () => {
    const ob = anObligation({
      id: "ob-luz-jul",
      amount: brl(190),
      settledAmount: brl(190),
      status: "SETTLED",
      competenceDate: on("2026-07-05"),
      categoryId: "cat-luz",
      description: "Boleto Enel Julho",
    });

    const tx = anExpense({
      id: "tx-luz-jul",
      amount: brl(190),
      competenceDate: on("2026-07-05"),
      categoryId: "cat-luz",
      description: "Pagamento Boleto Enel",
      settlesObligationId: "ob-luz-jul",
    });

    const estimate = estimateVariableExpense({
      transactions: [tx],
      obligations: [ob],
      asOf,
      categoryId: "cat-luz",
      lookbackMonths: 3,
    });

    expect(estimate.sampleCount).toBe(1);
    expect(estimate.average).toEqual(brl(190));
  });

  it("includes settled obligations when paid directly without an associated transaction", () => {
    const ob = anObligation({
      id: "ob-gas-jul",
      amount: brl(120),
      settledAmount: brl(120),
      status: "SETTLED",
      competenceDate: on("2026-07-10"),
      categoryId: "cat-gas",
      description: "Gás de cozinha",
    });

    const estimate = estimateVariableExpense({
      transactions: [],
      obligations: [ob],
      asOf,
      categoryId: "cat-gas",
      lookbackMonths: 3,
    });

    expect(estimate.sampleCount).toBe(1);
    expect(estimate.average).toEqual(brl(120));
  });

  it("filters by recurringRuleId when provided", () => {
    const ob = anObligation({
      id: "ob-rule-1",
      amount: brl(140),
      settledAmount: brl(140),
      status: "SETTLED",
      competenceDate: on("2026-08-05"),
      source: { recurringRuleId: "rule-sabesp" },
      description: "Sabesp Água",
    });

    const estimate = estimateVariableExpense({
      transactions: [],
      obligations: [ob],
      asOf,
      recurringRuleId: "rule-sabesp",
      lookbackMonths: 3,
    });

    expect(estimate.sampleCount).toBe(1);
    expect(estimate.average).toEqual(brl(140));
  });

  it("filters by searchTerms in description when category is omitted", () => {
    const tx = anExpense({
      id: "tx-enel",
      amount: brl(220),
      competenceDate: on("2026-08-12"),
      description: "Enel Distribuição São Paulo",
    });

    const estimate = estimateVariableExpense({
      transactions: [tx],
      obligations: [],
      asOf,
      searchTerms: ["enel", "luz"],
      lookbackMonths: 3,
    });

    expect(estimate.sampleCount).toBe(1);
    expect(estimate.average).toEqual(brl(220));
  });

  it("returns zero and hasSufficientData: false when there is no historical data", () => {
    const estimate = estimateVariableExpense({
      transactions: [],
      obligations: [],
      asOf,
      categoryId: "cat-inexistente",
      lookbackMonths: 3,
    });

    expect(estimate.hasSufficientData).toBe(false);
    expect(estimate.sampleCount).toBe(0);
    expect(estimate.average).toEqual(brl(0));
    expect(estimate.median).toEqual(brl(0));
  });
});
