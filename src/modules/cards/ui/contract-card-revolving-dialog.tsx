"use client";

import { useEffect, useState } from "react";
import {
  addMonths,
  differenceInDays,
  formatCalendarDate,
  formatMonthKey,
  tryCalendarDate,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import { contractCardRevolving } from "../application/contract-card-revolving";
import { estimateRevolvingCycle } from "../domain/card-revolving";
import type { CardStatement, CreditCard } from "../domain/credit-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

export function ContractCardRevolvingDialog({
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
  const [monthlyRate, setMonthlyRate] = useState("");
  const [annualCet, setAnnualCet] = useState("");
  const [iofDailyPercent, setIofDailyPercent] = useState("");
  const [iofAdditionalPercent, setIofAdditionalPercent] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!statement || !invoice) return;
    setMonthlyRate(invoice.revolvingOffer?.monthlyRatePercent?.toString() ?? "");
    setAnnualCet(invoice.revolvingOffer?.annualCetPercent?.toString() ?? "");
    setIofDailyPercent(invoice.revolvingOffer?.iofDailyPercent?.toString() ?? "");
    setIofAdditionalPercent(invoice.revolvingOffer?.iofAdditionalPercent?.toString() ?? "");
    setNextDueDate(addMonths(statement.dueDate, 1));
    setConfirmed(false);
    setError(null);
    // Reset only when opening another invoice; live snapshots must not erase
    // values the person is currently reviewing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statement?.id, invoice?.id]);

  if (!statement || !card || !invoice) return null;
  const rate = Number(monthlyRate.replace(",", "."));
  const dailyIofRate = iofDailyPercent.trim()
    ? Number(iofDailyPercent.replace(",", "."))
    : undefined;
  const additionalIofRate = iofAdditionalPercent.trim()
    ? Number(iofAdditionalPercent.replace(",", "."))
    : undefined;
  const parsedNextDueDate = tryCalendarDate(nextDueDate);
  const estimate =
    monthlyRate.trim() !== "" && Number.isFinite(rate) && parsedNextDueDate
      ? estimateRevolvingCycle({
          principal: statement.remainingAmount,
          monthlyRatePercent: rate,
          days: differenceInDays(finance.asOf, parsedNextDueDate),
          ...(dailyIofRate != null && Number.isFinite(dailyIofRate)
            ? { iofDailyPercent: dailyIofRate }
            : {}),
          ...(additionalIofRate != null && Number.isFinite(additionalIofRate)
            ? { iofAdditionalPercent: additionalIofRate }
            : {}),
        })
      : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household || !user || !confirmed || !estimate || !statement || !card || !invoice) return;
    const dueDate = tryCalendarDate(nextDueDate);
    const cet = annualCet.trim() ? Number(annualCet.replace(",", ".")) : undefined;
    if (
      !dueDate ||
      rate < 0 ||
      rate > 100 ||
      (dailyIofRate != null && (dailyIofRate < 0 || dailyIofRate > 100)) ||
      (additionalIofRate != null && (additionalIofRate < 0 || additionalIofRate > 100))
    ) {
      setError("Confira vencimento, taxa mensal e IOF copiados da fatura.");
      return;
    }
    setSaving(true);
    try {
      await contractCardRevolving({
        db: getDb(),
        householdId: household.id,
        uid: user.uid,
        invoice,
        creditCardName: card.name,
        visibility: card.visibility,
        paidAmount: statement.paidAmount,
        monthlyRatePercent: rate,
        ...(cet != null && Number.isFinite(cet) ? { annualCetPercent: cet } : {}),
        ...(dailyIofRate != null ? { iofDailyPercent: dailyIofRate } : {}),
        ...(additionalIofRate != null ? { iofAdditionalPercent: additionalIofRate } : {}),
        nextDueDate: dueDate,
        asOf: finance.asOf,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar o rotativo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      title="Registrar crédito rotativo"
      description={`${formatMonthKey(statement.referenceMonth)} · saldo ${formatMoney(statement.remainingAmount)}`}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}
        <Callout tone="critical">
          Use somente se o emissor confirmou que o saldo restante entrou no rotativo. O cálculo é
          uma estimativa de um ciclo e será substituído pelo total real da próxima fatura importada.
        </Callout>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Juros ao mês (%)"
            required
            value={monthlyRate}
            onChange={(event) => setMonthlyRate(event.target.value)}
          />
          <TextField
            label="CET anual (%)"
            value={annualCet}
            onChange={(event) => setAnnualCet(event.target.value)}
          />
          <TextField
            label="IOF diário (%)"
            value={iofDailyPercent}
            onChange={(event) => setIofDailyPercent(event.target.value)}
          />
          <TextField
            label="IOF adicional (%)"
            value={iofAdditionalPercent}
            onChange={(event) => setIofAdditionalPercent(event.target.value)}
          />
        </div>
        <DateField
          label="Vencimento da próxima fatura"
          required
          value={nextDueDate}
          onChange={(event) => setNextDueDate(event.target.value)}
        />
        {estimate ? (
          <div className="rounded-lg border border-[color:var(--card-border)] p-3 text-sm">
            <p>
              Saldo levado: <strong>{formatMoney(statement.remainingAmount)}</strong>
            </p>
            <p>
              Juros estimados: <strong>{formatMoney(estimate.interest)}</strong>
            </p>
            <p>
              IOF estimado:{" "}
              <strong>
                {formatMoney({
                  amount: estimate.dailyIof.amount + estimate.additionalIof.amount,
                  currency: estimate.dailyIof.currency,
                })}
              </strong>
            </p>
            <p className="mt-1">
              Na próxima fatura: <strong>{formatMoney(estimate.estimatedNextCharge)}</strong> em{" "}
              {tryCalendarDate(nextDueDate)
                ? formatCalendarDate(tryCalendarDate(nextDueDate)!)
                : "data inválida"}
            </p>
          </div>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 size-5"
          />
          Confirmo que paguei parte da fatura e que o emissor levou o restante ao crédito rotativo.
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !confirmed || !estimate}>
            {saving ? "Registrando…" : "Registrar rotativo"}
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
