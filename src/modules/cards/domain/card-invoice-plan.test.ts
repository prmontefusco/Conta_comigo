import { describe, expect, it } from "vitest";
import { monthKey } from "@/core/date/calendar-date";
import { aCreditCard, anAccount, anExpense, brl, on } from "@/modules/shared/testing/builders";
import { computeBalance } from "@/modules/accounts/domain/account";
import { spendingEffect } from "@/modules/transactions/domain/transaction";
import type { Transaction } from "@/modules/transactions/domain/transaction";
import { buildSchedule, disbursementCost } from "@/modules/debts/domain/debt";
import { forecast } from "@/modules/forecast/domain/forecast";
import { dateRange } from "@/core/date/calendar-date";
import { zero } from "@/core/money/money";
import type { Debt } from "@/modules/debts/domain/debt";
import { projectStatements, statementId } from "./credit-card";
import { paidCardInvoicePlanInstallments, summariseCardInvoicePlan } from "./card-invoice-plan";
import type { CardInvoiceDoc } from "@/modules/shared/infrastructure/schemas";

describe("contracted card invoice plan", () => {
  it("tracks paid installments by number, so correcting one does not shift the others", () => {
    const payments = [
      { debtId: "plan", cardInvoicePlanInstallmentNumber: 1 },
      { debtId: "plan", cardInvoicePlanInstallmentNumber: 3 },
    ];
    expect(paidCardInvoicePlanInstallments(payments, "plan")).toEqual([1, 3]);
    expect(paidCardInvoicePlanInstallments(payments.slice(1), "plan")).toEqual([3]);
  });
  it("moves only the entry now, with three exact future installments and explicit cost", () => {
    const account = anAccount({ openingBalance: brl(1000), openingBalanceDate: on("2026-09-01") });
    const payment = anExpense({
      kind: "CARD_STATEMENT_PAYMENT",
      amount: brl(80),
      transactionDate: on("2026-09-15"),
      competenceDate: on("2026-09-01"),
      creditCardId: "card-a",
      statementId: "card-a_2026-09",
    } as Partial<Transaction>);
    expect(computeBalance(account, [payment], on("2026-09-15"))).toEqual(brl(920));
    expect(spendingEffect(payment)).toBeNull();
    const terms = summariseCardInvoicePlan({
      invoiceRemaining: brl(422.65),
      entry: brl(80),
      installments: 3,
      installmentAmount: brl(164),
      firstDueDate: on("2026-10-15"),
    });
    expect(terms.financedPrincipal).toEqual(brl(342.65));
    expect(terms.futureTotal).toEqual(brl(492));
    expect(terms.financeCost).toEqual(brl(149.35));
    expect(terms.dates).toEqual(["2026-10-15", "2026-11-15", "2026-12-15"]);

    const debt = {
      id: "debt-plan",
      kind: "CARD_RENEGOTIATION",
      sourceCardStatementId: "card_2026-09",
      principalContracted: terms.financedPrincipal,
      amountDisbursed: brl(0),
      installmentCount: 3,
      installmentAmount: brl(164),
      firstDueDate: on("2026-10-15"),
      amortisationSystem: "SIMPLE",
      status: "ACTIVE",
    } as Debt;
    const schedule = buildSchedule(debt);
    expect(schedule.map((item) => item.total.amount)).toEqual([16400, 16400, 16400]);
    expect(schedule.at(-1)?.outstandingAfter.amount).toBe(0);
    expect(disbursementCost(debt).amount).toBe(0);
  });

  it("removes the original invoice from payable statements after contracting", () => {
    const card = aCreditCard({ closingDay: 12, dueDay: 18 });
    const id = statementId(card.id, monthKey("2026-09"));
    const invoice = {
      id: "invoice",
      creditCardId: card.id,
      referenceMonth: monthKey("2026-09"),
      dueDate: on("2026-09-18"),
      totalAmount: brl(422.65),
      createdAt: "2026-09-15T00:00:00Z",
    } as CardInvoiceDoc;
    const [statement] = projectStatements(
      card,
      [],
      [{ transactionId: "entry", statementId: id, amount: brl(80) }],
      monthKey("2026-09"),
      monthKey("2026-09"),
      on("2026-09-15"),
      [invoice],
      new Set([id]),
    );
    expect(statement?.paidAmount).toEqual(brl(80));
    expect(statement?.remainingAmount).toEqual(brl(0));
    expect(statement?.status).toBe("FINANCED");
    const debt = {
      id: "debt-plan",
      kind: "CARD_RENEGOTIATION",
      sourceCardStatementId: id,
      principalContracted: brl(342.65),
      installmentCount: 3,
      installmentAmount: brl(164),
      firstDueDate: on("2026-10-15"),
      amortisationSystem: "SIMPLE",
      status: "ACTIVE",
    } as Debt;
    const result = forecast({
      asOf: on("2026-09-15"),
      horizon: dateRange(on("2026-09-15"), on("2026-12-31")),
      openingBalance: brl(920),
      protectedReserve: zero(),
      obligations: [],
      recurringRules: [],
      cardStatements: [statement!],
      debts: [debt],
    });
    expect(result.events.filter((item) => item.source === "CARD_STATEMENT")).toHaveLength(0);
    expect(
      result.events
        .filter((item) => item.source === "DEBT_INSTALLMENT")
        .map((item) => [item.date, item.amount.amount]),
    ).toEqual([
      ["2026-10-15", 16400],
      ["2026-11-15", 16400],
      ["2026-12-15", 16400],
    ]);
  });
});
