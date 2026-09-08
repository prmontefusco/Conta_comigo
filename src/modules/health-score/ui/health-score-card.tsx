"use client";

import { useState } from "react";
import { Badge, Card, CardTitle } from "@/components/ui/primitives";
import type { FinancialHealthScore, PillarScore } from "../domain/health-score";

export interface HealthScoreCardProps {
  readonly score: FinancialHealthScore;
}

export function HealthScoreCard({ score }: HealthScoreCardProps) {
  const [showPillars, setShowPillars] = useState(false);

  const tierColor = {
    EXCELLENT: "text-[color:var(--color-positive-600)]",
    HEALTHY: "text-[color:var(--color-brand-600)]",
    ATTENTION: "text-[color:var(--color-attention-600)]",
    CRITICAL: "text-[color:var(--color-critical-600)]",
    CALIBRATING: "text-[color:var(--muted-fg)]",
  }[score.tier];

  const tierTone = {
    EXCELLENT: "positive",
    HEALTHY: "brand",
    ATTENTION: "attention",
    CRITICAL: "critical",
    CALIBRATING: "neutral",
  } as const;

  const unlockedCount = score.badges.filter((b) => b.unlocked).length;

  return (
    <Card className="overflow-hidden border-t-4 border-t-[color:var(--color-brand-600)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle hint="Baseado na regra dos 4 pilares: comprometimento, reserva, pontualidade e dívidas.">
          Saúde Financeira
        </CardTitle>
        <Badge tone={tierTone[score.tier]}>
          {score.tier === "CALIBRATING"
            ? score.tierLabel
            : `${score.tierLabel} • ${score.totalScore}/1000`}
        </Badge>
      </div>

      {/* Destaque da Pontuação Geral */}
      <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-[color:var(--color-ink-50)] dark:bg-[color:var(--color-ink-900)]/40 p-6 text-center">
        <div className="relative flex items-center justify-center">
          <span className={`text-5xl font-black tracking-tight ${tierColor}`}>
            {score.tier === "CALIBRATING" ? "--" : score.totalScore}
          </span>
          <span className="text-xs font-bold text-[color:var(--muted-fg)] ml-1 self-end mb-2">
            / 1000
          </span>
        </div>

        <p className="mt-2 text-sm font-medium">{score.tierDescription}</p>

        {/* Barra de progresso do score global */}
        <div className="mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-[color:var(--color-ink-200)]">
          <div
            className="h-full bg-[color:var(--color-brand-600)] transition-all duration-700"
            style={{
              width: `${score.tier === "CALIBRATING" ? 0 : Math.min(100, Math.round((score.totalScore / 1000) * 100))}%`,
            }}
          />
        </div>

        {/* Recomendação Prática para Avançar */}
        {score.topRecommendation ? (
          <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 py-2.5 text-xs text-[color:var(--color-brand-800)] dark:text-[color:var(--color-brand-200)] max-w-md">
            💡 <strong>Próximo passo:</strong> {score.topRecommendation}
          </div>
        ) : null}
      </div>

      {/* Botão para ver os 4 Pilares */}
      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--card-border)] pt-3">
        <button
          type="button"
          onClick={() => setShowPillars(!showPillars)}
          className="text-xs font-semibold text-[color:var(--color-brand-600)] hover:underline"
        >
          {showPillars ? "▲ Ocultar detalhes dos 4 pilares" : "▼ Ver detalhes dos 4 pilares"}
        </button>
        <span className="text-2xs text-[color:var(--muted-fg)]">
          {unlockedCount} de {score.badges.length} conquistas desbloqueadas
        </span>
      </div>

      {/* Detalhamento dos 4 Pilares */}
      {showPillars && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(score.pillars).map(([key, pillar]) => (
            <PillarItem key={key} pillar={pillar} />
          ))}
        </div>
      )}

      {/* Vitrine de Conquistas (Badges) */}
      <div className="mt-5 border-t border-[color:var(--card-border)] pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-fg)] mb-3">
          Conquistas Desbloqueáveis
        </h4>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {score.badges.map((badge) => (
            <div
              key={badge.id}
              className={`flex flex-col items-center rounded-xl p-3 text-center transition-all ${
                badge.unlocked
                  ? "border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)]/60 dark:border-[color:var(--color-brand-800)] dark:bg-[color:var(--color-brand-950)]/40 shadow-xs"
                  : "border border-[color:var(--card-border)] bg-[color:var(--card-bg)] opacity-40 grayscale"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                {badge.icon}
              </span>
              <p className="mt-1.5 text-xs font-semibold">{badge.title}</p>
              <p className="mt-1 text-[11px] leading-tight text-[color:var(--muted-fg)] line-clamp-2">
                {badge.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function PillarItem({ pillar }: { pillar: PillarScore }) {
  const percent = Math.min(100, Math.round((pillar.current / pillar.max) * 100));

  return (
    <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3 shadow-xs">
      <div className="flex items-center justify-between text-xs font-medium">
        <span>{pillar.label}</span>
        <span className="font-bold">
          {pillar.current} / {pillar.max} pts
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-ink-200)]">
        <div
          className="h-full bg-[color:var(--color-brand-600)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-2xs text-[color:var(--muted-fg)] leading-tight">
        {pillar.feedback}
      </p>
    </div>
  );
}
