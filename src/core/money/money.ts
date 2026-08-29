/**
 * Money is stored as an integer number of minor units (centavos for BRL).
 *
 * Floating point is never used for monetary arithmetic: `0.1 + 0.2 !== 0.3`
 * would silently corrupt balances, forecasts and installment schedules.
 * See docs/DOMAIN.md and docs/adr/0003-money-as-integer-minor-units.md.
 */

export type CurrencyCode = "BRL";

export const DEFAULT_CURRENCY: CurrencyCode = "BRL";

/** Number of decimal places each currency uses. */
const CURRENCY_EXPONENT: Record<CurrencyCode, number> = { BRL: 2 };

export interface Money {
  /** Integer amount in minor units. May be negative. */
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function money(amount: number, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  if (!Number.isInteger(amount)) {
    throw new MoneyError(
      `Money must be an integer amount of minor units, received ${amount}. ` +
        `Use fromDecimal() or fromDecimalString() to convert a decimal value.`,
    );
  }
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError(`Money amount ${amount} exceeds the safe integer range.`);
  }
  return { amount, currency };
}

export function zero(currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  return { amount: 0, currency };
}

export function exponentOf(currency: CurrencyCode): number {
  return CURRENCY_EXPONENT[currency];
}

/**
 * Converts a decimal value (e.g. 1234.56) into Money.
 *
 * Only for boundaries where a decimal is unavoidable (user input, imports).
 * Rounds half away from zero, matching how people round currency by hand.
 */
export function fromDecimal(value: number, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`Cannot convert non-finite value ${value} to Money.`);
  }
  const factor = 10 ** exponentOf(currency);
  // Scale through a fixed-precision string first: 19.99 * 100 is 1998.9999...
  const scaled = Number((value * factor).toFixed(4));
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return money(rounded === 0 ? 0 : rounded, currency);
}

/**
 * Parses user input such as "1.234,56", "1234.56", "R$ 1.234,56" or "-42".
 *
 * Brazilian formatting uses "." for thousands and "," for decimals, but people
 * paste values from many sources, so both conventions are accepted. Returns
 * null on anything unparseable so callers can surface a friendly message.
 */
export function fromDecimalString(
  input: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Money | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const negative = trimmed.startsWith("-") || /^\(.*\)$/.test(trimmed);
  let digits = trimmed.replace(/[^\d.,]/g, "");
  if (digits === "") return null;

  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");

  if (lastComma > lastDot) {
    // "1.234,56" - comma is the decimal separator
    digits = digits.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // "1,234.56" - dot is the decimal separator
    digits = digits.replace(/,/g, "");
  } else {
    // no separator at all
    digits = digits.replace(/[.,]/g, "");
  }

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return null;

  const result = fromDecimal(parsed, currency);
  return negative ? negate(result) : result;
}

/** Converts to a plain decimal number. Presentation and export only. */
export function toDecimal(value: Money): number {
  return value.amount / 10 ** exponentOf(value.currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(
      `Cannot combine ${a.currency} with ${b.currency}. Multi-currency arithmetic is not supported.`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.amount, a.currency);
}

export function abs(a: Money): Money {
  return money(Math.abs(a.amount), a.currency);
}

export function sum(values: readonly Money[], currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  return values.reduce<Money>((acc, value) => add(acc, value), zero(currency));
}

/**
 * Multiplies by a plain factor, rounding half away from zero.
 *
 * Used for interest and percentage calculations. The rounding mode is explicit
 * because amortisation schedules must be reproducible.
 */
export function multiply(value: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`Cannot multiply Money by non-finite factor ${factor}.`);
  }
  const scaled = Number((value.amount * factor).toFixed(6));
  return money(Math.sign(scaled) * Math.round(Math.abs(scaled)), value.currency);
}

/** Applies a percentage: percentage(money(10000), 2.5) is R$ 2,50. */
export function percentage(value: Money, percent: number): Money {
  return multiply(value, percent / 100);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amount < b.amount) return -1;
  if (a.amount > b.amount) return 1;
  return 0;
}

export const isZero = (a: Money): boolean => a.amount === 0;
export const isPositive = (a: Money): boolean => a.amount > 0;
export const isNegative = (a: Money): boolean => a.amount < 0;
export const equals = (a: Money, b: Money): boolean =>
  a.currency === b.currency && a.amount === b.amount;
export const greaterThan = (a: Money, b: Money): boolean => compare(a, b) > 0;
export const greaterOrEqual = (a: Money, b: Money): boolean => compare(a, b) >= 0;
export const lessThan = (a: Money, b: Money): boolean => compare(a, b) < 0;
export const lessOrEqual = (a: Money, b: Money): boolean => compare(a, b) <= 0;

export function max(a: Money, b: Money): Money {
  return greaterThan(a, b) ? a : b;
}

export function min(a: Money, b: Money): Money {
  return lessThan(a, b) ? a : b;
}

/** Clamps to zero. Useful for "how much is still owed" style questions. */
export function clampToZero(a: Money): Money {
  return isNegative(a) ? zero(a.currency) : a;
}

/**
 * Splits an amount into `parts` pieces whose sum is exactly the original.
 *
 * R$ 100,00 in 3 parts becomes [33,34; 33,33; 33,33] and never
 * [33,33; 33,33; 33,33], which would quietly lose a centavo. The remainder
 * goes to the earliest parts, which is how Brazilian card issuers present
 * installments: the first one absorbs the difference.
 */
export function allocate(total: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new MoneyError(`Cannot allocate money into ${parts} parts; expected a positive integer.`);
  }
  const sign = total.amount < 0 ? -1 : 1;
  const magnitude = Math.abs(total.amount);
  const base = Math.floor(magnitude / parts);
  const remainder = magnitude - base * parts;

  return Array.from({ length: parts }, (_unused, index) =>
    money(sign * (base + (index < remainder ? 1 : 0)), total.currency),
  );
}

/**
 * Splits an amount proportionally to `weights`, preserving the total exactly.
 *
 * Used to spread a shared bill across household members and to split a single
 * payment across several obligations.
 */
export function allocateByWeights(total: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) {
    throw new MoneyError("Cannot allocate money with an empty weight list.");
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new MoneyError("Allocation weights must be finite and non-negative.");
  }
  const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
  if (totalWeight === 0) {
    return allocate(total, weights.length);
  }

  const sign = total.amount < 0 ? -1 : 1;
  const magnitude = Math.abs(total.amount);

  const exact = weights.map((weight) => (magnitude * weight) / totalWeight);
  const floors = exact.map((value) => Math.floor(value));
  let leftover = magnitude - floors.reduce((acc, value) => acc + value, 0);

  // Largest fractional remainder wins the spare minor units.
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const result = [...floors];
  for (const { index } of order) {
    if (leftover <= 0) break;
    result[index] = (result[index] ?? 0) + 1;
    leftover -= 1;
  }

  return result.map((amount) => money(sign * amount, total.currency));
}

/** Serialised form used by Firestore documents and JSON payloads. */
export interface MoneyDTO {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export function toDTO(value: Money): MoneyDTO {
  return { amount: value.amount, currency: value.currency };
}

export function fromDTO(dto: MoneyDTO): Money {
  return money(dto.amount, dto.currency);
}
