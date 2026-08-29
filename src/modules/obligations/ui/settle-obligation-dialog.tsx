"use client";

import { useEffect, useState } from "react";
import { calendarDate, formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, toDecimal } from "@/core/money/money";
import { Button } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { remainingAmount, type Obligation } from "@/modules/obligations/domain/obligation";
import { settleObligation } from "@/modules/obligations/application/settle-obligation";

/**
 * Recording that a bill was paid, or that money arrived.
 *
 * The amount defaults to what is still owed but stays editable, because
 * partial payments and renegotiated amounts are ordinary events, not edge
 * cases - and the remainder must stay visible afterwards.
 */
export function SettleObligationDialog({
  obligation,
  onClose,
}: {
  obligation: Obligation | null;
  onClose: () => void;
}) {
  const { accounts, asOf } = useFinance();
  const { household, user } = useSession();
  const [accountId, setAccountId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [paidOn, setPaidOn] = useState<string>(asOf);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const usableAccounts = accounts.filter((account) => !account.archived);
  // A stable primitive to depend on: `usableAccounts` is a fresh array each
  // render, so depending on it would reset the form on every parent update.
  const defaultAccountId = usableAccounts[0]?.id ?? "";

  useEffect(() => {
    if (!obligation) return;
    setAmountText(toDecimal(remainingAmount(obligation)).toFixed(2).replace(".", ","));
    setAccountId(obligation.expectedAccountId ?? defaultAccountId);
    setPaidOn(asOf);
    setError(null);
  }, [obligation, asOf, defaultAccountId]);

  if (!obligation) return null;

  const isInflow = obligation.direction === "INFLOW";
  const outstanding = remainingAmount(obligation);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!household || !user || !obligation) return;

    if (!accountId) {
      setError("Escolha em qual conta o dinheiro entrou ou saiu.");
      return;
    }

    const amount = fromDecimalString(amountText);
    if (!amount) {
      setError("Informe um valor válido.");
      return;
    }

    setSaving(true);
    const result = await settleObligation({
      db: getDb(),
      householdId: household.id,
      uid: user.uid,
      obligation,
      accountId,
      amount,
      paidOn: calendarDate(paidOn),
    }).catch((settleError: unknown) => {
      console.error(settleError);
      return null;
    });
    setSaving(false);

    if (!result) {
      setError("Não foi possível registrar agora. Tente novamente.");
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
      open={Boolean(obligation)}
      onClose={onClose}
      title={isInflow ? "Registrar recebimento" : "Registrar pagamento"}
      description={`${obligation.description} · vencimento ${formatCalendarDate(obligation.dueDate)}`}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Em aberto: <strong className="tabular">{formatMoney(outstanding)}</strong>
        </p>

        <MoneyField
          label={isInflow ? "Valor recebido" : "Valor pago"}
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          hint="Se você pagou apenas parte, ajuste o valor: o restante continua em aberto."
        />

        <SelectField
          label={isInflow ? "Conta que recebeu" : "Conta que pagou"}
          required
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          options={
            usableAccounts.length === 0
              ? [{ value: "", label: "Cadastre uma conta primeiro" }]
              : usableAccounts.map((account) => ({ value: account.id, label: account.name }))
          }
        />

        <DateField
          label={isInflow ? "Data do recebimento" : "Data do pagamento"}
          required
          value={paidOn}
          onChange={(event) => setPaidOn(event.target.value)}
          hint="O mês de competência continua sendo o da conta, mesmo se o pagamento atrasou."
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Registrando…" : "Registrar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
