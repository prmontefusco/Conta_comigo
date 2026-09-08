"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString } from "@/core/money/money";
import { Badge, Card, CardTitle, Callout, Spinner, Stat } from "@/components/ui/primitives";
import { MoneyField } from "@/components/ui/form";
import { totalLateFees } from "@/modules/obligations/domain/late-fees";
import {
  TIER_EXPLANATIONS,
  TIER_LABELS,
  buildTriage,
  type TriageItem,
  type TriageTier,
} from "@/modules/obligations/domain/triage";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { RunwayCard } from "@/modules/dashboard/ui/runway-card";
import { ReserveTiersCard } from "@/modules/reserves/ui/reserve-tiers-card";

/**
 * O que pagar quando o dinheiro não dá para tudo.
 *
 * O aplicativo sabia dizer que a pessoa estava mal e sabia projetar quando ela
 * sairia disso. Não sabia responder a pergunta do dia 20 com R$ 300 na conta e
 * cinco boletos na mesa — e essa é a pergunta que o público endividado faz.
 *
 * A ordem é por consequência, não por valor nem por juros: primeiro o que
 * corta água, luz ou gás; depois o que pode custar o carro; depois o que
 * cresce com multa; e por último a cobrança que só pressiona. É a mesma
 * hierarquia que `debt-risk.ts` já usava para dívidas, aplicada às contas.
 */
