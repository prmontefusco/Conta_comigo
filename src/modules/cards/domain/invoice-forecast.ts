import { addMonthsToKey, type MonthKey } from "@/core/date/calendar-date";
import { type Money, sum, zero } from "@/core/money/money";
import type { CardInvoiceDoc } from "@/modules/shared/infrastructure/schemas";

/** Imported invoice totals are confirmed obligations. Lines are estimates only. */
export function forecastImportedInvoices(
  invoices: readonly CardInvoiceDoc[],
  fromMonth: MonthKey,
  toMonth: MonthKey,
) {
  const latestByCardAndMonth = new Map<string, CardInvoiceDoc>();
  for (const invoice of invoices) {
    const key = `${invoice.creditCardId}:${invoice.referenceMonth}`;
    const previous = latestByCardAndMonth.get(key);
    if (!previous || previous.createdAt < invoice.createdAt) latestByCardAndMonth.set(key, invoice);
  }
  const amounts = new Map<string, Map<string, { amount: Money; sourceMonth: MonthKey }>>();
  for (const invoice of latestByCardAndMonth.values()) {
    for (const line of invoice.forecastLines) {
      for (let index = 0; index < line.remainingMonths; index++) {
        const month = addMonthsToKey(line.firstFutureMonth, index);
        if (month < fromMonth || month > toMonth) continue;
        const key = `${invoice.creditCardId}:${month}`;
        // An imported invoice for the target month is confirmed, not estimated.
        if (latestByCardAndMonth.has(key)) continue;
        const lines = amounts.get(key) ?? new Map();
        const previous = lines.get(line.key);
        if (!previous || previous.sourceMonth < invoice.referenceMonth) {
          lines.set(line.key, { amount: line.amount, sourceMonth: invoice.referenceMonth });
        }
        amounts.set(key, lines);
      }
    }
  }
  return [...amounts].map(([key, values]) => {
    const separator = key.lastIndexOf(":");
    return {
      creditCardId: key.slice(0, separator),
      month: key.slice(separator + 1) as MonthKey,
      amount: sum([...values.values()].map((item) => item.amount)),
    };
  });
}

export function forecastAmountFor(
  forecast: ReturnType<typeof forecastImportedInvoices>,
  cardId: string,
  month: MonthKey,
): Money {
  return (
    forecast.find((item) => item.creditCardId === cardId && item.month === month)?.amount ?? zero()
  );
}
