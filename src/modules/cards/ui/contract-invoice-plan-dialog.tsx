"use client";

import { useEffect, useState } from "react";
import {
  addMonths,
  formatCalendarDate,
  formatMonthKey,
  tryCalendarDate,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, toDecimal, zero, type Money } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import { contractCardInvoicePlan } from "../application/contract-card-invoice-plan";
import { summariseCardInvoicePlan } from "../domain/card-invoice-plan";
import type { CardStatement, CreditCard } from "../domain/credit-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

function moneyField(value: Money): string {
  return toDecimal(value).toFixed(2).replace(".", ",");
}

export function ContractInvoicePlanDialog({
  statement,
  card,
  onClose,
}: {
  statement: CardStatement | null;
  card: CreditCard | null;
  onClose: () => void;
}) {
  const finance = useFinance();
  const { household, user } = useSession();
  const invoice = finance.cardInvoices.find(
    (item) =>
      item.creditCardId === statement?.creditCardId &&
      item.referenceMonth === statement.referenceMonth,
  );
  const accounts = finance.accounts.filter((item) => !item.archived);
  const [accountId, setAccountId] = useState("");
  const [entryText, setEntryText] = useState("");
  const [entryDate, setEntryDate] = useState<string>(finance.asOf);
  const [installmentsText, setInstallmentsText] = useState("3");
  const [installmentText, setInstallmentText] = useState("");
  const [firstDueDate, setFirstDueDate] = useState<string>(addMonths(finance.asOf, 1));
  const [cetText, setCetText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [useExistingEntry, setUseExistingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!statement) return;
    setAccountId(accounts[0]?.id ?? "");
    setEntryDate(finance.asOf);
    setFirstDueDate(addMonths(finance.asOf, 1));
    setConfirmed(false);
    setUseExistingEntry(statement.paidAmount.amount > 0);
    setError(null);
    const offer = invoice?.installmentOffers[0];
    setEntryText(offer ? moneyField(offer.upfrontAmount) : "");
    setInstallmentsText(String(offer?.installments ?? 3));
    setInstallmentText(offer ? moneyField(offer.installmentAmount) : "");
    setCetText(offer?.annualCetPercent != null ? String(offer.annualCetPercent) : "");
    // Reset only when opening another invoice, not on live account/offer updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statement?.id]);

  if (!statement || !card || !invoice) return null;
  const entry = useExistingEntry ? zero() : fromDecimalString(entryText);
  const installmentAmount = fromDecimalString(installmentText);
  const installments = Number(installmentsText);
  const firstDate = tryCalendarDate(firstDueDate);
  const summary =
    entry &&
    installmentAmount &&
    firstDate &&
    Number.isInteger(installments) &&
    installments >= 2 &&
    installments <= 120
      ? summariseCardInvoicePlan({
          invoiceRemaining: statement.remainingAmount,
          entry,
          installments,
          installmentAmount,
          firstDueDate: firstDate,
        })
      : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!statement || !card || !invoice || !household || !user) return;
    const paidOn = tryCalendarDate(entryDate);
    if (!confirmed) {
      setError("Confirme que o acordo foi contratado e a entrada já foi paga.");
      return;
    }
    if (
      (!useExistingEntry && !accountId) ||
      !entry ||
      !installmentAmount ||
      !firstDate ||
      !paidOn ||
      !summary
    ) {
      setError("Confira conta, datas e valores.");
      return;
    }
    if (
      !useExistingEntry &&
      (entry.amount <= 0 || entry.amount >= statement.remainingAmount.amount)
    ) {
      setError("A entrada deve ser positiva e menor que o saldo da fatura.");
      return;
    }
    if (summary.financeCost.amount < 0) {
      setError("O total das parcelas ficou abaixo do saldo financiado. Confira a oferta.");
      return;
    }
    const cet = cetText.trim() === "" ? undefined : Number(cetText.replace(",", "."));
    if (cet != null && (!Number.isFinite(cet) || cet < 0 || cet > 1000)) {
      setError("Informe um CET anual válido ou deixe o campo em branco.");
      return;
    }
    setSaving(true);
    try {
      await contractCardInvoicePlan({
        db: getDb(),
        householdId: household.id,
        uid: user.uid,
        invoice,
        creditCardName: card.name,
        visibility: card.visibility,
        accountId,
        entry,
        entryDate: paidOn,
        asOf: finance.asOf,
        useExistingEntry,
        installments,
        installmentAmount,
        firstDueDate: firstDate,
        ...(cet != null ? { annualCetPercent: cet } : {}),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar o acordo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(statement)}
      onClose={saving ? () => undefined : onClose}
      title="Parcelar fatura"
      description={`${formatMonthKey(statement.referenceMonth)} · saldo ${formatMoney(statement.remainingAmount)}`}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <FormError>{error}</FormError> : null}
        <Callout tone="attention">
          Registre este acordo somente depois de confirmar as condições com o emissor e pagar a
          entrada. Se a entrada ainda não foi lançada, ela sairá da conta escolhida; as parcelas
          substituirão o saldo original na projeção.
        </Callout>
        {statement.paidAmount.amount > 0 ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={useExistingEntry}
              onChange={(event) => setUseExistingEntry(event.target.checked)}
              className="mt-1 size-5"
            />
            A entrada de {formatMoney(statement.paidAmount)} já foi lançada em “Pagar”. Não
            descontar da conta novamente.
          </label>
        ) : null}
        {invoice.installmentOffers.length > 0 ? (
          <SelectField
            label="Oferta da fatura"
            value=""
            onChange={(event) => {
              const offer = invoice.installmentOffers[Number(event.target.value)];
              if (!offer) return;
              setEntryText(moneyField(offer.upfrontAmount));
              setInstallmentsText(String(offer.installments));
              setInstallmentText(moneyField(offer.installmentAmount));
              setCetText(offer.annualCetPercent != null ? String(offer.annualCetPercent) : "");
            }}
            options={[
              { value: "", label: "Escolha uma oferta para preencher" },
              ...invoice.installmentOffers.map((offer, index) => ({
                value: String(index),
                label: `${offer.installments} × ${formatMoney(offer.installmentAmount)} + entrada ${formatMoney(offer.upfrontAmount)}`,
              })),
            ]}
          />
        ) : null}
        {!useExistingEntry ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField
              label="Entrada já paga"
              required
              value={entryText}
              onChange={(event) => setEntryText(event.target.value)}
            />
            <DateField
              label="Data em que pagou a entrada"
              required
              value={entryDate}
              onChange={(event) => setEntryDate(event.target.value)}
            />
          </div>
        ) : null}
        {!useExistingEntry ? (
          <SelectField
            label="Conta usada para a entrada"
            required
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            options={
              accounts.length
                ? accounts.map((item) => ({ value: item.id, label: item.name }))
                : [{ value: "", label: "Cadastre uma conta primeiro" }]
            }
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField
            label="Número de parcelas"
            type="number"
            min="2"
            max="120"
            required
            value={installmentsText}
            onChange={(event) => setInstallmentsText(event.target.value)}
          />
          <MoneyField
            label="Valor de cada parcela"
            required
            value={installmentText}
            onChange={(event) => setInstallmentText(event.target.value)}
          />
          <DateField
            label="Primeiro vencimento"
            required
            value={firstDueDate}
            onChange={(event) => setFirstDueDate(event.target.value)}
          />
        </div>
        <TextField
          label="CET anual (%)"
          hint="Opcional. Copie da oferta; não calcule por aproximação."
          value={cetText}
          onChange={(event) => setCetText(event.target.value)}
        />
        {summary && summary.financedPrincipal.amount > 0 && summary.financeCost.amount >= 0 ? (
          <div className="rounded-lg border border-[color:var(--card-border)] p-3 text-sm">
            <p>
              {useExistingEntry ? "Entrada já registrada" : "Entrada no caixa"}:{" "}
              <strong>{formatMoney(useExistingEntry ? statement.paidAmount : entry!)}</strong>
              {useExistingEntry ? " · não descontada novamente" : ` em ${entryDate}`}
            </p>
            <p>
              Saldo financiado: <strong>{formatMoney(summary.financedPrincipal)}</strong>
            </p>
            <p>
              Total das parcelas futuras: <strong>{formatMoney(summary.futureTotal)}</strong> ·
              custo do financiamento: <strong>{formatMoney(summary.financeCost)}</strong>
            </p>
            <ul className="mt-2 space-y-1">
              {summary.dates.map((date, index) => (
                <li key={index}>
                  Parcela {index + 1}: {formatMoney(installmentAmount!)} ·{" "}
                  {formatCalendarDate(date)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 size-5"
          />
          Confirmo que contratei este parcelamento com o emissor e que a entrada já foi paga.
        </label>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={saving || !confirmed || !summary || (!useExistingEntry && !accountId)}
          >
            {saving ? "Registrando…" : "Registrar parcelamento"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