export default function EmergencyPage() {
  const finance = useFinance();
  const [cashText, setCashText] = useState("");

  if (finance.loading) return <Spinner label="Organizando suas contas" />;

  const availableCash = fromDecimalString(cashText) ?? finance.overview.today.spendableCash;

  const triage = buildTriage({
    asOf: finance.asOf,
    availableCash,
    obligations: finance.obligations,
    debts: finance.debts,
    cardStatements: finance.cardStatements,
    cardNames: new Map(finance.cards.map((card) => [card.id, card.name])),
    paidDebtInstallments: finance.paidDebtInstallments,
  });

  const lateFees = totalLateFees(finance.obligations, finance.asOf);

  const groups = groupByTier(triage.items);
  const hasNothing = triage.items.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Modo emergência</h1>
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          Com o dinheiro que você tem hoje, o que pagar primeiro.
        </p>
      </div>

      {hasNothing ? (
        <Callout tone="positive">
          Nada vencido e nada vencendo nos próximos sete dias. Esta tela existe para o mês em que
          isso mudar — e ela vai estar aqui.
        </Callout>
      ) : null}

      <Card>
        <CardTitle hint="Comece por aqui. O resto da tela se ajusta a este número.">
          Quanto você tem para pagar contas hoje
        </CardTitle>

        <div className="mt-3 max-w-xs">
          <MoneyField
            label="Dinheiro disponível"
            value={cashText}
            onChange={(event) => setCashText(event.target.value)}
            placeholder={(finance.overview.today.spendableCash.amount / 100)
              .toFixed(2)
              .replace(".", ",")}
            hint="Já vem preenchido com seu saldo livre. Ajuste se a sua realidade for outra."
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[color:var(--card-border)] pt-4 sm:grid-cols-3">
          <Stat label="Dá para pagar agora" value={triage.payableNow} size="base" />
          <Stat label="Fica de fora" value={triage.unpayable} size="base" tone="outflow" />
          {lateFees.count > 0 ? (
            <div>
              <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
                O atraso custa por dia
              </dt>
              <dd
                className="tabular mt-1 text-lg font-bold"
                style={{ color: "var(--tone-critical)" }}
              >
                {formatMoney(lateFees.dailyCost)}

                <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                  Multa e juros já somam {formatMoney(lateFees.charges)}
                </p>
              </dd>
            </div>
          ) : null}
        </dl>

        {lateFees.count > 0 ? (
          <p className="text-2xs mt-3" style={{ color: "var(--muted-fg)" }}>
            Estimativa pelo padrão de consumo no Brasil: multa de 2% uma vez, mais 1% ao mês de
            juros proporcionais aos dias. O valor do seu boleto pode diferir — serve para saber a
            ordem de grandeza, não para conferir a cobrança.
          </p>
        ) : null}
      </Card>

      {groups.map(([tier, items]) => (
        <Card key={tier}>
          <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--card-border)] pb-3">
            <Badge tone={toneFor(tier)}>{TIER_LABELS[tier]}</Badge>
            <span className="text-2xs" style={{ color: "var(--muted-fg)" }}>
              {items.length} {items.length === 1 ? "item" : "itens"}
            </span>
          </div>

          <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
            {TIER_EXPLANATIONS[tier]}
          </p>

          <ul className="mt-3 divide-y divide-[color:var(--card-border)]">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="text-2xs mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-bold"
                  style={{
                    background: item.coveredByAvailableCash
                      ? "var(--color-positive-100, var(--color-surface-sunken))"
                      : "var(--color-surface-sunken)",
                    color: item.coveredByAvailableCash
                      ? "var(--color-positive-700)"
                      : "var(--muted-fg)",
                  }}
                >
                  {item.coveredByAvailableCash ? "✓" : "—"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--muted-fg)" }}>
                    {item.consequence}
                  </p>
                  <p className="text-2xs mt-1" style={{ color: "var(--muted-fg)" }}>
                    {item.daysLate > 0
                      ? `Venceu em ${formatCalendarDate(item.dueDate)}`
                      : `Vence em ${formatCalendarDate(item.dueDate)}`}
                    {item.dailyCost.amount > 0
                      ? ` · ${formatMoney(item.dailyCost)} por dia parada`
                      : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="tabular text-sm font-semibold">{formatMoney(item.amount)}</p>
                  <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                    {item.coveredByAvailableCash ? "cabe hoje" : "não cabe hoje"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {triage.unpayable.amount > 0 ? (
        <Card>
          <CardTitle>O que fazer com o que não coube</CardTitle>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
            Faltam {formatMoney(triage.unpayable)} para cobrir tudo. Deixar vencer em silêncio é o
            caminho mais caro: quase todo credor abre parcelamento para quem liga <em>antes</em> do
            corte ou da negativação, e fecha depois.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <strong>Concessionária de água, luz ou gás:</strong> peça parcelamento antes da data
              de corte. Religação tem taxa e costuma custar mais que a diferença.
            </li>
            <li>
              <strong>Banco, com bem em garantia:</strong> peça prorrogação ou carência antes de
              atrasar. Depois da busca e apreensão não há acordo que devolva o bem.
            </li>
            <li>
              <strong>Cartão:</strong> peça o parcelamento da fatura. Quase sempre custa muito menos
              que deixar rolar no rotativo.
            </li>
            <li>
              <strong>Cobrança sem garantia:</strong> é a última da fila e a primeira a negociar.
              Aceite prazo maior aqui para proteger as de cima.
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/app/negociar"
              className="inline-flex min-h-10 items-center rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[color:var(--color-brand-700)]"
            >
              Ver os roteiros de negociação
            </Link>
            <Link
              href="/app/superendividamento"
              className="inline-flex min-h-10 items-center rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 text-sm font-semibold text-[color:var(--page-fg)] transition hover:bg-[color:var(--color-surface-sunken)]"
            >
              ⚖️ Dossiê da Lei do Superendividamento
            </Link>
          </div>

          <p className="text-2xs mt-4" style={{ color: "var(--muted-fg)" }}>
            Se nada disso resolver, o atendimento é gratuito: Procon do seu município, Defensoria
            Pública e os mutirões de renegociação promovidos pelos tribunais e pelo Banco Central. O
            Conta comigo não negocia por você e não tem relação com nenhum credor.
          </p>
        </Card>
      ) : null}

      <div className="space-y-4 pt-2">
        <RunwayCard />
        <ReserveTiersCard />
      </div>
    </div>
  );
}

function groupByTier(items: readonly TriageItem[]): [TriageTier, TriageItem[]][] {
  const groups = new Map<TriageTier, TriageItem[]>();
  for (const item of items) {
    const list = groups.get(item.tier);
    if (list) list.push(item);
    else groups.set(item.tier, [item]);
  }
  return [...groups.entries()];
}

function toneFor(tier: TriageTier): "critical" | "attention" | "neutral" {
  if (tier === "ESSENTIAL_SERVICE" || tier === "ASSET_AT_RISK") return "critical";
  if (tier === "ACCRUING") return "attention";
  return "neutral";
}
