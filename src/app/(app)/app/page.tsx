"use client";

import { Callout, Spinner } from "@/components/ui/primitives";
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
            Para que o diagnóstico de saúde financeira, a projeção de 12 meses e a linha do tempo
            comecem a fazer sentido, cadastre os dados básicos da sua casa:
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/app/contas-bancarias"
              className="flex flex-col justify-between rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 shadow-2xs transition hover:border-[color:var(--color-brand-600)] hover:shadow-xs"
            >
              <div>
                <span className="text-xl">🏦</span>
                <h3 className="mt-2 text-sm font-semibold text-[color:var(--page-fg)]">
                  1. Onde está seu dinheiro
                </h3>
                <p className="text-2xs mt-1" style={{ color: "var(--muted-fg)" }}>
                  Cadastre contas bancárias ou saldo em carteira.
                </p>
              </div>
              <span className="mt-3 text-xs font-bold text-[color:var(--color-brand-600)]">
                Cadastrar contas &rarr;
              </span>
            </a>

            <a
              href="/app/recorrentes"
              className="flex flex-col justify-between rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 shadow-2xs transition hover:border-[color:var(--color-brand-600)] hover:shadow-xs"
            >
              <div>
                <span className="text-xl">💰</span>
                <h3 className="mt-2 text-sm font-semibold text-[color:var(--page-fg)]">
                  2. Sua Renda Mensal
                </h3>
                <p className="text-2xs mt-1" style={{ color: "var(--muted-fg)" }}>
                  Salário, pró-labore ou renda extra que entra todo mês.
                </p>
              </div>
              <span className="mt-3 text-xs font-bold text-[color:var(--color-brand-600)]">
                Adicionar renda &rarr;
              </span>
            </a>

            <a
              href="/app/contas"
              className="flex flex-col justify-between rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 shadow-2xs transition hover:border-[color:var(--color-brand-600)] hover:shadow-xs"
            >
              <div>
                <span className="text-xl">📄</span>
                <h3 className="mt-2 text-sm font-semibold text-[color:var(--page-fg)]">
                  3. Contas do Mês
                </h3>
                <p className="text-2xs mt-1" style={{ color: "var(--muted-fg)" }}>
                  Aluguel, luz, água, condomínio e boletos essenciais.
                </p>
              </div>
              <span className="mt-3 text-xs font-bold text-[color:var(--color-brand-600)]">
                Cadastrar contas &rarr;
              </span>
            </a>

            <a
              href="/app/dividas"
              className="flex flex-col justify-between rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 shadow-2xs transition hover:border-[color:var(--color-brand-600)] hover:shadow-xs"
            >
              <div>
                <span className="text-xl">🏛️</span>
                <h3 className="mt-2 text-sm font-semibold text-[color:var(--page-fg)]">
                  4. Dívidas & Empréstimos
                </h3>
                <p className="text-2xs mt-1" style={{ color: "var(--muted-fg)" }}>
                  Se possuir parcelas de empréstimos, consignados ou cartões.
                </p>
              </div>
              <span className="mt-3 text-xs font-bold text-[color:var(--color-brand-600)]">
                Mapear passivos &rarr;
              </span>
            </a>
          </div>
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
