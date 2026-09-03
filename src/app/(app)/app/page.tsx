"use client";

import { AdSlot } from "@/components/ads/ad-slot";
import { Callout, Spinner } from "@/components/ui/primitives";
import { HealthScoreCard } from "@/modules/ai-advisor/ui/health-score-card";
import { FutureTimelineCard } from "@/modules/recovery-timeline/ui/future-timeline-card";
import { AlertsList } from "@/modules/alerts/ui/alerts-list";
import { MonthBlock, Next30DaysBlock } from "@/modules/dashboard/ui/month-block";
import { TodayBlock } from "@/modules/dashboard/ui/today-block";
import { MonthsTable } from "@/modules/forecast/ui/months-table";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { EducationPillsCard } from "@/modules/education/ui/pills-card";
import { StarterReserveCard } from "@/modules/reserves/ui/starter-reserve-card";

/**
 * The home screen.
 *
 * Ordered by the questions people actually arrive with: what do I have now,
 * what is my financial health diagnosis, what does this month look like,
 * when will I get out of debt / reach stability, and what is coming next.
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

      {/* 1. Diagnóstico Inteligente & Score de Saúde */}
      <HealthScoreCard />

      {/* 2. Hoje: Saldos e Contas Vencendo */}
      <TodayBlock />

      {/* 3. Alertas prioritários */}
      <AlertsList alerts={finance.alerts} />

      {/* 4. O primeiro degrau: um colchão pequeno, antes da quitação */}
      <StarterReserveCard />

      {/* 5. Visão de Futuro e Linha do Tempo */}
      <FutureTimelineCard />

      {/* 6. Fechamento do Mês Atual */}
      <MonthBlock />

      {/* Between two informational blocks */}
      <AdSlot placement="dashboard-inline" hidden={isPremium} />

      {/* 7. Próximos 30 dias */}
      <Next30DaysBlock />

      {/* 8. Projeção Mês a Mês */}
      <MonthsTable months={finance.forecast.months} limit={12} />

      {/* 9. Uma explicação curta sobre o que está acontecendo agora */}
      <EducationPillsCard />
    </div>
  );
}
