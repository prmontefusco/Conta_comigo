import { describe, expect, it } from "vitest";
import { aDebt, aReserve, brl, on } from "@/modules/shared/testing/builders";
import { computeAchievements, type ComputeAchievementsInput } from "./achievements";

const ASOF = on("2026-09-10");

function inputWith(overrides: Partial<ComputeAchievementsInput> = {}): ComputeAchievementsInput {
  return {
    asOf: ASOF,
    debts: [],
    paidDebtInstallments: new Map(),
    cardStatements: [],
    reserves: [],
    monthlyEssentials: brl(2000),
    overdueBillsCount: 0,
    ...overrides,
  };
}

const loan = aDebt({
  id: "loan",
  description: "Empréstimo pessoal",
  principalContracted: brl(12000),
  installmentAmount: brl(1000),
  installmentCount: 12,
  firstDueDate: on("2026-01-05"),
  amortisationSystem: "SIMPLE",
});

describe("debts", () => {
  it("celebrates a debt with no balance left", () => {
    const { unlocked } = computeAchievements(
      inputWith({
        debts: [loan],
        paidDebtInstallments: new Map([["loan", Array.from({ length: 12 }, (_u, i) => i + 1)]]),
      }),
    );

    const paid = unlocked.find((item) => item.id === "debt-paid-loan");
    expect(paid?.title).toBe("Empréstimo pessoal sem saldo devedor");
    expect(paid?.progress).toBe(1);
  });

  it("says what is missing while it is not paid", () => {
    const { next } = computeAchievements(
      inputWith({ debts: [loan], paidDebtInstallments: new Map([["loan", [1, 2, 3]]]) }),
    );

    const goal = next.find((item) => item.id === "debt-paid-loan");
    expect(goal?.title).toBe("Zerar Empréstimo pessoal");
    expect(goal?.remaining).toBe("faltam 9 parcelas");
    expect(goal?.progress).toBeCloseTo(0.25, 2);
  });

  it("offers only the next quarter, not every step at once", () => {
    const { next } = computeAchievements(
      inputWith({ debts: [loan], paidDebtInstallments: new Map([["loan", [1, 2, 3]]]) }),
    );

    const steps = next.filter((item) => item.kind === "DEBT_PROGRESS");
    expect(steps).toHaveLength(1);
    expect(steps[0]?.title).toContain("50%");
  });

  it("keeps the quarters already reached as achievements", () => {
    const { unlocked } = computeAchievements(
      inputWith({
        debts: [loan],
        paidDebtInstallments: new Map([["loan", [1, 2, 3, 4, 5, 6, 7]]]),
      }),
    );

    const steps = unlocked.filter((item) => item.kind === "DEBT_PROGRESS");
    expect(steps.map((item) => item.title)).toEqual([
      expect.stringContaining("25%"),
      expect.stringContaining("50%"),
    ]);
  });

  it("carries the person responsible, when there is one", () => {
    const { next } = computeAchievements(
      inputWith({ debts: [aDebt({ id: "d", responsibleMemberId: "member-elis" })] }),
    );

    expect(next.find((item) => item.kind === "DEBT_PAID")?.memberId).toBe("member-elis");
  });
});

describe("the reserve", () => {
  it("is achieved once the starter target is reached", () => {
    const { unlocked } = computeAchievements(
      inputWith({ reserves: [aReserve({ purpose: "EMERGENCY", currentAmount: brl(1000) })] }),
    );

    expect(unlocked.some((item) => item.id === "starter-reserve")).toBe(true);
  });

  it("states how much is missing otherwise", () => {
    const { next } = computeAchievements(
      inputWith({ reserves: [aReserve({ purpose: "EMERGENCY", currentAmount: brl(400) })] }),
    );

    const goal = next.find((item) => item.id === "starter-reserve");
    expect(goal?.remaining).toContain("600");
  });
});

describe("bills and the month", () => {
  it("counts no overdue bills as an achievement", () => {
    const { unlocked } = computeAchievements(inputWith({ overdueBillsCount: 0 }));
    expect(unlocked.some((item) => item.id === "no-overdue-bills")).toBe(true);
  });

  it("turns it into a goal when something is late", () => {
    const { next, unlocked } = computeAchievements(inputWith({ overdueBillsCount: 2 }));

    expect(unlocked.some((item) => item.id === "no-overdue-bills")).toBe(false);
    expect(next.find((item) => item.id === "no-overdue-bills")?.remaining).toBe(
      "2 contas a regularizar",
    );
  });

  it("celebrates a month that closed in the black", () => {
    const { unlocked } = computeAchievements(
      inputWith({ lastMonth: { received: brl(5000), spent: brl(4200) } }),
    );

    const month = unlocked.find((item) => item.id === "positive-month");
    expect(month?.detail).toContain("800");
  });

  it("does not scold a month that did not", () => {
    const { next } = computeAchievements(
      inputWith({ lastMonth: { received: brl(4000), spent: brl(4500) } }),
    );

    const month = next.find((item) => item.id === "positive-month");
    expect(month?.detail).toContain("faltaram");
    expect(month?.remaining).toBe("gastar menos do que entra em um mês");
  });

  it("says nothing about a month it was not given", () => {
    const { unlocked, next } = computeAchievements(inputWith());
    expect([...unlocked, ...next].some((item) => item.kind === "POSITIVE_MONTH")).toBe(false);
  });
});

describe("ordering", () => {
  it("puts the closest goal first", () => {
    const almost = aDebt({
      id: "almost",
      description: "Quase lá",
      principalContracted: brl(12000),
      installmentCount: 12,
      installmentAmount: brl(1000),
      amortisationSystem: "SIMPLE",
    });
    const far = aDebt({
      id: "far",
      description: "Longe",
      principalContracted: brl(12000),
      installmentCount: 12,
      installmentAmount: brl(1000),
      amortisationSystem: "SIMPLE",
    });

    const { next } = computeAchievements(
      inputWith({
        debts: [far, almost],
        paidDebtInstallments: new Map([
          ["almost", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
          ["far", [1]],
        ]),
      }),
    );

    expect(next[0]?.id).toBe("debt-paid-almost");
  });
});
