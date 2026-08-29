import { describe, expect, it } from "vitest";
import { sum } from "@/core/money/money";
import { aDebt, brl, on } from "@/modules/shared/testing/builders";
import {
  buildSchedule,
  disbursementCost,
  outstandingPrincipal,
  priceInstallment,
  summariseDebts,
  upcomingInstallments,
} from "./debt";

describe("simplified schedule (no rate known)", () => {
  const debt = aDebt({
    principalContracted: brl(10000),
    installmentCount: 10,
    installmentAmount: brl(1000),
    firstDueDate: on("2026-09-01"),
    amortisationSystem: "SIMPLE",
  });

  it("produces one installment per month", () => {
    const schedule = buildSchedule(debt);
    expect(schedule).toHaveLength(10);
    expect(schedule[0]?.dueDate).toBe("2026-09-01");
    expect(schedule[9]?.dueDate).toBe("2027-06-01");
  });

  it("is honest that the interest split is unknown", () => {
    const schedule = buildSchedule(debt);
    expect(schedule.every((item) => item.breakdownKnown === false)).toBe(true);
    expect(schedule.every((item) => item.interest.amount === 0)).toBe(true);
  });

  it("amortises down to exactly zero", () => {
    const schedule = buildSchedule(debt);
    expect(schedule.at(-1)?.outstandingAfter).toEqual(brl(0));
    expect(sum(schedule.map((item) => item.principal))).toEqual(brl(10000));
  });
});

describe("Price schedule", () => {
  const debt = aDebt({
    principalContracted: brl(10000),
    installmentCount: 12,
    interestRateMonthly: 2,
    amortisationSystem: "PRICE",
    installmentAmount: undefined,
    firstDueDate: on("2026-09-01"),
  });

  it("computes a constant installment", () => {
    // 10.000 at 2% a month over 12 months is roughly R$ 945,60.
    expect(priceInstallment(brl(10000), 0.02, 12).amount).toBeGreaterThan(94000);
    expect(priceInstallment(brl(10000), 0.02, 12).amount).toBeLessThan(95000);
  });

  it("shifts the mix from interest to principal over time", () => {
    const schedule = buildSchedule(debt);
    const first = schedule[0]!;
    const last = schedule.at(-1)!;
    expect(first.interest.amount).toBeGreaterThan(last.interest.amount);
    expect(first.principal.amount).toBeLessThan(last.principal.amount);
  });

  it("pays the debt off exactly", () => {
    const schedule = buildSchedule(debt);
    expect(schedule.at(-1)?.outstandingAfter).toEqual(brl(0));
    expect(sum(schedule.map((item) => item.principal))).toEqual(brl(10000));
  });

  it("reports interest as a real cost", () => {
    const totalInterest = sum(buildSchedule(debt).map((item) => item.interest));
    expect(totalInterest.amount).toBeGreaterThan(0);
  });
});

describe("SAC schedule", () => {
  const debt = aDebt({
    principalContracted: brl(12000),
    installmentCount: 12,
    interestRateMonthly: 1,
    amortisationSystem: "SAC",
    installmentAmount: undefined,
    firstDueDate: on("2026-09-01"),
  });

  it("keeps amortisation constant and lets the installment fall", () => {
    const schedule = buildSchedule(debt);
    expect(schedule[0]!.principal).toEqual(schedule[5]!.principal);
    expect(schedule[0]!.total.amount).toBeGreaterThan(schedule.at(-1)!.total.amount);
  });

  it("still amortises to zero", () => {
    expect(buildSchedule(debt).at(-1)?.outstandingAfter).toEqual(brl(0));
  });
});

describe("fees and insurance", () => {
  it("adds them to every installment without touching the principal", () => {
    const debt = aDebt({
      principalContracted: brl(6000),
      installmentCount: 6,
      installmentAmount: brl(1000),
      monthlyFees: brl(15),
      monthlyInsurance: brl(25),
    });
    const schedule = buildSchedule(debt);
    expect(schedule[0]?.total).toEqual(brl(1040));
    expect(schedule[0]?.principal).toEqual(brl(1000));
    expect(sum(schedule.map((item) => item.principal))).toEqual(brl(6000));
  });
});

describe("outstanding balance", () => {
  const debt = aDebt({
    principalContracted: brl(10000),
    installmentCount: 10,
    installmentAmount: brl(1000),
  });

  it("starts at the full contracted amount", () => {
    expect(outstandingPrincipal(debt, [])).toEqual(brl(10000));
  });

  it("falls as installments are paid", () => {
    expect(outstandingPrincipal(debt, [1, 2, 3])).toEqual(brl(7000));
  });

  it("is zero once the debt is settled", () => {
    expect(outstandingPrincipal({ ...debt, status: "SETTLED" }, [])).toEqual(brl(0));
  });
});

describe("upcoming installments", () => {
  const debt = aDebt({
    installmentCount: 10,
    installmentAmount: brl(1000),
    firstDueDate: on("2026-09-01"),
  });

  it("excludes installments already past and those already paid", () => {
    const upcoming = upcomingInstallments(debt, on("2026-11-15"), [1, 2]);
    expect(upcoming[0]?.dueDate).toBe("2026-12-01");
    expect(upcoming).toHaveLength(7);
  });
});

describe("disbursement cost", () => {
  it("surfaces fees deducted up front", () => {
    const debt = aDebt({ principalContracted: brl(10000), amountDisbursed: brl(9400) });
    expect(disbursementCost(debt)).toEqual(brl(600));
  });

  it("is zero when the full amount arrived", () => {
    expect(disbursementCost(aDebt())).toEqual(brl(0));
  });
});

describe("household debt summary", () => {
  it("reports what next month actually demands", () => {
    const loan = aDebt({
      id: "debt-1",
      installmentCount: 10,
      installmentAmount: brl(1000),
      firstDueDate: on("2026-09-01"),
    });
    const financing = aDebt({
      id: "debt-2",
      kind: "VEHICLE_FINANCING",
      principalContracted: brl(24000),
      installmentCount: 24,
      installmentAmount: brl(1000),
      firstDueDate: on("2026-09-15"),
    });

    const summary = summariseDebts([loan, financing], on("2026-08-28"));

    expect(summary.activeDebts).toBe(2);
    expect(summary.monthlyCommitment).toEqual(brl(2000));
    expect(summary.totalOutstanding).toEqual(brl(34000));
    expect(summary.remainingInstallments).toBe(34);
  });

  it("ignores settled debts", () => {
    const summary = summariseDebts([aDebt({ status: "SETTLED" })], on("2026-08-28"));
    expect(summary.activeDebts).toBe(0);
    expect(summary.totalOutstanding).toEqual(brl(0));
  });
});
