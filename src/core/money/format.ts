import { type Money, toDecimal, isNegative, isZero } from "./money";

const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, currency: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${currency}|${JSON.stringify(options)}`;
  let cached = FORMATTER_CACHE.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, { style: "currency", currency, ...options });
    FORMATTER_CACHE.set(key, cached);
  }
  return cached;
}

export interface FormatMoneyOptions {
  locale?: string;
  /** Hide the currency symbol, e.g. inside a table column already labelled BRL. */
  omitSymbol?: boolean;
  /** Round to whole units. Used in dense charts, never in ledgers. */
  compact?: boolean;
  /** Render "+" for positive amounts. Used in movement lists. */
  showSign?: boolean;
}

/** Formats Money for display. Never use the result for arithmetic. */
export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const { locale = "pt-BR", omitSymbol = false, compact = false, showSign = false } = options;

  const intlOptions: Intl.NumberFormatOptions = compact
    ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  if (omitSymbol) {
    intlOptions.style = "decimal";
  }

  const formatted = omitSymbol
    ? new Intl.NumberFormat(locale, intlOptions).format(toDecimal(value))
    : formatter(locale, value.currency, intlOptions).format(toDecimal(value));

  if (showSign && !isNegative(value) && !isZero(value)) {
    return `+${formatted}`;
  }
  return formatted;
}
