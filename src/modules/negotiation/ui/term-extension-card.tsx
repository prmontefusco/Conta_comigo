"use client";

import { useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, money } from "@/core/money/money";
import { Badge, Card, CardTitle, Callout, Stat } from "@/components/ui/primitives";
import { MoneyField, SelectField } from "@/components/ui/form";
import {
  OUTCOME_LABELS,
  explainOutcome,
  planTermExtension,
  type TermExtensionOutcome,
} from "@/modules/negotiation/domain/term-extension";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useRecoveryTimeline } from "@/modules/recovery-timeline/ui/use-recovery-timeline";

/**
 * Qual prazo pedir.
 *
 * Fecha um laço que o produto tinha deixado aberto: a tela de Visão de Futuro
 * passou a dizer "o caminho é alongar prazo, não pagar mais rápido" e mandava
 * a pessoa para cá — onde havia o roteiro da ligação e nenhum número para
 * levar nela. Quem liga sem valor definido sai com o que o credor ofereceu.
 *
 * O alívio e o custo aparecem lado a lado. Alongar prazo resolve o mês e
 * encarece a dívida; as duas coisas são verdade, e mostrar só a primeira seria
 * o mesmo tipo de conveniência que este produto passou a auditoria removendo.
 */
export function TermExtensionCard() {
  const finance = useFinance();
  const timeline = useRecoveryTimeline();

  const debts = finance.debts.filter((debt) => debt.status !== "SETTLED");
  const [debtId, setDebtId] = useState("");
  const [shortfallText, setShortfallText] = useState("");

  if (debts.length === 0) return null;

  const selected = debts.find((debt) => debt.id === debtId) ?? debts[0]!;
  const shortfall = fromDecimalString(shortfallText) ?? timeline.feasibility.monthlyShortfall;

  const plan = planTermExtension({
    asOf: finance.asOf,
    debt: selected,
    paidInstallmentNumbers: finance.paidDebtInstallments.get(selected.id) ?? [],
    monthlyShortfall: shortfall,
  });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle hint="O número para levar na ligação, em vez de improvisar.">
          Qual prazo pedir
        </CardTitle>
        <Badge tone={toneFor(plan.outcome)}>{OUTCOME_LABELS[plan.outcome]}</Badge>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Sobre qual dívida"
          value={selected.id}
          onChange={(event) => setDebtId(event.target.value)}
          options={debts.map((debt) => ({
            value: debt.id,
            label: debt.institution
              ? `${debt.description} · ${debt.institution}`
              : debt.description,
          }))}
        />
        <MoneyField
          label="Quanto falta por mês"
          value={shortfallText}
          onChange={(event) => setShortfallText(event.target.value)}
          placeholder={(timeline.feasibility.monthlyShortfall.amount / 100)
            .toFixed(2)
            .replace(".", ",")}
          hint="Já vem com o que o seu diagnóstico calculou. Ajuste se quiser folga maior."
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[color:var(--card-border)] pt-4 sm:grid-cols-4">
        <Stat label="Saldo devedor" value={plan.outstanding} size="base" tone="outflow" />
        <Stat label="Parcela hoje" value={plan.currentInstallment} size="base" />

        {plan.outcome === "FEASIBLE" || plan.outcome === "TERM_TOO_LONG" ? (
          <>
            <div>
              <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
                Parcela a pedir
              </dt>
              <dd className="tabular mt-1 text-lg font-bold text-[color:var(--color-brand-700)]">
                {formatMoney(plan.affordableInstallment)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
                Em quantas parcelas
              </dt>
              <dd className="tabular mt-1 text-lg font-bold text-[color:var(--color-brand-700)]">
                {plan.requiredMonths}x
                <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                  hoje faltam {plan.currentRemainingCount}
                </p>
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      {plan.outcome === "FEASIBLE" || plan.outcome === "TERM_TOO_LONG" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--color-positive-600)" }}
          >
            <p className="text-2xs font-semibold tracking-wider uppercase">O mês respira</p>
            <p
              className="tabular mt-1 text-lg font-bold"
              style={{ color: "var(--color-positive-700)" }}
            >
              + {formatMoney(plan.monthlyRelief)} por mês
            </p>
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: "var(--tone-attention)" }}>
            <p className="text-2xs font-semibold tracking-wider uppercase">A dívida encarece</p>
            <p
              className="tabular mt-1 text-lg font-bold"
              style={{ color: "var(--tone-attention)" }}
            >
              + {formatMoney(plan.extraCost ?? money(0))} no total
            </p>
            <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              {formatMoney(plan.newTotalPaid ?? money(0))} em vez de{" "}
              {formatMoney(plan.currentTotalRemaining)}
            </p>
          </div>
        </div>
      ) : null}

      <Callout tone={plan.outcome === "FEASIBLE" ? "info" : "attention"}>
        {explainOutcome(plan)}
      </Callout>

      {plan.outcome === "FEASIBLE" ? (
        <div className="mt-3 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3">
          <p className="text-2xs font-semibold tracking-wider uppercase">O que dizer</p>
          <p className="mt-1.5 text-sm">
            &ldquo;Meu saldo devedor é de {formatMoney(plan.outstanding)}. Hoje a parcela é{" "}
            {formatMoney(plan.currentInstallment)} e ela não cabe mais no meu mês. Consigo pagar{" "}
            {formatMoney(plan.affordableInstallment)} por mês, em dia. Dá para refazer o contrato em{" "}
            {plan.requiredMonths} parcelas nesse valor?&rdquo;
          </p>
        </div>
      ) : null}

      {plan.rateSource !== "CONTRACT" ? (
        <p className="text-2xs mt-3" style={{ color: "var(--muted-fg)" }}>
          A taxa usada aqui{" "}
          {plan.rateSource === "UNKNOWN"
            ? "não é conhecida, então o cálculo assume que não há juro — o prazo real será maior."
            : "foi deduzida da parcela e do prazo, não veio do contrato."}{" "}
          Informe a taxa ou o CET em Dívidas para o número ficar exato.
        </p>
      ) : null}
    </Card>
  );
}

function toneFor(outcome: TermExtensionOutcome): "positive" | "attention" | "critical" | "neutral" {
  if (outcome === "FEASIBLE") return "positive";
  if (outcome === "ALREADY_FITS") return "neutral";
  if (outcome === "NEVER_AMORTISES") return "critical";
  return "attention";
}
