"use client";

import { useEffect, useState } from "react";
import { calendarDate, formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, subtract, toDecimal, type Money } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  cancelOccurrence,
  confirmOccurrence,
} from "@/modules/recurring/application/confirm-occurrence";
import type { PendingOccurrence } from "@/modules/recurring/domain/pending-occurrences";

/**
 * Confirmar quanto realmente entrou de um recebimento que se repete.
 *
 * O salário é uma regra: até aqui ele só existia como previsão, e não havia
 * onde dizer que caíram R$ 1.850 dos R$ 2.000 previstos. O campo vem
 * preenchido com o previsto e é editável — porque a diferença é a razão de
 * esta tela existir, não uma exceção.
 *
 * Há duas respostas possíveis, e as duas encerram a ocorrência:
 * confirmar com o valor real, ou dizer que não veio. Deixar em aberto seria a
 * terceira, e é justamente a que produz uma previsão que nunca se resolve.
 */
export function ConfirmOccurrenceDialog({
  pending,
  onClose,
}: {
  pending: PendingOccurrence | null;
  onClose: () => void;
}) {
  const { accounts, asOf } = useFinance();
  const { household, user } = useSession();

  const [accountId, setAccountId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [settledOn, setSettledOn] = useState<string>(asOf);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const usableAccounts = accounts.filter((account) => !account.archived);
  const defaultAccountId = usableAccounts[0]?.id ?? "";

  useEffect(() => {
    if (!pending) return;
    setAmountText(toDecimal(pending.occurrence.amount).toFixed(2).replace(".", ","));
    setAccountId(pending.rule.expectedAccountId ?? defaultAccountId);
    // A data provável é a do vencimento, a menos que ela ainda não tenha
    // chegado — ninguém confirma o que não aconteceu.
    setSettledOn(pending.occurrence.dueDate > asOf ? asOf : pending.occurrence.dueDate);
    setError(null);
  }, [pending, asOf, defaultAccountId]);

  if (!pending) return null;

  const isInflow = pending.rule.direction === "INFLOW";
  const expected = pending.occurrence.amount;

  const typed = fromDecimalString(amountText);
  const difference: Money | null =
    typed && typed.amount !== expected.amount
      ? typed.amount < expected.amount
        ? subtract(expected, typed)
        : subtract(typed, expected)
      : null;
  const short = Boolean(typed && typed.amount < expected.amount);

  async function run(action: "confirm" | "skip") {
    if (!household || !user || !pending) return;
    setError(null);

    if (action === "confirm" && !accountId) {
      setError("Escolha em qual conta o dinheiro entrou ou saiu.");
      return;
    }

    const amount = fromDecimalString(amountText);
    if (action === "confirm" && (!amount || amount.amount <= 0)) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setSaving(true);
    const result = await (
      action === "confirm"
        ? confirmOccurrence({
            db: getDb(),
            householdId: household.id,
            uid: user.uid,
            rule: pending.rule,
            occurrence: pending.occurrence,
            amount: amount!,
            accountId,
            settledOn: calendarDate(settledOn),
            asOf,
          })
        : cancelOccurrence({
            db: getDb(),
            householdId: household.id,
            uid: user.uid,
            rule: pending.rule,
            occurrence: pending.occurrence,
          })
    ).catch((runError: unknown) => {
      console.error(runError);
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
      open={Boolean(pending)}
      onClose={onClose}
      title={isInflow ? "Confirmar recebimento" : "Confirmar pagamento"}
      description={`${pending.rule.description} · previsto para ${formatCalendarDate(pending.occurrence.dueDate)}`}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run("confirm");
        }}
        className="space-y-4"
        noValidate
      >
        {error ? <FormError>{error}</FormError> : null}

        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Previsto: <strong className="tabular">{formatMoney(expected)}</strong>
        </p>

        <MoneyField
          label={isInflow ? "Valor que realmente entrou" : "Valor realmente pago"}
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          hint={
            isInflow
              ? "O valor do extrato. Descontos em folha fazem o líquido ser menor que o previsto — é normal, e é este número que vale."
              : "O valor que saiu de fato."
          }
        />

        {difference ? (
          <Callout tone="info">
            <span className="text-sm">
              {short ? `${formatMoney(difference)} a menos` : `${formatMoney(difference)} a mais`}{" "}
              que o previsto. Só o valor confirmado entra no saldo; a previsão desta ocorrência é
              encerrada e a projeção segue com as próximas.
            </span>
          </Callout>
        ) : null}

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
          label={isInflow ? "Data em que caiu" : "Data do pagamento"}
          required
          value={settledOn}
          max={asOf}
          onChange={(event) => setSettledOn(event.target.value)}
          hint={`O mês de competência continua sendo ${pending.occurrence.competenceDate.slice(0, 7).split("-").reverse().join("/")}.`}
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Registrando…" : "Confirmar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
        </div>

        <div className="border-t border-[color:var(--card-border)] pt-4">
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            disabled={saving}
            onClick={() => void run("skip")}
          >
            {isInflow ? "Não recebi este mês" : "Não paguei este mês"}
          </Button>
          <p className="text-2xs mt-1" style={{ color: "var(--muted-fg)" }}>
            Tira esta ocorrência da projeção sem mexer nas próximas.
          </p>
        </div>
      </form>
    </Modal>
  );
}
