"use client";

import { useMemo, useState } from "react";
import { AdSlot } from "@/components/ads/ad-slot";
import { Callout, Spinner } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { recentMonths } from "@/modules/reports/domain/reports";
import {
  BudgetSection,
  CashFlowSection,
  CategoriesSection,
  DebtSection,
  NatureSection,
  TrendSection,
} from "@/modules/reports/ui/sections";

/**
 * Reports.
 *
 * Each section is titled with the question it answers. A chart that does not
 * answer one does not belong here - the dashboard is not a wall of graphs
 * (docs/PRODUCT.md section 33, docs/REPORTS.md).
 *
 * The page itself is only composition and the shared period control; every
 * section reads what it needs from the finance provider.
 */
export default function ReportsPage() {
  const finance = useFinance();
  const { profile } = useSession();
  const [monthsBack, setMonthsBack] = useState(6);

  const months = useMemo(() => recentMonths(finance.asOf, monthsBack), [finance.asOf, monthsBack]);

  if (finance.loading) return <Spinner label="Montando seus relatórios" />;

  const hasHistory = finance.transactions.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Relatórios</h1>

        <label className="text-sm">
          <span className="sr-only">Período</span>
          <select
            value={monthsBack}
            onChange={(event) => setMonthsBack(Number(event.target.value))}
            className="min-h-11 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 text-sm"
          >
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </label>
      </div>

      {!hasHistory ? (
        <Callout tone="info" title="Ainda não há histórico">
          Os relatórios comparam meses entre si. Conforme você for registrando pagamentos e
          recebimentos, eles passam a mostrar padrões — e um mês isolado vira uma série.
        </Callout>
      ) : null}

      <CashFlowSection months={months} hasHistory={hasHistory} />

      <CategoriesSection months={months} />

      {/* Between two informational blocks, never next to an action. */}
      <AdSlot placement="dashboard-inline" hidden={profile?.plan === "PREMIUM"} />

      <TrendSection months={months} hasHistory={hasHistory} />

      <NatureSection />

      <BudgetSection months={months} />

      <DebtSection />
    </div>
  );
}
