"use client";

import { Spinner } from "@/components/ui/primitives";
import { AchievementsCard } from "@/modules/achievements/ui/achievements-card";
import { FutureTimelineCard } from "@/modules/recovery-timeline/ui/future-timeline-card";
import { DebtStrategiesView } from "@/modules/recovery-timeline/ui/debt-strategies-view";
import { SalarySimulatorCard } from "@/modules/forecast/ui/salary-simulator-card";
import { useFinance } from "@/modules/household/ui/finance-provider";

export default function VisaoFuturoPage() {
  const finance = useFinance();

  if (finance.loading) {
    return <Spinner label="Calculando sua linha do tempo e projeções..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <span>🚀</span> Visão de Futuro e Recuperação Financeira
          </h1>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Descubra em quanto tempo você vai se organizar, quitar dívidas e conquistar sua
            estabilidade financeira com base no histórico e metas.
          </p>
        </div>
      </div>

      <FutureTimelineCard />

      <SalarySimulatorCard />

      <AchievementsCard />

      <DebtStrategiesView />
    </div>
  );
}
