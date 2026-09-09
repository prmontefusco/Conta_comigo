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
import { remainingAmount, type Obligation } from "@/modules/obligations/domain/obligation";
import { settleObligation } from "@/modules/obligations/application/settle-obligation";

/**
 * Registrar que uma conta foi paga, ou que o dinheiro entrou.
 *
 * O valor vem preenchido com o que estava previsto e continua editável, porque
 * receber ou pagar diferente do combinado é rotina, não exceção. O que mudou
 * foi a pergunta que vem **depois** do valor.
 *
 * Quando entra menos do que o previsto, há duas situações diferentes com a
 * mesma aparência:
 *
 * - **"foi só isso"** — o salário caiu R$ 1.850 dos R$ 2.000 previstos porque a
 *   Unimed foi descontada em folha. Não há R$ 150 a receber de ninguém, e
 *   deixá-los em aberto encheria a projeção de uma receita que não existe.
 * - **"ainda vou receber o resto"** — o cliente pagou metade agora e metade na
 *   semana que vem. Aí o resto precisa continuar visível.
 *
 * Só quem está olhando o extrato sabe qual das duas é. O padrão acompanha a
 * direção: salário não chega em duas parcelas, boleto pago pela metade sim.
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
  const [closeRemainder, setCloseRemainder] = useState(true);
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
    // Entrada encerra por padrão; saída mantém o resto em aberto.
    setCloseRemainder(obligation.direction === "INFLOW");
    setError(null);
  }, [obligation, asOf, defaultAccountId]);

  if (!obligation) return null;

  const isInflow = obligation.direction === "INFLOW";
  const outstanding = remainingAmount(obligation);

  const typed = fromDecimalString(amountText);
  const short = typed !== null && typed.amount > 0 && typed.amount < outstanding.amount;
  const over = typed !== null && typed.amount > outstanding.amount;
  const difference: Money | null = typed
    ? short
      ? subtract(outstanding, typed)
      : over
        ? subtract(typed, outstanding)
        : null
    : null;

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

    // Uma liquidação com data futura criaria de novo o problema que esta tela
    // existe para resolver: dinheiro contado como recebido antes de existir.
    if (paidOn > asOf) {
      setError(
        isInflow
          ? "A data do recebimento não pode estar no futuro. Se ainda não caiu, deixe em aberto."
          : "A data do pagamento não pode estar no futuro.",
      );
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
      closeRemainder: closeRemainder && amount.amount < outstanding.amount,
      // A confirmação do excesso é a própria escolha de encerrar: a tela mostra
      // a diferença antes, e quem marca já viu quanto está registrando a mais.
      allowOverpayment: amount.amount > outstanding.amount,
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
          {isInflow ? "Previsto" : "Em aberto"}:{" "}
          <strong className="tabular">{formatMoney(outstanding)}</strong>
        </p>

        <MoneyField
          label={isInflow ? "Valor que realmente entrou" : "Valor pago"}
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          hint={
            isInflow
              ? "O valor do extrato. Se veio diferente do previsto, é este que vale."
              : "Se você pagou apenas parte, ajuste o valor."
          }
        />

        {short && difference ? (
          <fieldset className="rounded-xl border border-[color:var(--card-border)] p-3">
            <legend className="px-1 text-xs font-medium">
              Faltaram {formatMoney(difference)}. E o resto?
            </legend>
            <div className="mt-1 space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="resto"
                  className="mt-1 size-4 shrink-0"
                  checked={closeRemainder}
                  onChange={() => setCloseRemainder(true)}
                />
                <span>
                  <strong>Foi só isso, encerrar.</strong>{" "}
                  <span style={{ color: "var(--muted-fg)" }}>
                    {isInflow
                      ? "Descontaram em folha, veio menos, e não há o que receber depois."
                      : "O valor combinado mudou e a conta está resolvida."}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="resto"
                  className="mt-1 size-4 shrink-0"
                  checked={!closeRemainder}
                  onChange={() => setCloseRemainder(false)}
                />
                <span>
                  <strong>
                    {isInflow ? "Ainda vou receber o resto." : "Ainda vou pagar o resto."}
                  </strong>{" "}
                  <span style={{ color: "var(--muted-fg)" }}>
                    Continua em aberto e na projeção.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        ) : null}

        {over && difference ? (
          <Callout tone="attention" title={`${formatMoney(difference)} acima do previsto`}>
            <span className="text-sm">
              {isInflow
                ? "Confira se não é um zero a mais. Se entrou isso mesmo, pode registrar."
                : "Confira se não é um zero a mais. Se pagou isso mesmo, pode registrar."}
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
          label={isInflow ? "Data do recebimento" : "Data do pagamento"}
          required
          value={paidOn}
          max={asOf}
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
