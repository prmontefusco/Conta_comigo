"use client";

import Link from "next/link";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { calculateRecoveryTimeline } from "../domain/recovery-calculator";
import { useFinance } from "@/modules/household/ui/finance-provider";

export function CurrentGoalHeroCard() {
  const finance = useFinance();

  if (finance.loading) return null;

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

  // Identifica a próxima milestone não concluída
  const nextMilestone =
    timeline.milestones.find((m) => !m.isCompleted) ?? timeline.milestones[0];

  const hasDebts = timeline.totalDebtAmount.amount > 0;
  const isStarterFunded = timeline.starterReserve.isComplete;

  return (
    <Card className="relative overflow-hidden border-2 border-[color:var(--color-brand-500)] bg-gradient-to-br from-[color:var(--color-surface-sunken)] to-[color:var(--card-bg)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] text-base text-white shadow-xs">
            🎯
          </span>
          <div>
            <span className="text-xs font-semibold tracking-wider text-[color:var(--color-brand-600)] uppercase">
              Linha d&apos;água · Meta Atual da Família
            </span>
            <h2 className="text-lg font-bold text-[color:var(--page-fg)]">
              {nextMilestone?.title ?? "Construir Estabilidade"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={isStarterFunded ? "positive" : "attention"}>
            {!isStarterFunded
              ? "Passo 1: Reserva de Respiro"
              : hasDebts
                ? "Passo 2: Quitar Dívidas"
                : "Passo 3: Reserva Plena"}
          </Badge>
          <Link href="/app/visao-futuro">
            <Button variant="secondary" className="text-xs">
              Ver Linha do Tempo &rarr;
            </Button>
          </Link>
        </div>
      </div>

      <p className="mt-3 text-sm text-[color:var(--page-fg)]">
        {nextMilestone?.description}
      </p>

      {/* Barra de Progresso com Métricas */}
      <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4">
        <div className="flex items-center justify-between text-xs font-medium">
          <span style={{ color: "var(--muted-fg)" }}>Progresso desta meta</span>
          <span className="tabular font-bold text-[color:var(--color-brand-600)]">
            {nextMilestone ? Math.round(nextMilestone.progressPercentage) : 0}% concluído
          </span>
        </div>

        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
          <div
            className="h-full rounded-full bg-[color:var(--color-brand-600)] transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, nextMilestone?.progressPercentage ?? 0))}%`,
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          {!isStarterFunded ? (
            <>
              <span style={{ color: "var(--muted-fg)" }}>
                Guardado:{" "}
                <strong className="text-[color:var(--page-fg)]">
                  {formatMoney(timeline.starterReserve.current)}
                </strong>{" "}
                de {formatMoney(timeline.starterReserve.target)}
              </span>
              <span className="text-[color:var(--color-brand-700)] font-semibold">
                Faltam {formatMoney(timeline.starterReserve.missing)} para ter seu primeiro colchão!
              </span>
            </>
          ) : hasDebts ? (
            <>
              <span style={{ color: "var(--muted-fg)" }}>
                Dívidas a eliminar:{" "}
                <strong className="text-[color:var(--color-critical-fg)]">
                  {formatMoney(timeline.totalDebtAmount)}
                </strong>
              </span>
              <span className="text-[color:var(--color-brand-700)] font-semibold">
                Previsão de liberdade financeira: {formatCalendarDate(timeline.debtFreeDate)} (em{" "}
                {timeline.monthsToDebtFree} meses)
              </span>
            </>
          ) : (
            <>
              <span style={{ color: "var(--muted-fg)" }}>
                Reserva acumulada para tranquilidade da família.
              </span>
              <span className="text-[color:var(--color-positive-fg)] font-semibold">
                Previsão da reserva plena: {formatCalendarDate(timeline.emergencyFundDate)}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
