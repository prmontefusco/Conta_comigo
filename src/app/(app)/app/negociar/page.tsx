"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, money, subtract, type Money } from "@/core/money/money";
import { Badge, Button, Callout, Card, CardTitle, Spinner, Stat } from "@/components/ui/primitives";
import { MoneyField, SelectField, TextField } from "@/components/ui/form";
import { outstandingPrincipal } from "@/modules/debts/domain/debt";
import {
  SUSTAINABLE_COMMITMENT_RATIO,
  VERDICT_LABELS,
  evaluateProposal,
  proposalCapacity,
  type ProposalVerdict,
} from "@/modules/negotiation/domain/affordable-proposal";
import { NEGOTIATION_SCRIPTS, type ScriptParams } from "@/modules/negotiation/domain/scripts";
import { FeiraoCalculatorCard } from "@/modules/negotiation/ui/feirao-calculator-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * Negotiating, with the arithmetic done first.
 *
 * The order of this screen is the order of the conversation it prepares
 * someone for: work out what actually fits, judge the offer against that, and
 * only then pick up the phone. Doing it the other way round - improvising a
 * number under pressure and checking later whether it works - is how a
 * household ends up with an agreement it breaks in the third month, worse off
 * than before it renegotiated.
 */
export default function NegotiatePage() {
  const finance = useFinance();
  const { profile } = useSession();

  const suggested = useMemo(() => monthlyBaseline(finance), [finance]);

  const [incomeText, setIncomeText] = useState("");
  const [essentialsText, setEssentialsText] = useState("");
  const [debtPaymentsText, setDebtPaymentsText] = useState("");
  const [savingText, setSavingText] = useState("");

  const [installmentText, setInstallmentText] = useState("");
  const [installmentCount, setInstallmentCount] = useState("12");
  const [downPaymentText, setDownPaymentText] = useState("");
  const [balanceText, setBalanceText] = useState("");
  const [debtId, setDebtId] = useState("");

  if (finance.loading) return <Spinner label="Carregando seus números" />;

  const income = fromDecimalString(incomeText) ?? suggested.income;
  const essentials = fromDecimalString(essentialsText) ?? suggested.essentials;
  const debtPayments = fromDecimalString(debtPaymentsText) ?? suggested.debtPayments;
  const saving = fromDecimalString(savingText) ?? money(0);

  const capacity = proposalCapacity({
    monthlyIncome: income,
    monthlyEssentials: essentials,
    monthlyDebtPayments: debtPayments,
    monthlySaving: saving,
  });

  const offerInstallment = fromDecimalString(installmentText);
  const evaluation = offerInstallment
    ? evaluateProposal(
        capacity,
        {
          installmentAmount: offerInstallment,
          installmentCount: Math.max(1, Number(installmentCount) || 1),
          downPayment: fromDecimalString(downPaymentText) ?? undefined,
          claimedBalance: fromDecimalString(balanceText) ?? undefined,
        },
        income,
      )
    : null;

  const debts = finance.debts.filter((debt) => debt.status !== "SETTLED");
  const selectedDebt = debts.find((debt) => debt.id === debtId);

  const scriptParams: ScriptParams = {
    ...(profile?.displayName ? { personName: profile.displayName } : {}),
    ...(selectedDebt?.institution ? { creditorName: selectedDebt.institution } : {}),
    ...(selectedDebt ? { debtDescription: selectedDebt.description } : {}),
    ...(selectedDebt
      ? {
          claimedBalance: outstandingPrincipal(
            selectedDebt,
            finance.paidDebtInstallments.get(selectedDebt.id) ?? [],
          ),
        }
      : fromDecimalString(balanceText)
        ? { claimedBalance: fromDecimalString(balanceText)! }
        : {}),
    ...(capacity.maxInstallment.amount > 0
      ? { affordableInstallment: capacity.maxInstallment }
      : {}),
    installmentCount: Math.max(1, Number(installmentCount) || 1),
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Negociar dívidas</h1>

      <Card>
        <CardTitle hint="Comece por aqui, antes de qualquer ligação.">
          Quanto cabe de verdade
        </CardTitle>

        <p className="mb-4 text-sm" style={{ color: "var(--muted-fg)" }}>
          Os valores vêm dos seus lançamentos e da sua projeção. Ajuste se a sua realidade for outra
          — quem decide o que é essencial é você.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField
            label="Renda que entra por mês"
            value={incomeText}
            onChange={(event) => setIncomeText(event.target.value)}
            placeholder={decimalPlaceholder(suggested.income)}
            hint="O que realmente cai na conta, já descontado o que sai na folha."
          />
          <MoneyField
            label="Gastos essenciais do mês"
            value={essentialsText}
            onChange={(event) => setEssentialsText(event.target.value)}
            placeholder={decimalPlaceholder(suggested.essentials)}
            hint="Moradia, comida, transporte, luz, água, escola, remédio."
          />
          <MoneyField
            label="Já pago em dívidas por mês"
            value={debtPaymentsText}
            onChange={(event) => setDebtPaymentsText(event.target.value)}
            placeholder={decimalPlaceholder(suggested.debtPayments)}
            hint="Parcelas de empréstimos e faturas de cartão."
          />
          <MoneyField
            label="Quero continuar guardando"
            value={savingText}
            onChange={(event) => setSavingText(event.target.value)}
            placeholder="0,00"
            hint="A reserva de partida vem antes de aceitar um acordo que consome tudo."
          />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat
            label="Sobra no mês"
            value={capacity.leftOver}
            tone={capacity.leftOver.amount > 0 ? "positive" : "critical"}
          />
          <Stat
            label="Teto pelos 30% da renda"
            value={capacity.ratioCeiling}
            tone="neutral"
            hint={`Referência usual: no máximo ${Math.round(SUSTAINABLE_COMMITMENT_RATIO * 100)}% da renda comprometidos com dívida.`}
          />
          <Stat
            label="Parcela máxima"
            value={capacity.maxInstallment}
            size="lg"
            tone={capacity.maxInstallment.amount > 0 ? "positive" : "critical"}
            hint={limitExplanation(capacity.limitedBy)}
          />
        </dl>

        {capacity.maxInstallment.amount === 0 ? (
          <div className="mt-4">
            <Callout tone="attention" title="Hoje não sobra nada para um acordo novo">
              Aceitar uma parcela agora significaria deixar de pagar outra coisa. Antes de negociar,
              vale olhar o que dá para reduzir no mês ou pedir prazo — há um roteiro para isso mais
              abaixo.
            </Callout>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardTitle hint="Cole aqui o que o credor ofereceu.">Avaliar a proposta recebida</CardTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField
            label="Valor da parcela proposta"
            value={installmentText}
            onChange={(event) => setInstallmentText(event.target.value)}
            placeholder="0,00"
          />
          <TextField
            label="Número de parcelas"
            type="number"
            min={1}
            max={240}
            value={installmentCount}
            onChange={(event) => setInstallmentCount(event.target.value)}
          />
          <MoneyField
            label="Entrada pedida"
            value={downPaymentText}
            onChange={(event) => setDownPaymentText(event.target.value)}
            placeholder="0,00"
          />
          <MoneyField
            label="Saldo que o credor diz que você deve"
            value={balanceText}
            onChange={(event) => setBalanceText(event.target.value)}
            placeholder="0,00"
            hint="Com ele dá para ver os juros embutidos no acordo."
          />
        </div>

        {evaluation ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={verdictTone(evaluation.verdict)}>
                {VERDICT_LABELS[evaluation.verdict]}
              </Badge>
              <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
                {verdictExplanation(evaluation.verdict, capacity.maxInstallment)}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Total do acordo" value={evaluation.totalPaid} tone="outflow" />
              <Stat
                label={evaluation.headroom.amount >= 0 ? "Folga na parcela" : "Acima do que cabe"}
                value={evaluation.headroom}
                tone={evaluation.headroom.amount >= 0 ? "positive" : "critical"}
              />
              <div>
                <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
                  Renda comprometida depois
                </dt>
                <dd className="tabular mt-0.5 text-xl font-semibold">
                  {Math.round(evaluation.commitmentRatioAfter * 100)}%
                </dd>
              </div>
              <div>
                <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
                  Juros embutidos
                </dt>
                <dd className="tabular mt-0.5 text-xl font-semibold">
                  {evaluation.impliedMonthlyRate === null
                    ? "—"
                    : `${evaluation.impliedMonthlyRate.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}% a.m.`}
                </dd>
                <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {evaluation.impliedMonthlyRate === null
                    ? "Informe o saldo devedor para calcular."
                    : "Calculado a partir do saldo e das parcelas."}
                </p>
              </div>
            </dl>

            {evaluation.differenceVsClaimed ? (
              <Callout
                tone={evaluation.differenceVsClaimed.amount >= 0 ? "info" : "attention"}
                title={
                  evaluation.differenceVsClaimed.amount >= 0
                    ? "O acordo custa menos que o saldo cobrado"
                    : "O acordo custa mais que o saldo cobrado"
                }
              >
                Somando entrada e parcelas, o acordo sai por {formatMoney(evaluation.totalPaid)}{" "}
                para quitar {formatMoney(fromDecimalString(balanceText)!)}. A diferença é de{" "}
                {formatMoney({
                  amount: Math.abs(evaluation.differenceVsClaimed.amount),
                  currency: evaluation.differenceVsClaimed.currency,
                })}
                {evaluation.differenceVsClaimed.amount >= 0
                  ? " a menos."
                  : " a mais — é o custo de parcelar."}
              </Callout>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm" style={{ color: "var(--muted-fg)" }}>
            Informe o valor da parcela proposta para ver se ela cabe.
          </p>
        )}
      </Card>

      <FeiraoCalculatorCard
        capacity={capacity}
        availableCash={finance.totalCash}
        minimumReserveCushion={finance.protectedReserve}
      />

      <Card>
        <CardTitle hint="Leia em voz alta. Não precisa improvisar.">
          O que dizer ao credor
        </CardTitle>

        {debts.length > 0 ? (
          <SelectField
            label="Sobre qual dívida"
            value={debtId}
            onChange={(event) => setDebtId(event.target.value)}
            options={[
              { value: "", label: "Não preencher automaticamente" },
              ...debts.map((debt) => ({
                value: debt.id,
                label: debt.institution
                  ? `${debt.description} · ${debt.institution}`
                  : debt.description,
              })),
            ]}
            hint="Preenche o roteiro com o credor, a descrição e o saldo que o app conhece."
          />
        ) : null}

        <div className="mt-4 space-y-3">
          {NEGOTIATION_SCRIPTS.map((script) => (
            <ScriptBlock key={script.id} script={script} params={scriptParams} />
          ))}
        </div>

        <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
          Os roteiros são um apoio para a conversa. O Conta comigo não negocia por você, não tem
          relação com nenhum credor e não garante resultado.
        </p>
      </Card>
    </div>
  );
}

function ScriptBlock({
  script,
  params,
}: {
  script: (typeof NEGOTIATION_SCRIPTS)[number];
  params: ScriptParams;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = script.build(params);

  return (
    <div className="rounded-xl border border-[color:var(--card-border)] p-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">{script.title}</span>
          <span className="mt-0.5 block text-xs" style={{ color: "var(--muted-fg)" }}>
            {script.whenToUse}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-sm">
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase">Antes e depois</h4>
            <ul className="mt-1 ml-4 list-disc space-y-1 text-xs">
              {script.checklist.map((item) => (
                <li key={item} style={{ color: "var(--muted-fg)" }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Canal: {script.channel}
          </p>

          <pre className="overflow-x-auto rounded-lg border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3 text-xs whitespace-pre-wrap">
            {text}
          </pre>

          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copiado" : "Copiar roteiro"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The household's ordinary month, from the projection.
 *
 * Averaged over whole months, never taken from the horizon totals: those cover
 * more than a year, and using them here would tell someone they can afford
 * thirteen times what they can.
 */
function monthlyBaseline(finance: ReturnType<typeof useFinance>): {
  income: Money;
  essentials: Money;
  debtPayments: Money;
} {
  const months = finance.forecast.months.filter((month) => !month.isPartial);

  const average = (values: readonly number[]): Money =>
    money(
      values.length === 0
        ? 0
        : Math.round(values.reduce((total, value) => total + value, 0) / values.length),
    );

  const income = average(months.map((month) => month.expectedInflows.amount));
  const outflows = average(months.map((month) => month.committedOutflows.amount));
  const debtPayments = average(months.map((month) => month.debtCommitment.amount));

  return { income, essentials: subtract(outflows, debtPayments), debtPayments };
}

function decimalPlaceholder(value: Money): string {
  return (value.amount / 100).toFixed(2).replace(".", ",");
}

function limitExplanation(limitedBy: ReturnType<typeof proposalCapacity>["limitedBy"]): string {
  switch (limitedBy) {
    case "CASH":
      return "Limitada pelo que sobra no seu mês.";
    case "RATIO":
      return "Limitada pelo teto de comprometimento da renda.";
    case "NOTHING_LEFT":
      return "Não sobra margem para uma parcela nova hoje.";
  }
}

function verdictTone(verdict: ProposalVerdict): "positive" | "attention" | "critical" {
  return verdict === "FITS" ? "positive" : verdict === "TIGHT" ? "attention" : "critical";
}

function verdictExplanation(verdict: ProposalVerdict, max: Money): string {
  switch (verdict) {
    case "FITS":
      return "A parcela está dentro do que você consegue sustentar.";
    case "TIGHT":
      return `Cabe, mas sem folga. Um imprevisto derruba o acordo — contraproposta razoável: até ${formatMoney(max)}.`;
    case "DOES_NOT_FIT":
      return `Essa parcela é maior do que sobra no seu mês. O que cabe hoje é até ${formatMoney(max)}.`;
  }
}
