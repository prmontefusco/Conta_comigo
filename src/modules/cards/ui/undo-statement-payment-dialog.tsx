"use client";

import { useState } from "react";
import { formatCalendarDate, formatMonthKey } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Button, Callout } from "@/components/ui/primitives";
import { FormError } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import type { CardStatement } from "@/modules/cards/domain/credit-card";
import { undoCardStatementPayment } from "@/modules/cards/application/undo-card-statement-payment";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

export function UndoStatementPaymentDialog({
  statement,
  onClose,
}: {
  statement: CardStatement | null;
  onClose: () => void;
}) {
  const finance = useFinance();
  const { household } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!statement) return null;
  const payments = finance.transactions
    .filter(
      (item) =>
        item.kind === "CARD_STATEMENT_PAYMENT" &&
        item.statementId === statement.id &&
        item.creditCardId === statement.creditCardId,
    )
    .sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1));
  const invoice = finance.cardInvoices.find(
    (item) =>
      item.creditCardId === statement.creditCardId &&
      item.referenceMonth === statement.referenceMonth,
  );

  async function undo(transactionId: string) {
    if (!household) return;
    setBusyId(transactionId);
    setError(null);
    const result = await undoCardStatementPayment({
      db: getDb(),
      householdId: household.id,
      transactionId,
      statementId: statement!.id,
      creditCardId: statement!.creditCardId,
      importedInvoiceId: invoice?.id,
      expectedPaymentRevision: invoice?.paymentRevision,
    }).catch((cause: unknown) => {
      console.error(cause);
      return null;
    });
    setBusyId(null);

    if (!result) {
      setError("Não foi possível desfazer agora. Tente novamente.");
      return;
    }
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Desfazer pagamento da fatura"
      description={`${formatMonthKey(statement.referenceMonth)} · total ${formatMoney(statement.total)}`}
    >
      <div className="space-y-4">
        {error ? <FormError>{error}</FormError> : null}
        <Callout tone="attention">
          O dinheiro voltará ao saldo da conta no aplicativo e a fatura ficará novamente em aberto.
          As compras não serão apagadas.
        </Callout>

        {invoice?.financedDebtId ? (
          <Callout tone="critical">
            Esta fatura foi parcelada. Para preservar o acordo e suas parcelas, o pagamento usado
            como entrada não pode ser desfeito aqui.
          </Callout>
        ) : (
          <ul className="divide-y divide-[color:var(--card-border)]">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{formatMoney(payment.amount)}</p>
                  <p className="text-xs text-[color:var(--muted-fg)]">
                    Pago em {formatCalendarDate(payment.transactionDate)}
                  </p>
                </div>
                <Button
                  variant="danger"
                  disabled={busyId !== null}
                  onClick={() => void undo(payment.id)}
                >
                  {busyId === payment.id ? "Desfazendo…" : "Desfazer este pagamento"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="secondary" className="w-full" onClick={onClose} disabled={busyId !== null}>
          Manter pagamento
        </Button>
      </div>
    </Modal>
  );
}
