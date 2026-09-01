"use client";

import Link from "next/link";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { Card, CardTitle } from "@/components/ui/primitives";
import {
  evaluateFinancialHealth,
  type HealthStatus,
} from "@/modules/ai-advisor/domain/financial-health";
import { useFinance } from "@/modules/household/ui/finance-provider";

export function HealthScoreCard() {
  const finance = useFinance();

  const report = evaluateFinancialHealth({
    asOf: finance.asOf,
    openingBalance: finance.totalCash,
    totalCash: finance.totalCash,
    protectedReserve: finance.protectedReserve,
    forecast: finance.forecast,
    debts: finance.debts,
    cards: finance.cards,
    cardStatements: finance.cardStatements,
    obligations: finance.obligations,
    recurringRules: finance.recurringRules,
    reserves: finance.reserves,
  });

  const badgeConfig = getStatusBadge(report.status);

  return (
    <Card className="relative overflow-hidden border-2 border-[color:var(--card-border)] bg-gradient-to-br from-[color:var(--card-bg)] to-[color:var(--color-surface-sunken)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <CardTitle hint="Diagnóstico automático e contínuo da sua saúde financeira">
              Diagnóstico Inteligente
            </CardTitle>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            Atualizado em {formatCalendarDate(finance.asOf)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badgeConfig.classes}`}
          >
            <span className="size-2 animate-pulse rounded-full bg-current" />
            {report.statusLabel}
          </span>
          <Link
            href="/app/diagnostico-ia"
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] px-3 text-xs font-semibold text-white shadow transition hover:bg-[color:var(--color-brand-700)]"
          >
            Consultor IA 🤖
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
        {/* Score Gauge */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4 text-center shadow-xs md:col-span-4">
          <p
            className="text-xs font-medium tracking-wider uppercase"
            style={{ color: "var(--muted-fg)" }}
          >
            Índice de Saúde
          </p>
          <div className="my-2 flex items-baseline justify-center gap-1">
            <span className={`tabular text-4xl font-extrabold ${badgeConfig.textClass}`}>
              {report.score}
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--muted-fg)" }}>
              / 100
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-ink-100)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${badgeConfig.bgClass}`}
              style={{ width: `${Math.max(5, report.score)}%` }}
            />
          </div>

          <p className="mt-2 text-xs font-medium text-balance" style={{ color: "var(--muted-fg)" }}>
            {report.summary}
          </p>
        </div>

        {/* Pillars preview */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-8">
          {report.pillars.map((pillar) => {
            const pillarBadge = getStatusBadge(pillar.status);
            return (
              <div
                key={pillar.id}
                className="flex flex-col justify-between rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[color:var(--page-fg)]">
                    {pillar.title}
                  </span>
                  <span className={`tabular text-xs font-bold ${pillarBadge.textClass}`}>
                    {pillar.score} pts
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {pillar.message}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function getStatusBadge(status: HealthStatus): {
  classes: string;
  bgClass: string;
  textClass: string;
} {
  switch (status) {
    case "EXCELLENT":
      return {
        classes:
          "bg-[color:var(--color-positive-100)] text-[color:var(--color-positive-700)] border border-[color:var(--color-positive-600)]/30",
        bgClass: "bg-[color:var(--color-positive-600)]",
        textClass: "text-[color:var(--color-positive-700)]",
      };
    case "HEALTHY":
      return {
        classes:
          "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)] border border-[color:var(--color-brand-600)]/30",
        bgClass: "bg-[color:var(--color-brand-600)]",
        textClass: "text-[color:var(--color-brand-700)]",
      };
    case "BALANCED":
      return {
        classes:
          "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200 border border-blue-300",
        bgClass: "bg-blue-600",
        textClass: "text-blue-700 dark:text-blue-300",
      };
    case "ATTENTION":
      return {
        classes:
          "bg-[color:var(--color-attention-100)] text-[color:var(--color-attention-700)] border border-[color:var(--color-attention-600)]/30",
        bgClass: "bg-[color:var(--color-attention-600)]",
        textClass: "text-[color:var(--color-attention-700)]",
      };
    case "CRITICAL":
      return {
        classes:
          "bg-[color:var(--color-critical-100)] text-[color:var(--color-critical-700)] border border-[color:var(--color-critical-600)]/30",
        bgClass: "bg-[color:var(--color-critical-600)]",
        textClass: "text-[color:var(--color-critical-700)]",
      };
  }
}
