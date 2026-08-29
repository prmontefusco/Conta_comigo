"use client";

import { AdSlot } from "@/components/ads/ad-slot";
import { Callout, Spinner } from "@/components/ui/primitives";
import { AlertsList } from "@/modules/alerts/ui/alerts-list";
import { MonthBlock, Next30DaysBlock } from "@/modules/dashboard/ui/month-block";
import { TodayBlock } from "@/modules/dashboard/ui/today-block";
import { MonthsTable } from "@/modules/forecast/ui/months-table";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * The home screen.
 *
 * Ordered by the questions people actually arrive with: what do I have now,
 * what does this month look like, what is coming, and which months will not
 * close. Charts appear only where they answer one of those (docs/PRODUCT.md
 * sections 11 and 33).
 */
export default function DashboardPage() {
  const finance = useFinance();
  const { profile } = useSession();

  if (finance.loading) {
    return <Spinner label="Carregando suas finanças" />;
  }

  const hasData =
    finance.accounts.length > 0 ||
    finance.recurringRules.length > 0 ||
    finance.obligations.length > 0;

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Resumo das suas finanças</h1>

      {finance.error ? <Callout tone="attention">{finance.error}</Callout> : null}

      {!hasData ? (
        <Callout tone="info" title="Ainda não há dados suficientes">
          Cadastre suas contas, sua renda e suas despesas recorrentes para que a projeção comece a
          fazer sentido. Dá para começar com o básico e completar depois.
        </Callout>
      ) : null}

      <TodayBlock />

      <AlertsList alerts={finance.alerts} />

      <MonthBlock />

      {/* Between two informational blocks, never inside a form or next to an
          action. See docs/ADSENSE.md for the placement rules. */}
      <AdSlot placement="dashboard-inline" hidden={profile?.plan === "PREMIUM"} />

      <Next30DaysBlock />

      <MonthsTable months={finance.forecast.months} limit={12} />
    </div>
  );
}
