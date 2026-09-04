"use client";

import { AdSlot } from "@/components/ads/ad-slot";
import { Callout, Spinner } from "@/components/ui/primitives";
import { DashboardTabs } from "@/modules/dashboard/ui/dashboard-tabs";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * The home screen.
 *
 * Organized into clear financial pillars:
 * - Visão Geral: Hero goal, Health Score, Today & 30-day forecast.
 * - Entradas: Income streams and received vs pending inflows.
 * - Despesas: Fixed bills, credit cards, variable spending.
 * - Reservas: Starter cushion and full emergency reserve.
 * - Dívidas: Liabilities and payoff strategy.
 */
export default function DashboardPage() {
  const finance = useFinance();
  const { isPremium } = useSession();

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
        <Callout tone="info" title="Ainda não há dados suficientes">
          Cadastre suas contas, sua renda e suas despesas recorrentes para que o diagnóstico com IA
          e a projeção comecem a fazer sentido. Dá para começar com o básico e completar depois.
        </Callout>
      ) : null}

      {/* Dashboard Segmentado em Pilares */}
      <DashboardTabs />

      {/* Anúncio discreto para contas gratuitas */}
      <AdSlot placement="dashboard-inline" hidden={isPremium} />
    </div>
  );
}
