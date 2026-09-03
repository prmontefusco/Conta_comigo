import { describe, expect, it } from "vitest";
import { brl } from "@/modules/shared/testing/builders";
import { evaluateProposal, proposalCapacity } from "./affordable-proposal";

const income = brl(4000);

const capacity = proposalCapacity({
  monthlyIncome: income,
  monthlyEssentials: brl(2600),
  monthlyDebtPayments: brl(400),
});

describe("what fits", () => {
  it("is what is left after the month is paid for", () => {
    expect(capacity.leftOver).toEqual(brl(1000));
  });

  it("is capped by the commitment ratio, not only by the cash", () => {
    // 30% of R$ 4.000 is R$ 1.200; R$ 400 already goes to debt.
    expect(capacity.ratioCeiling).toEqual(brl(800));
    expect(capacity.maxInstallment).toEqual(brl(800));
    expect(capacity.limitedBy).toBe("RATIO");
  });

  it("is capped by the cash when the cash runs out first", () => {
    const tight = proposalCapacity({
      monthlyIncome: brl(4000),
      monthlyEssentials: brl(3500),
      monthlyDebtPayments: brl(200),
    });

    expect(tight.maxInstallment).toEqual(brl(300));
    expect(tight.limitedBy).toBe("CASH");
  });

  it("says plainly when there is nothing left to promise", () => {
    const broke = proposalCapacity({
      monthlyIncome: brl(3000),
      monthlyEssentials: brl(3000),
      monthlyDebtPayments: brl(300),
    });

    expect(broke.maxInstallment).toEqual(brl(0));
    expect(broke.limitedBy).toBe("NOTHING_LEFT");
  });

  it("takes the saving the household wants to keep doing seriously", () => {
    const saving = proposalCapacity({
      monthlyIncome: income,
      monthlyEssentials: brl(2600),
      monthlyDebtPayments: brl(400),
      monthlySaving: brl(200),
    });

    expect(saving.leftOver).toEqual(brl(800));
  });
});

describe("judging an offer", () => {
  it("accepts one comfortably inside both ceilings", () => {
    const result = evaluateProposal(
      capacity,
      { installmentAmount: brl(500), installmentCount: 12 },
      income,
    );

    expect(result.verdict).toBe("FITS");
    expect(result.headroom).toEqual(brl(300));
  });

  it("calls an offer tight when it eats the whole margin", () => {
    const result = evaluateProposal(
      capacity,
      { installmentAmount: brl(900), installmentCount: 12 },
      income,
    );

    expect(result.verdict).toBe("TIGHT");
  });

  it("refuses one larger than what is left", () => {
    const result = evaluateProposal(
      capacity,
      { installmentAmount: brl(1200), installmentCount: 10 },
      income,
    );

    expect(result.verdict).toBe("DOES_NOT_FIT");
    expect(result.headroom.amount).toBeLessThan(0);
  });

  it("adds the entry payment to what the agreement really costs", () => {
    const result = evaluateProposal(
      capacity,
      { installmentAmount: brl(500), installmentCount: 10, downPayment: brl(1000) },
      income,
    );

    expect(result.totalPaid).toEqual(brl(6000));
  });
});

describe("what the offer hides", () => {
  it("solves the monthly rate inside the instalments", () => {
    const result = evaluateProposal(
      capacity,
      { installmentAmount: brl(500), installmentCount: 24, claimedBalance: brl(10000) },
      income,
    );

    expect(result.impliedMonthlyRate).not.toBeNull();
    expect(result.impliedMonthlyRate!).toBeGreaterThan(1);
  });

  it("says nothing about the rate when the creditor stated no balance", () => {
    const result = evaluateProposal(
      capacity,
      { installmentAmount: brl(500), installmentCount: 24 },
      income,
    );

    expect(result.impliedMonthlyRate).toBeNull();
    expect(result.differenceVsClaimed).toBeNull();
  });

  it("shows when the agreement costs more than the balance it settles", () => {
    const result = evaluateProposal(
      capacity,
      { installmentAmount: brl(500), installmentCount: 24, claimedBalance: brl(10000) },
      income,
    );

    // R$ 12.000 paid to settle R$ 10.000.
    expect(result.differenceVsClaimed).toEqual(brl(-2000));
  });

  it("shows a real discount as a positive difference", () => {
    const result = evaluateProposal(
      capacity,
      { installmentAmount: brl(300), installmentCount: 10, claimedBalance: brl(5000) },
      income,
    );

    expect(result.differenceVsClaimed).toEqual(brl(2000));
  });
});
