"use client";

import { useMemo } from "react";
import { Badge, Card, ProgressBar, Stat } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { calcularRunway, type NivelRunway } from "../domain/runway";
import { money } from "@/core/money/money";

const TONE_POR_NIVEL: Record<NivelRunway, "critical" | "attention" | "positive" | "brand"> = {
  CRITICO: "critical",
  VULNERAVEL: "attention",
  ESTAVEL: "positive",
  SEGURO: "positive",
  INDEPENDENTE: "brand",
};

export function RunwayCard() {
  const finance = useFinance();
  const currency = finance.totalCash.currency;

  const currentMonth = finance.forecast.months[0];
  const custoMensal = currentMonth?.committedOutflows ?? money(0, currency);
  const liquidez = finance.protectedReserve.amount > 0 ? finance.protectedReserve : finance.totalCash;

  const runway = useMemo(() => {
    return calcularRunway({
      liquidezTotalDisponivel: liquidez,
      custoMensalEssencial: custoMensal,
    });
  }, [liquidez, custoMensal]);

  // Barra de progresso para a meta de 180 dias (6 meses de segurança plena)
  const percentualMeta180 = Math.min(100, Math.round((runway.diasAutonomia / 180) * 100));

  return (
    <Card className="border-l-4 border-l-[color:var(--color-brand-600)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-brand-600)] uppercase">
            Autonomia & Longevidade Financeira
          </span>
          <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
            Índice de Runway (Dias de Liberdade sem Renda)
          </h3>
        </div>
        <Badge tone={TONE_POR_NIVEL[runway.nivel]}>
          {runway.tituloNivel}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs font-semibold">
          <span style={{ color: "var(--muted-fg)" }}>
            Cobertura atual: {runway.diasAutonomia} dias ({runway.mesesAutonomia} meses)
          </span>
          <span className="text-[color:var(--color-brand-600)]">
            Meta de 6 meses (180 dias): {percentualMeta180}%
          </span>
        </div>
        <div className="mt-1.5">
          <ProgressBar
            ratio={percentualMeta180 / 100}
            label="Meta de 6 meses de segurança"
            tone={TONE_POR_NIVEL[runway.nivel]}
          />
        </div>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
        {runway.descricao} {runway.recomendacaoAcao}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Dias de Autonomia
          </dt>
          <dd className="mt-0.5 text-xl font-semibold text-[color:var(--page-fg)]">
            {runway.diasAutonomia} dias
          </dd>
        </div>
        <Stat
          label="Custo Médio por Dia"
          value={runway.burnRateDiario}
          tone="outflow"
          hint="Despesas essenciais divididas por 30"
        />
        <Stat
          label="Caixa e Reservas Consideradas"
          value={runway.liquidezDisponivel}
          tone="neutral"
        />
      </dl>
    </Card>
  );
}
