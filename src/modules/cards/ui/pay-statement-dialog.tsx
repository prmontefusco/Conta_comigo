"use client";

import { useEffect, useState } from "react";
import {
  calendarDate,
  firstDayOfMonthKey,
  formatCalendarDate,
  formatMonthKey,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, toDecimal } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import type { CardStatement } from "@/modules/cards/domain/credit-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { payCardStatement } from "@/modules/obligations/application/settle-obligation";

export function PayStatementDialog({
  statement,
  onClose,
}: {
  statement: CardStatement | null;
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
  const defaultAccountId = usableAccounts[0]?.id ?? "";

  useEffect(() => {
    if (!statement) return;
    setAmountText(toDecimal(statement.remainingAmount).toFixed(2).replace(".", ","));
    setAccountId(defaultAccountId);
    setPaidOn(asOf);
    setError(null);
  }, [statement, asOf, defaultAccountId]);

  if (!statement) return null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household || !user || !statement) return;

    if (!accountId) {
      setError("Escolha a conta que pagou a fatura.");
      return;
    }
    const amount = fromDecimalString(amountText);
    if (!amount || amount.amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setSaving(true);
    const result = await payCardStatement({
      db: getDb(),
      householdId: household.id,
      uid: user.uid,
      creditCardId: statement.creditCardId,
      statementId: statement.id,
      statementMonth: statement.referenceMonth,
      accountId,
      amount,
      paidOn: calendarDate(paidOn),
      competenceDate: firstDayOfMonthKey(statement.referenceMonth),
    }).catch((payError: unknown) => {
      console.error(payError);
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
      open={Boolean(statement)}
      onClose={onClose}
      title="Pagar fatura"
      description={`${formatMonthKey(statement.referenceMonth)} · vence ${formatCalendarDate(statement.dueDate)}`}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <Callout tone="info">
          Este pagamento sai da conta escolhida, mas não conta como uma nova despesa: as{" "}
          {statement.installments.length}{" "}
          {statement.installments.length === 1 ? "compra" : "compras"} desta fatura já foram
          contabilizadas quando aconteceram.
        </Callout>

        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Total da fatura: <strong className="tabular">{formatMoney(statement.total)}</strong> · em
          aberto: <strong className="tabular">{formatMoney(statement.remainingAmount)}</strong>
        </p>

        <MoneyField
          label="Valor pago"
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          hint="Pagamento parcial é aceito. O restante continua em aberto."
        />

        <SelectField
          label="Conta que pagou"
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
          label="Data do pagamento"
          required
          value={paidOn}
          onChange={(event) => setPaidOn(event.target.value)}
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Registrando…" : "Registrar pagamento"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
