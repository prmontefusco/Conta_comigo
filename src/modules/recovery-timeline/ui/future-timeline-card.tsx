"use client";

import Link from "next/link";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { Card, CardTitle, Stat } from "@/components/ui/primitives";
import { calculateRecoveryTimeline } from "@/modules/recovery-timeline/domain/recovery-calculator";
import { useFinance } from "@/modules/household/ui/finance-provider";

export function FutureTimelineCard() {
  const finance = useFinance();

  const timeline = calculateRecoveryTimeline({
    asOf: finance.asOf,
    openingBalance: finance.totalCash,
    totalCash: finance.totalCash,
    protectedReserve: finance.protectedReserve,
    forecast: finance.forecast,
    debts: finance.debts,
    cardStatements: finance.cardStatements,
    reserves: finance.reserves,
    paidDebtInstallments: finance.paidDebtInstallments,
  });

  const hasDebts = timeline.totalDebtAmount.amount > 0;

  return (
    <Card className="relative overflow-hidden border-2 border-[color:var(--card-border)] bg-gradient-to-br from-[color:var(--card-bg)] to-[color:var(--color-surface-sunken)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <CardTitle hint="Estimativa de tempo e marcos para sua organização e estabilidade total">
              Visão de Futuro e Liberdade Financeira
            </CardTitle>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            Previsão com base no seu fluxo de caixa e compromissos cadastrados
          </p>
        </div>

        <Link
          href="/app/visao-futuro"
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 text-xs font-semibold shadow-2xs transition hover:border-[color:var(--color-brand-600)] hover:text-[color:var(--color-brand-600)]"
        >
          Ver Detalhes e Estratégias ➔
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {hasDebts ? (
          <>
            <div>
              <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
                Tempo para Quitar Dívidas
              </dt>
              <dd className="mt-1">
                <span className="tabular text-xl font-bold text-[color:var(--color-brand-700)]">
                  {timeline.monthsToDebtFree} {timeline.monthsToDebtFree === 1 ? "mês" : "meses"}
                </span>
                <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                  Previsão: {formatCalendarDate(timeline.debtFreeDate)}
                </p>
              </dd>
            </div>

            <Stat
              label="Passivo a Liquidar"
              value={timeline.totalDebtAmount}
              size="base"
              tone="outflow"
            />
          </>
        ) : (
          <div>
            <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
              Dívidas Ativas
            </dt>
            <dd className="mt-1">
              <span className="tabular text-xl font-bold text-[color:var(--color-positive-700)]">
                Zeradas! 🎉
              </span>
              <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                Nenhum passivo pendente
              </p>
            </dd>
          </div>
        )}

        <div>
          <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
            Reserva de 3 Meses Pronta
          </dt>
          <dd className="mt-1">
            <span className="tabular text-xl font-bold text-[color:var(--page-fg)]">
              {timeline.monthsToEmergencyFund} meses
            </span>
            <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              Previsão: {formatCalendarDate(timeline.emergencyFundDate)}
            </p>
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
            Estabilidade Consolidada
          </dt>
          <dd className="mt-1">
            <span className="tabular text-xl font-bold text-[color:var(--color-positive-700)]">
              {timeline.monthsToStability} meses
            </span>
            <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              Previsão: {formatCalendarDate(timeline.stabilityDate)}
            </p>
          </dd>
        </div>
      </dl>

      {/* Timeline visual de marcos */}
      <div className="mt-6 border-t border-[color:var(--card-border)] pt-4">
        <h4 className="mb-3 text-xs font-semibold tracking-wider text-[color:var(--muted-fg)] uppercase">
          Linha do Tempo da Sua Recuperação
        </h4>

        <div className="relative ml-3 space-y-4 border-l-2 border-[color:var(--color-brand-600)]/40 pl-4">
          {timeline.milestones.map((milestone, idx) => (
            <div key={milestone.id} className="group relative">
              <span
                className={`absolute top-1 -left-[1.35rem] size-3.5 rounded-full border-2 border-[color:var(--card-bg)] shadow-xs ${
                  milestone.isCompleted
                    ? "bg-[color:var(--color-positive-600)]"
                    : idx === 1
                      ? "bg-[color:var(--color-brand-600)] ring-4 ring-[color:var(--color-brand-100)]"
                      : "bg-[color:var(--color-ink-300)]"
                }`}
              />

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-[color:var(--page-fg)]">
                  {milestone.title}
                </span>
                <span className="text-2xs font-semibold text-[color:var(--color-brand-700)]">
                  {milestone.monthsFromNow === 0
                    ? "Agora"
                    : `em ${milestone.monthsFromNow} meses (${formatCalendarDate(milestone.targetDate)})`}
                </span>
              </div>

              <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                {milestone.description}
              </p>

              {milestone.valueFormatted ? (
                <p className="text-2xs mt-0.5 font-medium text-[color:var(--page-fg)]">
                  {milestone.valueFormatted}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
