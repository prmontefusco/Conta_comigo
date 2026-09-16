import { doc, runTransaction, type Firestore } from "firebase/firestore";
import { instant, type CalendarDate } from "@/core/date/calendar-date";
import { buildSchedule } from "@/modules/debts/domain/debt";
import { debtSchema } from "@/modules/shared/infrastructure/schemas";
import { cardInvoicePlanPaymentId } from "../domain/card-invoice-plan";

export async function payCardInvoicePlanInstallment(input: {
  readonly db: Firestore;
  readonly householdId: string;
  readonly uid: string;
  readonly debtId: string;
  readonly installmentNumber: number;
  readonly accountId: string;
  readonly paidOn: CalendarDate;
  readonly asOf: CalendarDate;
}) {
  if (!input.accountId || input.paidOn > input.asOf || input.installmentNumber < 1)
    throw new Error("Escolha a conta e registre somente um pagamento já realizado.");
  const base = `households/${input.householdId}`;
  const debtRef = doc(input.db, `${base}/debts/${input.debtId}`);
  const paymentId = cardInvoicePlanPaymentId(input.debtId, input.installmentNumber);
  const paymentRef = doc(input.db, `${base}/transactions/${paymentId}`);
  const previousRef =
    input.installmentNumber > 1
      ? doc(
          input.db,
          `${base}/transactions/${cardInvoicePlanPaymentId(input.debtId, input.installmentNumber - 1)}`,
        )
      : null;
  const now = instant();

  await runTransaction(input.db, async (transaction) => {
    const debtSnapshot = await transaction.get(debtRef);
    const paymentSnapshot = await transaction.get(paymentRef);
    const previousSnapshot = previousRef ? await transaction.get(previousRef) : null;
    if (!debtSnapshot.exists() || paymentSnapshot.exists())
      throw new Error("Esta parcela já foi paga ou o acordo não existe mais.");
    if (previousRef && !previousSnapshot?.exists())
      throw new Error("Registre as parcelas anteriores antes desta.");
    const debt = debtSchema.parse({ id: debtSnapshot.id, ...debtSnapshot.data() });
    if (!debt.sourceCardInvoiceId || !debt.sourceCardStatementId)
      throw new Error("Este acordo não está ativo.");
    const installment = buildSchedule(debt)[input.installmentNumber - 1];
    if (!installment) throw new Error("Parcela não encontrada no acordo.");
    const invoiceRef = doc(input.db, `${base}/cardInvoices/${debt.sourceCardInvoiceId}`);
    const invoiceSnapshot = await transaction.get(invoiceRef);
    if (!invoiceSnapshot.exists() || invoiceSnapshot.data().financedDebtId !== debt.id)
      throw new Error("O vínculo com a fatura mudou. Atualize antes de pagar.");

    transaction.set(paymentRef, {
      householdId: input.householdId,
      kind: "DEBT_PAYMENT",
      amount: installment.total,
      transactionDate: input.paidOn,
      competenceDate: installment.dueDate,
      description: `Parcela ${installment.number}/${installment.of} · ${debt.description}`,
      visibility: debt.visibility,
      accountId: input.accountId,
      debtId: debt.id,
      cardInvoicePlanInstallmentNumber: installment.number,
      breakdown: {
        principal: installment.principal,
        interest: installment.interest,
        fees: installment.fees,
        insurance: installment.insurance,
      },
      notes: installment.breakdownKnown
        ? ""
        : "Custo do financiamento distribuído para planejamento; confira a divisão no contrato.",
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    });
  });
  return { transactionId: paymentId };
}
