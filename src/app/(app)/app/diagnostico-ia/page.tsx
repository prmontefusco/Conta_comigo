"use client";

import { Spinner } from "@/components/ui/primitives";
import { HealthScoreCard } from "@/modules/ai-advisor/ui/health-score-card";
import { AIAdvisorPanel } from "@/modules/ai-advisor/ui/ai-advisor-panel";
import { useFinance } from "@/modules/household/ui/finance-provider";

export default function DiagnosticoIAPage() {
  const finance = useFinance();

  if (finance.loading) {
    return <Spinner label="Analisando suas finanças com IA..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <span>✨</span> Diagnóstico & Consultor Financeiro IA
          </h1>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Inteligência artificial e diagnóstico contínuo para guiar você rumo à estabilidade e ao
            controle das contas.
          </p>
        </div>
      </div>

      <HealthScoreCard />

      <AIAdvisorPanel />
    </div>
  );
}
