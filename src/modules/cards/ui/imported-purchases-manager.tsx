"use client";

import { useMemo, useState } from "react";
import { formatMonthKey } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { statementId } from "@/modules/cards/domain/credit-card";
import { Button, Callout } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import {
  affectedStatementMonths,
  canUndoImportedPurchases,
  isImportedCardPurchase,
} from "../domain/import-rollback";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

export function ImportedPurchasesManager({
  cardId,
  onClose,
}: {
  cardId: string | null;
  onClose: () => void;
}) {
  const finance = useFinance();
  const collections = useCollections();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = finance.cards.find((item) => item.id === cardId);
  const imported = useMemo(
    () =>
      finance.cardPurchases.filter(
        (item) => item.creditCardId === cardId && isImportedCardPurchase(item),
      ),
    [finance.cardPurchases, cardId],
  );
  const invoices = finance.cardInvoices.filter((item) => item.creditCardId === cardId);
  const chosen = imported.filter((item) => selected.has(item.id));
  const months = card ? affectedStatementMonths(chosen, card) : [];
  const payments = finance.transactions.filter(
    (transaction) => transaction.kind === "CARD_STATEMENT_PAYMENT",
  );
  const safe = card
    ? canUndoImportedPurchases(chosen, card, finance.cardStatements, payments)
    : false;

  function close() {
    if (saving) return;
    setSelected(new Set());
    setConfirmation("");
    setError(null);
    onClose();
  }

  async function undo() {
    if (!card || !safe || confirmation !== "EXCLUIR") return;
    setSaving(true);
    setError(null);
    try {
      const current = await Promise.all(
        chosen.map((item) => collections.cardPurchases.get(item.id)),
      );
      if (
        current.some(
          (item) => !item || item.creditCardId !== card.id || !isImportedCardPurchase(item),
        )
      ) {
        throw new Error("Os lançamentos mudaram. Reabra esta janela antes de continuar.");
      }
      const latestPayments = (await collections.transactions.list()).filter(
        (transaction) => transaction.kind === "CARD_STATEMENT_PAYMENT",
      );
      if (!canUndoImportedPurchases(chosen, card, finance.cardStatements, latestPayments)) {
        throw new Error("Um pagamento foi registrado. Reabra esta janela antes de continuar.");
      }
      for (const item of chosen) await collections.cardPurchases.remove(item.id);
      setSelected(new Set());
      setConfirmation("");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desfazer a importação.");
    } finally {
      setSaving(false);
    }
  }

  async function undoInvoice(invoiceId: string) {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice || confirmation !== "EXCLUIR") return;
    setSaving(true);
    setError(null);
    try {
      const current = await collections.cardInvoices.get(invoiceId);
      if (!current || current.creditCardId !== cardId || current.financedDebtId)
        throw new Error("A fatura mudou. Reabra esta janela.");
      const latestPayments = (await collections.transactions.list()).filter(
        (item) =>
          item.kind === "CARD_STATEMENT_PAYMENT" &&
          item.statementId === statementId(current.creditCardId, current.referenceMonth),
      );
      if (latestPayments.length > 0)
        throw new Error("Esta fatura já tem pagamento registrado e não pode ser removida aqui.");
      await collections.cardInvoices.remove(invoiceId);
      setConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover a fatura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={cardId !== null}
      onClose={close}
      title="Corrigir importação"
      description="Remova uma fatura confirmada importada por engano ou compras criadas por importações antigas."
    >
      <div className="space-y-4">
        {invoices.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Faturas importadas</h3>
            {invoices.map((invoice) => {
              const hasPayment = payments.some(
                (item) =>
                  item.statementId === statementId(invoice.creditCardId, invoice.referenceMonth),
              );
              return (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--card-border)] p-3 text-sm"
                >
                  <div>
                    <p>
                      {formatMonthKey(invoice.referenceMonth)} · {formatMoney(invoice.totalAmount)}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      {invoice.forecastLines.length} itens para previsão
                      {hasPayment ? " · pagamento registrado" : ""}
                      {invoice.financedDebtId ? " · fatura parcelada" : ""}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={
                      saving ||
                      hasPayment ||
                      Boolean(invoice.financedDebtId) ||
                      confirmation !== "EXCLUIR"
                    }
                    onClick={() => void undoInvoice(invoice.id)}
                  >
                    Remover
                  </Button>
                </div>
              );
            })}
            <label className="block text-sm" htmlFor="confirmar-exclusao-fatura">
              Digite EXCLUIR para remover uma fatura sem pagamento
            </label>
            <input
              id="confirmar-exclusao-fatura"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3"
            />
          </div>
        ) : null}
        <Callout tone="attention">
          Esta ação exclui compras selecionadas e recalcula as faturas afetadas. Compras lançadas
          manualmente não aparecem aqui.
        </Callout>
        {imported.length === 0 ? (
          <p className="text-sm">Nenhuma compra importada encontrada neste cartão.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setSelected(new Set(imported.map((item) => item.id)))}
              >
                Selecionar todas
              </Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                Limpar seleção
              </Button>
            </div>
            <ul className="max-h-72 divide-y divide-[color:var(--card-border)] overflow-y-auto">
              {imported.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Excluir ${item.description}`}
                    checked={selected.has(item.id)}
                    onChange={() => {
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                      setConfirmation("");
                    }}
                    className="mt-1 size-5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      {item.installmentCount} {item.installmentCount === 1 ? "parcela" : "parcelas"}{" "}
                      · {formatMoney(item.totalAmount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {chosen.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-[color:var(--card-border)] p-3 text-sm">
                <p>
                  <strong>{chosen.length}</strong>{" "}
                  {chosen.length === 1 ? "compra selecionada" : "compras selecionadas"};{" "}
                  <strong>{months.length}</strong>{" "}
                  {months.length === 1 ? "fatura afetada" : "faturas afetadas"}.
                </p>
                <p>Meses: {months.map((month) => formatMonthKey(month)).join(", ")}.</p>
                {!safe ? (
                  <Callout tone="critical">
                    Há pagamento registrado em uma das faturas afetadas, ou a seleção contém um
                    lançamento inválido. Para não deixar um pagamento sem origem, a exclusão foi
                    bloqueada.
                  </Callout>
                ) : null}
              </div>
            ) : null}
            {safe ? (
              <div className="space-y-2">
                <label
                  className="block text-sm font-medium"
                  htmlFor="confirmar-exclusao-importacao"
                >
                  Digite EXCLUIR para confirmar
                </label>
                <input
                  id="confirmar-exclusao-importacao"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  className="min-h-11 w-full rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3"
                />
              </div>
            ) : null}
            {error ? <Callout tone="critical">{error}</Callout> : null}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={() => void undo()}
                disabled={!safe || confirmation !== "EXCLUIR" || saving}
              >
                {saving ? "Excluindo…" : "Desfazer compras selecionadas"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
