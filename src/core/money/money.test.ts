import { describe, expect, it } from "vitest";
import {
  add,
  allocate,
  allocateByWeights,
  clampToZero,
  compare,
  fromDecimal,
  fromDecimalString,
  money,
  MoneyError,
  multiply,
  negate,
  percentage,
  subtract,
  sum,
  toDecimal,
  zero,
} from "./money";

describe("money construction", () => {
  it("stores minor units as integers", () => {
    expect(money(12345)).toEqual({ amount: 12345, currency: "BRL" });
  });

  it("rejects decimals so a rounding bug can never reach a balance", () => {
    expect(() => money(123.45)).toThrow(MoneyError);
  });

  it("rejects amounts beyond the safe integer range", () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError);
  });
});

describe("decimal conversion", () => {
  it("converts a decimal to minor units", () => {
    expect(fromDecimal(1234.56).amount).toBe(123456);
  });

  it("survives binary floating point representation errors", () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE-754.
    expect(fromDecimal(19.99).amount).toBe(1999);
    expect(fromDecimal(1.005).amount).toBe(101);
    expect(fromDecimal(0.07).amount).toBe(7);
  });

  it("rounds negatives away from zero", () => {
    expect(fromDecimal(-2.345).amount).toBe(-235);
  });

  it("round-trips through toDecimal", () => {
    expect(toDecimal(money(123456))).toBe(1234.56);
  });
});

describe("parsing user input", () => {
  it.each([
    ["1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["1234,56", 123456],
    ["1,234.56", 123456],
    ["1234.56", 123456],
    ["1234", 123400],
    ["0,01", 1],
    ["-500,00", -50000],
    ["  89,90  ", 8990],
  ])("parses %s", (input, expected) => {
    expect(fromDecimalString(input)?.amount).toBe(expected);
  });

  it("returns null for unparseable input instead of guessing", () => {
    expect(fromDecimalString("")).toBeNull();
    expect(fromDecimalString("abc")).toBeNull();
  });
});

describe("arithmetic", () => {
  it("adds and subtracts without floating point drift", () => {
    // 0.1 + 0.2 would not equal 0.3 with floats.
    expect(add(fromDecimal(0.1), fromDecimal(0.2))).toEqual(fromDecimal(0.3));
  });

  it("accumulates a thousand centavos exactly", () => {
    const values = Array.from({ length: 1000 }, () => fromDecimal(0.01));
    expect(sum(values)).toEqual(fromDecimal(10));
  });

  it("subtracts into negative territory", () => {
    expect(subtract(money(1000), money(2500)).amount).toBe(-1500);
  });

  it("negates and clamps", () => {
    expect(negate(money(500)).amount).toBe(-500);
    expect(clampToZero(money(-500)).amount).toBe(0);
    expect(clampToZero(money(500)).amount).toBe(500);
  });

  it("multiplies with explicit rounding", () => {
    expect(multiply(money(10000), 0.0175).amount).toBe(175);
    expect(multiply(money(333), 1 / 3).amount).toBe(111);
  });

  it("applies percentages", () => {
    expect(percentage(money(10000), 2.5).amount).toBe(250);
  });

  it("refuses to mix currencies", () => {
    const brl = money(100, "BRL");
    const fake = { amount: 100, currency: "USD" } as unknown as typeof brl;
    expect(() => add(brl, fake)).toThrow(MoneyError);
  });

  it("compares", () => {
    expect(compare(money(1), money(2))).toBe(-1);
    expect(compare(money(2), money(2))).toBe(0);
    expect(compare(money(3), money(2))).toBe(1);
  });

  it("starts from zero", () => {
    expect(sum([])).toEqual(zero());
  });
});

describe("allocate - installment splitting", () => {
  it("never loses a centavo", () => {
    const parts = allocate(fromDecimal(100), 3);
    expect(parts.map((p) => p.amount)).toEqual([3334, 3333, 3333]);
    expect(sum(parts)).toEqual(fromDecimal(100));
  });

  it("splits evenly when it divides exactly", () => {
    const parts = allocate(fromDecimal(1200), 6);
    expect(parts.every((p) => p.amount === 20000)).toBe(true);
    expect(sum(parts)).toEqual(fromDecimal(1200));
  });

  it("puts the remainder on the first installments, like card issuers do", () => {
    const parts = allocate(fromDecimal(1000), 7);
    expect(parts[0]?.amount).toBe(14286);
    expect(parts[6]?.amount).toBe(14285);
    expect(sum(parts)).toEqual(fromDecimal(1000));
  });

  it("preserves the total for every split from 1 to 60", () => {
    const total = fromDecimal(9876.54);
    for (let parts = 1; parts <= 60; parts += 1) {
      expect(sum(allocate(total, parts))).toEqual(total);
    }
  });

  it("handles negative totals", () => {
    const parts = allocate(fromDecimal(-100), 3);
    expect(sum(parts)).toEqual(fromDecimal(-100));
    expect(parts[0]?.amount).toBe(-3334);
  });

  it("rejects invalid part counts", () => {
    expect(() => allocate(money(100), 0)).toThrow(MoneyError);
    expect(() => allocate(money(100), 2.5)).toThrow(MoneyError);
  });
});

describe("allocateByWeights - proportional splitting", () => {
  it("splits proportionally and preserves the total", () => {
    const parts = allocateByWeights(fromDecimal(1000), [1, 1, 2]);
    expect(parts.map((p) => p.amount)).toEqual([25000, 25000, 50000]);
    expect(sum(parts)).toEqual(fromDecimal(1000));
  });

  it("distributes the remainder to the largest fractions", () => {
    const parts = allocateByWeights(money(100), [1, 1, 1]);
    expect(sum(parts).amount).toBe(100);
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33]);
  });

  it("falls back to an even split when all weights are zero", () => {
    const parts = allocateByWeights(money(100), [0, 0]);
    expect(parts.map((p) => p.amount)).toEqual([50, 50]);
  });

  it("rejects negative weights", () => {
    expect(() => allocateByWeights(money(100), [1, -1])).toThrow(MoneyError);
    expect(() => allocateByWeights(money(100), [])).toThrow(MoneyError);
  });
});
