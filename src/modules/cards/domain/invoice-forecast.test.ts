import { describe, expect, it } from "vitest";
import { monthKey } from "@/core/date/calendar-date";
import { aCardPurchase, aCreditCard, brl, on } from "@/modules/shared/testing/builders";
import type { CardInvoiceDoc } from "@/modules/shared/infrastructure/schemas";
import { projectStatements } from "./credit-card";
import { forecastImportedInvoices } from "./invoice-forecast";

const card = aCreditCard({ closingDay: 12, dueDay: 18 });
const invoice = {
  id: "invoice-1",
  creditCardId: card.id,
  referenceMonth: monthKey("2026-09"),
  dueDate: on("2026-09-18"),
  totalAmount: brl(422.65),
  createdAt: "2026-09-15T12:00:00.000Z",
  forecastLines: [
    {
      key: "store:2399:2:4",
      description: "Loja",
      amount: brl(23.99),
      firstFutureMonth: monthKey("2026-10"),
      remainingMonths: 2,
    },
  ],
  installmentOffers: [],
} as unknown as CardInvoiceDoc;

describe("imported invoice boundary", () => {
  it("uses only the issuer total for the confirmed month, not the imported installment lines", () => {
    const manual = aCardPurchase({
      creditCardId: card.id,
      purchaseDate: on("2026-09-08"),
      totalAmount: brl(100),
      installmentCount: 1,
    });
    const statements = projectStatements(
      card,
      [manual],
      [],
      monthKey("2026-08"),
      monthKey("2026-11"),
      on("2026-09-15"),
      [invoice],
    );
    expect(statements.map((item) => item.referenceMonth)).toEqual(["2026-09"]);
    expect(statements[0]?.total.amount).toBe(42265);
  });

  it("keeps future lines in estimates only and stops estimating when a confirmed invoice arrives", () => {
    const next = {
      ...invoice,
      id: "invoice-2",
      referenceMonth: monthKey("2026-10"),
      totalAmount: brl(125),
      forecastLines: [
        { ...invoice.forecastLines[0], firstFutureMonth: monthKey("2026-11"), remainingMonths: 1 },
      ],
    } as CardInvoiceDoc;
    expect(
      forecastImportedInvoices([invoice], monthKey("2026-09"), monthKey("2026-12")),
    ).toMatchObject([
      { month: "2026-10", amount: { amount: 2399 } },
      { month: "2026-11", amount: { amount: 2399 } },
    ]);
    expect(
      forecastImportedInvoices([invoice, next], monthKey("2026-09"), monthKey("2026-12")),
    ).toMatchObject([{ month: "2026-11", amount: { amount: 2399 } }]);
  });
});
