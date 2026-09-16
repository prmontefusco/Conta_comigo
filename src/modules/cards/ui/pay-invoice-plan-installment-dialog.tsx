"use client";

import { useEffect, useState } from "react";
import { formatCalendarDate, tryCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, SelectField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import { buildSchedule } from "@/modules/debts/domain/debt";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { payCardInvoicePlanInstallment } from "../application/pay-card-invoice-plan-installment";

export function PayInvoicePlanInstallmentDialog({
  selection,
  onClose,
}: {
  selection: { debtId: string; installmentNumber: number } | null;
  onClose: () => void;
}) {
  const finance = useFinance();
  const { household, user } = useSession();
  const debt = finance.debts.find((item) => item.id === selection?.debtId);
  const installment = debt ? buildSchedule(debt)[(selection?.installmentNumber ?? 0) - 1] : null;
  const accounts = finance.accounts.filter((item) => !item.archived);
  const [accountId, setAccountId] = useState("");
  const [paidOn, setPaidOn] = useState<string>(finance.asOf);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selection) return;
    setAccountId(accounts[0]?.id ?? "");
    setPaidOn(finance.asOf);
    setError(null);
    // The selection, not a live balance update, opens a new payment form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.debtId, selection?.installmentNumber]);

  if (!selection || !debt || !installment) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selection || !household || !user || !accountId) {
      setError("Escolha a conta usada para pagar esta parcela.");
      return;
    }
    const paymentDate = tryCalendarDate(paidOn);
    if (!paymentDate) {
      setError("Informe uma data de pagamento válida.");
      return;
    }
    setSaving(true);
    try {
      await payCardInvoicePlanInstallment({
        db: getDb(),
        householdId: household.id,
        uid: user.uid,
        debtId: selection.debtId,
        installmentNumber: selection.installmentNumber,
        accountId,
        paidOn: paymentDate,
        asOf: finance.asOf,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a parcela.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(selection)}
      onClose={saving ? () => undefined : onClose}
      title="Registrar parcela paga"
      description={debt.description}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <FormError>{error}</FormError> : null}
        <Callout tone="info">
          Este registro desconta somente a parcela paga da conta escolhida. As demais continuam na
          previsão.
        </Callout>
        <p className="text-sm">
          Parcela {installment.number}/{installment.of}:{" "}
          <strong>{formatMoney(installment.total)}</strong> · vencimento{" "}
          {formatCalendarDate(installment.dueDate)}
        </p>
        <SelectField
          label="Conta que pagou"
          required
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          options={
            accounts.length
              ? accounts.map((item) => ({ value: item.id, label: item.name }))
              : [{ value: "", label: "Cadastre uma conta primeiro" }]
          }
        />
        <DateField
          label="Data do pagamento"
          required
          value={paidOn}
          onChange={(event) => setPaidOn(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !accountId}>
            {saving ? "Registrando…" : "Registrar pagamento"}
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
