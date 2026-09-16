"use client";

import Link from "next/link";
import { Button, Callout, Spinner } from "@/components/ui/primitives";
import { DashboardTabs } from "@/modules/dashboard/ui/dashboard-tabs";
import { PlanStatusNotice } from "@/modules/billing/ui/plan-status-notice";
import { TodayPrioritiesCard } from "@/modules/dashboard/ui/today-priorities-card";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * The home screen.
 *
 * O primeiro bloco é "Atenção agora": o que está vencido, o mês que não fecha,
 * a fatura chegando. Vem antes de qualquer painel analítico de propósito —
 * quem abre o aplicativo com a luz para cortar não deveria ter de rolar um
 * gráfico de saúde financeira para descobrir isso.
 *
 * Depois dele, os pilares:
 * - Visão Geral: Hero goal, Health Score, Today & 30-day forecast.
 * - Entradas: Income streams and received vs pending inflows.
 * - Despesas: Fixed bills, credit cards, variable spending.
 * - Reservas: Starter cushion and full emergency reserve.
 * - Dívidas: Liabilities and payoff strategy.
 */
export default function DashboardPage() {
  const finance = useFinance();

  if (finance.loading) {
    return <Spinner label="Carregando suas finanças" />;
  }

  const hasData =
    finance.accounts.length > 0 ||
    finance.recurringRules.length > 0 ||
    finance.obligations.length > 0;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Resumo das suas finanças</h1>

      {finance.error ? <Callout tone="attention">{finance.error}</Callout> : null}

      {!hasData ? (
        <div className="rounded-2xl border-2 border-dashed border-[color:var(--color-brand-600)]/40 bg-[color:var(--color-brand-50)]/30 p-5 shadow-xs dark:bg-[color:var(--color-brand-950)]/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold tracking-wider text-[color:var(--color-brand-600)] uppercase">
                Primeiros Passos
              </span>
              <h2 className="text-base font-bold text-[color:var(--page-fg)]">
                Vamos calibrar o Conta Comigo para a sua realidade
              </h2>
            </div>
            <span className="text-xs font-medium text-[color:var(--muted-fg)]">
              Leva menos de 3 minutos
            </span>
          </div>
          <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
            Para que o diagnóstico de saúde financeira, a projeção de até 24 meses e a linha do
            tempo comecem a fazer sentido, cadastre os dados básicos da sua casa:
          </p>

          <Link href="/app/comecar" className="mt-4 inline-block">
            <Button>Continuar configuração guiada</Button>
          </Link>
        </div>
      ) : null}

      {/* O que precisa de atenção hoje, antes de qualquer bloco analítico. */}
      {hasData ? <TodayPrioritiesCard /> : null}

      {/*
        Depois das prioridades, nunca antes: conta vencida vem primeiro que
        assinatura. E só aparece quando há ação real — ver plan-notice.ts.
      */}
      <PlanStatusNotice />

      {/* Dashboard Segmentado em Pilares */}
      <DashboardTabs />

      {/* Anúncio discreto para contas gratuitas */}
    </div>
  );
}
