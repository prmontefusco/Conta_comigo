import { describe, expect, it } from "vitest";
import { EDUCATION_PILLS, pickPills, type PillContext } from "./pills";

const calm: PillContext = {
  hasOverdueStatement: false,
  highestCardUtilisation: 0.2,
  hasOverdraftDebt: false,
  debtsWithoutKnownRate: 0,
  hasCollateralDebt: false,
  hasEssentialBillOverdue: false,
  starterReserveComplete: true,
  hasBudgetForThisMonth: true,
  overspentCategories: 0,
  monthlyNetAmount: 50000,
  committedInstallmentsAmount: 0,
};

describe("which pill shows up", () => {
  it("puts the situation the household is in first", () => {
    const pills = pickPills({ ...calm, hasOverdueStatement: true });
    expect(pills[0]?.id).toBe("rotativo");
  });

  it("puts an essential service about to be cut at the top too", () => {
    const pills = pickPills({ ...calm, hasEssentialBillOverdue: true });
    expect(pills[0]?.topic).toBe("DIREITOS");
    expect(pills[0]?.id).toBe("essencial-em-atraso");
  });

  it("prefers the collateral warning over generic advice", () => {
    const pills = pickPills({ ...calm, hasCollateralDebt: true });
    expect(pills.map((pill) => pill.id)).toContain("garantia-primeiro");
    expect(pills[0]?.id).toBe("garantia-primeiro");
  });

  it("stays quiet about a limit that is not high", () => {
    expect(pickPills(calm, 10).map((pill) => pill.id)).not.toContain("limite-comprometido");
    expect(
      pickPills({ ...calm, highestCardUtilisation: 0.9 }, 10).map((pill) => pill.id),
    ).toContain("limite-comprometido");
  });

  it("does not nag about the starter reserve once it exists", () => {
    expect(pickPills(calm, 10).map((pill) => pill.id)).not.toContain("reserva-de-partida");
    expect(
      pickPills({ ...calm, starterReserveComplete: false }, 10).map((pill) => pill.id),
    ).toContain("reserva-de-partida");
  });
});

describe("the card is never empty and never floods", () => {
  it("always has something to say", () => {
    expect(pickPills(calm).length).toBeGreaterThan(0);
  });

  it("respects the limit asked for", () => {
    const pills = pickPills(
      {
        ...calm,
        hasOverdueStatement: true,
        hasOverdraftDebt: true,
        debtsWithoutKnownRate: 2,
        starterReserveComplete: false,
      },
      3,
    );

    expect(pills).toHaveLength(3);
    expect(new Set(pills.map((pill) => pill.id)).size).toBe(3);
  });
});

describe("the content itself", () => {
  it("never names an investment product", () => {
    const forbidden = /\b(CDB|Tesouro|LCI|LCA|poupança|fundo|ações|cripto)\b/i;
    for (const pill of EDUCATION_PILLS) {
      expect(pill.body, pill.id).not.toMatch(forbidden);
    }
  });

  it("stays short enough to read on a phone", () => {
    for (const pill of EDUCATION_PILLS) {
      expect(pill.body.length, pill.id).toBeLessThan(400);
      expect(pill.title.length, pill.id).toBeLessThan(60);
    }
  });
});
