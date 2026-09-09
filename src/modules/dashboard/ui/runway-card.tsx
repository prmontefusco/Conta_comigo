"use client";

import { useMemo } from "react";
import { Badge, Card, ProgressBar, Stat } from "@/components/ui/primitives";
import { firstWholeMonth } from "@/modules/forecast/domain/forecast";
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

  // Mês inteiro, não o pedaço que resta deste: o custo mensal é a base do
  // cálculo de fôlego, e um mês pela metade dobraria o fôlego aparente.
  const currentMonth = firstWholeMonth(finance.forecast.months);
  const custoMensal = currentMonth?.committedOutflows ?? money(0, currency);
  const liquidez =
    finance.protectedReserve.amount > 0 ? finance.protectedReserve : finance.totalCash;

  const runway = useMemo(() => {
    return calcularRunway({
      liquidezTotalDisponivel: liquidez,
      custoMensalEssencial: custoMensal,
    });
  }, [liquidez, custoMensal]);

  // Barra de progresso para a meta de 180 dias (6 meses de segurança plena)
  const percentualMeta180 = Math.min(100, Math.round((runway.diasAutonomia / 180) * 100));

  const hasData = liquidez.amount > 0 || custoMensal.amount > 0;

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
        <Badge tone={hasData ? TONE_POR_NIVEL[runway.nivel] : "neutral"}>
          {hasData ? runway.tituloNivel : "Aguardando Dados"}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs font-semibold">
          <span style={{ color: "var(--muted-fg)" }}>
            {hasData
              ? `Cobertura atual: ${runway.diasAutonomia} dias (${runway.mesesAutonomia} meses)`
              : "Cobertura atual: Não calculada"}
          </span>
          <span className="text-[color:var(--color-brand-600)]">
            Meta de 6 meses (180 dias): {hasData ? `${percentualMeta180}%` : "--"}
          </span>
        </div>
        <div className="mt-1.5">
          <ProgressBar
            ratio={hasData ? percentualMeta180 / 100 : 0}
            label="Meta de 6 meses de segurança"
            tone={hasData ? TONE_POR_NIVEL[runway.nivel] : undefined}
          />
        </div>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
        {hasData
          ? `${runway.descricao} ${runway.recomendacaoAcao}`
          : "Cadastre suas contas essenciais do mês e saldo em contas para calcular quantos dias de autonomia sua família possui em caso de imprevistos."}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Dias de Autonomia
          </dt>
          <dd className="mt-0.5 text-xl font-semibold text-[color:var(--page-fg)]">
            {hasData ? `${runway.diasAutonomia} dias` : "--"}
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
