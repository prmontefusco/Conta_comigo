import { doc, runTransaction, type Firestore } from "firebase/firestore";
import { differenceInDays, instant, type CalendarDate } from "@/core/date/calendar-date";
import { type Money, clampToZero, subtract } from "@/core/money/money";
import type { CardInvoiceDoc } from "@/modules/shared/infrastructure/schemas";
import { cardRevolvingDebtId, estimateRevolvingCycle } from "../domain/card-revolving";
import { statementId as cardStatementId } from "../domain/credit-card";

export async function contractCardRevolving(input: {
  readonly db: Firestore;
  readonly householdId: string;
  readonly uid: string;
  readonly invoice: CardInvoiceDoc;
  readonly creditCardName: string;
  readonly visibility: "HOUSEHOLD" | "PERSONAL";
  readonly paidAmount: Money;
  readonly monthlyRatePercent: number;
  readonly annualCetPercent?: number;
  readonly iofDailyPercent?: number;
  readonly iofAdditionalPercent?: number;
  readonly nextDueDate: CalendarDate;
  readonly asOf: CalendarDate;
}) {
  if (input.invoice.financedDebtId) throw new Error("Esta fatura já possui um acordo registrado.");
  if (input.paidAmount.amount <= 0 || input.paidAmount.amount >= input.invoice.totalAmount.amount)
    throw new Error("Registre primeiro um pagamento parcial menor que o total da fatura.");
  if (input.monthlyRatePercent < 0 || input.monthlyRatePercent > 100)
    throw new Error("Confira a taxa mensal do rotativo.");
  if (input.nextDueDate <= input.asOf)
    throw new Error("O vencimento da próxima fatura deve estar no futuro.");

  const principal = clampToZero(subtract(input.invoice.totalAmount, input.paidAmount));
  const estimate = estimateRevolvingCycle({
    principal,
    monthlyRatePercent: input.monthlyRatePercent,
    days: differenceInDays(input.asOf, input.nextDueDate),
    ...(input.iofDailyPercent != null ? { iofDailyPercent: input.iofDailyPercent } : {}),
    ...(input.iofAdditionalPercent != null
      ? { iofAdditionalPercent: input.iofAdditionalPercent }
      : {}),
  });
  const sourceStatementId = cardStatementId(
    input.invoice.creditCardId,
    input.invoice.referenceMonth,
  );
  const debtId = cardRevolvingDebtId(sourceStatementId);
  const invoiceRef = doc(
    input.db,
    `households/${input.householdId}/cardInvoices/${input.invoice.id}`,
  );
  const debtRef = doc(input.db, `households/${input.householdId}/debts/${debtId}`);
  const now = instant();

  await runTransaction(input.db, async (transaction) => {
    const currentInvoice = await transaction.get(invoiceRef);
    const existingDebt = await transaction.get(debtRef);
    if (!currentInvoice.exists() || existingDebt.exists())
      throw new Error("O rotativo já foi registrado ou a fatura foi removida.");
    const current = currentInvoice.data();
    if (current.financedDebtId || (current.paymentRevision ?? 0) !== input.invoice.paymentRevision)
      throw new Error("A fatura mudou. Atualize a página antes de continuar.");

    transaction.set(debtRef, {
      householdId: input.householdId,
      kind: "CARD_RENEGOTIATION",
      description: `Rotativo da fatura ${input.invoice.referenceMonth} · ${input.creditCardName}`,
      principalContracted: principal,
      amountDisbursed: { amount: 0, currency: principal.currency },
      disbursementDate: input.asOf,
      amortisationSystem: "SIMPLE",
      interestRateMonthly: input.monthlyRatePercent,
      ...(input.annualCetPercent != null ? { cetAnnual: input.annualCetPercent } : {}),
      installmentCount: 1,
      installmentAmount: estimate.estimatedNextCharge,
      firstDueDate: input.nextDueDate,
      status: "ACTIVE",
      visibility: input.visibility,
      sourceCardStatementId: sourceStatementId,
      sourceCardInvoiceId: input.invoice.id,
      notes: `Estimativa de um ciclo: principal ${principal.amount}; juros ${estimate.interest.amount}; IOF ${estimate.dailyIof.amount + estimate.additionalIof.amount} centavos. Substituir pelo valor real ao importar a próxima fatura.`,
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    });
    transaction.update(invoiceRef, {
      financedDebtId: debtId,
      paymentRevision: (current.paymentRevision ?? 0) + 1,
      updatedAt: now,
    });
  });

  return { debtId, principal, ...estimate };
}
