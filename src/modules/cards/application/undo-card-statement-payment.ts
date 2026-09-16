import { doc, runTransaction, type Firestore } from "firebase/firestore";
import { instant } from "@/core/date/calendar-date";
import { conflict, err, notFound, ok, type Result } from "@/core/result/result";
import type { HouseholdId } from "@/modules/shared/domain/common";

export interface UndoCardStatementPaymentInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly transactionId: string;
  readonly statementId: string;
  readonly creditCardId: string;
  readonly importedInvoiceId?: string;
  readonly expectedPaymentRevision?: number;
}

/**
 * Reverses only the cash movement used to pay a statement.
 * Purchases and the imported invoice remain untouched, so the derived statement
 * becomes open again and the account balance is restored automatically.
 */
export async function undoCardStatementPayment(
  input: UndoCardStatementPaymentInput,
): Promise<Result<null>> {
  const base = `households/${input.householdId}`;
  const paymentRef = doc(input.db, `${base}/transactions/${input.transactionId}`);
  const invoiceRef = input.importedInvoiceId
    ? doc(input.db, `${base}/cardInvoices/${input.importedInvoiceId}`)
    : null;

  try {
    await runTransaction(input.db, async (transaction) => {
      const payment = await transaction.get(paymentRef);
      if (!payment.exists()) throw new UndoPaymentError("PAYMENT_NOT_FOUND");

      const data = payment.data();
      if (
        data.kind !== "CARD_STATEMENT_PAYMENT" ||
        data.statementId !== input.statementId ||
        data.creditCardId !== input.creditCardId
      ) {
        throw new UndoPaymentError("PAYMENT_CHANGED");
      }

      const invoice = invoiceRef ? await transaction.get(invoiceRef) : null;
      if (invoiceRef && (!invoice || !invoice.exists())) {
        throw new UndoPaymentError("INVOICE_NOT_FOUND");
      }
      const invoiceData = invoice?.data();
      if (invoiceData?.financedDebtId) {
        throw new UndoPaymentError("INVOICE_FINANCED");
      }
      if (
        invoiceData &&
        input.expectedPaymentRevision != null &&
        (invoiceData.paymentRevision ?? 0) !== input.expectedPaymentRevision
      ) {
        throw new UndoPaymentError("INVOICE_CHANGED");
      }

      transaction.delete(paymentRef);
      if (invoiceRef && invoiceData) {
        // Revision is monotonic: an undo is also a change and must invalidate
        // any payment/financing dialog opened against the previous state.
        transaction.update(invoiceRef, {
          paymentRevision: (invoiceData.paymentRevision ?? 0) + 1,
          updatedAt: instant(),
        });
      }
    });
    return ok(null);
  } catch (cause) {
    if (cause instanceof UndoPaymentError) {
      switch (cause.reason) {
        case "PAYMENT_NOT_FOUND":
          return err(notFound("Este pagamento já foi removido."));
        case "INVOICE_NOT_FOUND":
          return err(notFound("A fatura importada não foi encontrada."));
        case "INVOICE_FINANCED":
          return err(
            conflict(
              "Este pagamento faz parte de um parcelamento de fatura. Desfaça o acordo antes de alterar a entrada.",
            ),
          );
        case "PAYMENT_CHANGED":
        case "INVOICE_CHANGED":
          return err(conflict("A fatura mudou. Atualize a página antes de tentar novamente."));
      }
    }
    throw cause;
  }
}

type UndoPaymentFailure =
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_CHANGED"
  | "INVOICE_NOT_FOUND"
  | "INVOICE_FINANCED"
  | "INVOICE_CHANGED";

class UndoPaymentError extends Error {
  constructor(readonly reason: UndoPaymentFailure) {
    super(reason);
  }
}
