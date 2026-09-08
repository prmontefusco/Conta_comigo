"use client";

import Link from "next/link";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { Card, CardTitle, Stat } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useRecoveryTimeline } from "./use-recovery-timeline";
import { HorizonStat, PlanViabilityNotice } from "./plan-viability-notice";

export function FutureTimelineCard() {
  const timeline = useRecoveryTimeline();
  const finance = useFinance();

  const hasDebts = finance.debts.some((d) => d.status !== "SETTLED");
  const hasFinancialData =
    finance.accounts.length > 0 ||
    finance.obligations.length > 0 ||
    finance.recurringRules.length > 0 ||
    finance.transactions.length > 0;

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
            {hasFinancialData
              ? "Previsão com base no seu fluxo de caixa e compromissos cadastrados"
              : "Cadastre suas contas e rendas para calibrar sua linha do tempo"}
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
            <HorizonStat
              label="Tempo para Quitar Dívidas"
              months={timeline.monthsToDebtFree}
              dateLabel={timeline.debtFreeDate ? formatCalendarDate(timeline.debtFreeDate) : null}
              tone="brand"
            />

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
              <span className="tabular text-xl font-bold">
                {hasFinancialData ? (
                  <span className="text-[color:var(--color-positive-700)]">Zeradas! 🎉</span>
                ) : (
                  <span className="text-[color:var(--page-fg)]">Sem dívidas</span>
                )}
              </span>
              <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                {hasFinancialData ? "Nenhum passivo pendente" : "Nenhum empréstimo cadastrado"}
              </p>
            </dd>
          </div>
        )}

        <HorizonStat
          label="Reserva de 3 Meses Pronta"
          months={timeline.monthsToEmergencyFund}
          dateLabel={
            timeline.emergencyFundDate ? formatCalendarDate(timeline.emergencyFundDate) : null
          }
        />

        <HorizonStat
          label="Estabilidade Consolidada"
          months={timeline.monthsToStability}
          dateLabel={timeline.stabilityDate ? formatCalendarDate(timeline.stabilityDate) : null}
          tone="positive"
        />
      </dl>

      <div className="mt-4">
        <PlanViabilityNotice feasibility={timeline.feasibility} />
      </div>

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
