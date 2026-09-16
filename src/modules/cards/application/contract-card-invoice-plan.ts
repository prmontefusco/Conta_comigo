import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  firstDayOfMonthKey,
  instant,
  type CalendarDate,
  type MonthKey,
} from "@/core/date/calendar-date";
import { type Money, clampToZero, subtract, sum, zero } from "@/core/money/money";
import { cardInvoicePlanDebtId, summariseCardInvoicePlan } from "../domain/card-invoice-plan";
import { statementId as cardStatementId } from "../domain/credit-card";
import type { CardInvoiceDoc } from "@/modules/shared/infrastructure/schemas";

export interface ContractCardInvoicePlanInput {
  readonly db: Firestore;
  readonly householdId: string;
  readonly uid: string;
  readonly invoice: CardInvoiceDoc;
  readonly creditCardName: string;
  readonly visibility: "HOUSEHOLD" | "PERSONAL";
  readonly accountId: string;
  readonly entry: Money;
  readonly useExistingEntry?: boolean;
  readonly entryDate: CalendarDate;
  readonly asOf: CalendarDate;
  readonly installments: number;
  readonly installmentAmount: Money;
  readonly firstDueDate: CalendarDate;
  readonly annualCetPercent?: number;
}

/** The entry and the negotiated debt commit together, never as two writes. */
export async function contractCardInvoicePlan(input: ContractCardInvoicePlanInput) {
  const invoice = input.invoice;
  if (invoice.householdId !== input.householdId || invoice.financedDebtId)
    throw new Error("A fatura não está disponível para parcelamento.");
  if (input.entryDate > input.asOf)
    throw new Error("Registre apenas uma entrada já paga, com data até hoje.");
  if (!input.useExistingEntry && input.entry.amount <= 0)
    throw new Error("Informe a entrada já paga.");
  if (input.firstDueDate <= input.asOf || input.firstDueDate <= input.entryDate)
    throw new Error("A primeira parcela deve vencer depois da entrada e no futuro.");
  if (
    !Number.isInteger(input.installments) ||
    input.installments < 2 ||
    input.installments > 120 ||
    input.installmentAmount.amount <= 0
  )
    throw new Error("Confira quantidade e valor das parcelas.");

  const transactionsPath = `households/${input.householdId}/transactions`;
  const statementId = cardStatementId(invoice.creditCardId, invoice.referenceMonth);
  const paymentSnapshot = await getDocs(
    query(collection(input.db, transactionsPath), where("statementId", "==", statementId)),
  );
  const priorPayments = paymentSnapshot.docs.filter(
    (item) => item.data().kind === "CARD_STATEMENT_PAYMENT",
  );
  if (priorPayments.some((item) => item.data().transactionDate > input.asOf))
    throw new Error("Há um pagamento com data futura. Corrija esse lançamento antes de parcelar.");
  const alreadyPaid = sum(priorPayments.map((item) => item.data().amount as Money));
  if (input.useExistingEntry && alreadyPaid.amount <= 0)
    throw new Error("Nenhuma entrada já paga foi encontrada nesta fatura.");
  const freshRemaining = clampToZero(subtract(invoice.totalAmount, alreadyPaid));
  if (input.entry.amount >= freshRemaining.amount)
    throw new Error("A entrada deve ser menor que o saldo da fatura. Para quitar, use Pagar.");
  const terms = summariseCardInvoicePlan({
    invoiceRemaining: freshRemaining,
    entry: input.entry,
    installments: input.installments,
    installmentAmount: input.installmentAmount,
    firstDueDate: input.firstDueDate,
  });
  if (terms.financeCost.amount < 0)
    throw new Error(
      "O total das parcelas ficou abaixo do saldo financiado. Confira os valores com o emissor.",
    );

  const debtId = cardInvoicePlanDebtId(statementId);
  const invoiceRef = doc(input.db, `households/${input.householdId}/cardInvoices/${invoice.id}`);
  const debtRef = doc(input.db, `households/${input.householdId}/debts/${debtId}`);
  const entryRef = input.useExistingEntry ? null : doc(collection(input.db, transactionsPath));
  const now = instant();

  await runTransaction(input.db, async (transaction) => {
    const currentInvoice = await transaction.get(invoiceRef);
    const existingDebt = await transaction.get(debtRef);
    if (!currentInvoice.exists() || existingDebt.exists())
      throw new Error("Este parcelamento já foi registrado ou a fatura foi removida.");
    const current = currentInvoice.data();
    if (current.financedDebtId || (current.paymentRevision ?? 0) !== invoice.paymentRevision) {
      throw new Error(
        "A fatura mudou desde que você abriu esta janela. Atualize a página e confira o saldo.",
      );
    }
    if (
      current.creditCardId !== invoice.creditCardId ||
      current.referenceMonth !== invoice.referenceMonth ||
      current.totalAmount?.amount !== invoice.totalAmount.amount
    ) {
      throw new Error("Os dados da fatura mudaram. Atualize a página antes de continuar.");
    }

    transaction.set(debtRef, {
      householdId: input.householdId,
      kind: "CARD_RENEGOTIATION",
      description: `Parcelamento da fatura ${invoice.referenceMonth} · ${input.creditCardName}`,
      principalContracted: terms.financedPrincipal,
      amountDisbursed: zero(),
      disbursementDate: input.useExistingEntry
        ? (priorPayments
            .map((item) => item.data().transactionDate as CalendarDate)
            .sort()
            .at(-1) ?? input.entryDate)
        : input.entryDate,
      amortisationSystem: "SIMPLE",
      installmentCount: input.installments,
      installmentAmount: input.installmentAmount,
      firstDueDate: input.firstDueDate,
      ...(input.annualCetPercent != null ? { cetAnnual: input.annualCetPercent } : {}),
      status: "ACTIVE",
      visibility: input.visibility,
      sourceCardStatementId: statementId,
      sourceCardInvoiceId: invoice.id,
      notes: `Entrada ${input.useExistingEntry ? alreadyPaid.amount : input.entry.amount} centavos; total futuro ${terms.futureTotal.amount} centavos.`,
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    });
    if (entryRef)
      transaction.set(entryRef, {
        householdId: input.householdId,
        kind: "CARD_STATEMENT_PAYMENT",
        amount: input.entry,
        transactionDate: input.entryDate,
        competenceDate: firstDayOfMonthKey(invoice.referenceMonth as MonthKey),
        description: `Entrada do parcelamento da fatura ${invoice.referenceMonth}`,
        visibility: input.visibility,
        accountId: input.accountId,
        creditCardId: invoice.creditCardId,
        statementId,
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

  return { debtId, entryTransactionId: entryRef?.id ?? null, terms };
}
