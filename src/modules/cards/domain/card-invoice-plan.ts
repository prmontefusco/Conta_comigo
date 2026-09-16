import { addMonths, type CalendarDate } from "@/core/date/calendar-date";
import { deterministicId } from "@/core/id/id";
import { type Money, money, subtract } from "@/core/money/money";

export function cardInvoicePlanDebtId(statementId: string): string {
  return deterministicId("card-invoice-plan", statementId);
}

export function cardInvoicePlanPaymentId(debtId: string, installmentNumber: number): string {
  return deterministicId("card-invoice-plan-payment", debtId, String(installmentNumber));
}

export function paidCardInvoicePlanInstallments(
  payments: readonly {
    readonly debtId: string;
    readonly cardInvoicePlanInstallmentNumber?: number;
  }[],
  debtId: string,
): number[] {
  return [
    ...new Set(
      payments
        .filter((payment) => payment.debtId === debtId)
        .flatMap((payment) =>
          payment.cardInvoicePlanInstallmentNumber
            ? [payment.cardInvoicePlanInstallmentNumber]
            : [],
        ),
    ),
  ].sort((a, b) => a - b);
}

export function summariseCardInvoicePlan(input: {
  readonly invoiceRemaining: Money;
  readonly entry: Money;
  readonly installments: number;
  readonly installmentAmount: Money;
  readonly firstDueDate: CalendarDate;
}) {
  const financedPrincipal = subtract(input.invoiceRemaining, input.entry);
  const futureTotal = money(input.installments * input.installmentAmount.amount);
  const financeCost = subtract(futureTotal, financedPrincipal);
  const dates = Array.from({ length: input.installments }, (_, index) =>
    addMonths(input.firstDueDate, index),
  );
  return { financedPrincipal, futureTotal, financeCost, dates };
}
