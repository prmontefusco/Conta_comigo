"use client";

import { useMemo } from "react";
import { formatMoney } from "@/core/money/format";
import { Card, ProgressBar } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { calcularCamadasReserva } from "../domain/reserve-tiers";
import { money } from "@/core/money/money";

export function ReserveTiersCard() {
  const finance = useFinance();
  const currency = finance.totalCash.currency;

  const currentMonth = finance.forecast.months[0];
  const custoEssencial = currentMonth?.committedOutflows ?? money(0, currency);
  const totalReserva = finance.protectedReserve.amount > 0 ? finance.protectedReserve : finance.totalCash;

  const camadas = useMemo(() => {
    return calcularCamadasReserva(custoEssencial, totalReserva);
  }, [custoEssencial, totalReserva]);

  return (
    <Card className="border-l-4 border-l-[color:var(--color-brand-600)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-brand-600)] uppercase">
            Estratégia de Liquidez
          </span>
          <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
            Distribuição da Reserva em 3 Camadas
          </h3>
        </div>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
        Uma reserva inteligente não fica toda no mesmo lugar. Ela é dividida em três degraus de liquidez
        para balancear acesso imediato e rentabilidade protegida contra a inflação.
      </p>

      <div className="mt-5 space-y-4">
        {/* Camada 1 */}
        <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[color:var(--color-brand-600)] uppercase">
                Camada 1 • {camadas.camada1Imediata.liquidezDias}
              </span>
              <h4 className="font-semibold text-[color:var(--page-fg)]">
                {camadas.camada1Imediata.nome}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-[color:var(--page-fg)]">
                {formatMoney(camadas.camada1Imediata.valorAlocadoAtual)} / {formatMoney(camadas.camada1Imediata.metaValor)}
              </span>
              <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                {camadas.camada1Imediata.percentualConcluido}% concluído
              </p>
            </div>
          </div>
          <div className="mt-2">
            <ProgressBar
              ratio={camadas.camada1Imediata.percentualConcluido / 100}
              label={camadas.camada1Imediata.nome}
              tone="brand"
            />
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
            <strong>Onde alocar:</strong> {camadas.camada1Imediata.ondeGuardar}
          </p>
        </div>

        {/* Camada 2 */}
        <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[color:var(--color-positive-600)] uppercase">
                Camada 2 • {camadas.camada2CurtoPrazo.liquidezDias}
              </span>
              <h4 className="font-semibold text-[color:var(--page-fg)]">
                {camadas.camada2CurtoPrazo.nome}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-[color:var(--page-fg)]">
                {formatMoney(camadas.camada2CurtoPrazo.valorAlocadoAtual)} / {formatMoney(camadas.camada2CurtoPrazo.metaValor)}
              </span>
              <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                {camadas.camada2CurtoPrazo.percentualConcluido}% concluído
              </p>
            </div>
          </div>
          <div className="mt-2">
            <ProgressBar
              ratio={camadas.camada2CurtoPrazo.percentualConcluido / 100}
              label={camadas.camada2CurtoPrazo.nome}
              tone="positive"
            />
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
            <strong>Onde alocar:</strong> {camadas.camada2CurtoPrazo.ondeGuardar}
          </p>
        </div>

        {/* Camada 3 */}
        <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[color:var(--color-accent-600)] uppercase">
                Camada 3 • {camadas.camada3Oportunidades.liquidezDias}
              </span>
              <h4 className="font-semibold text-[color:var(--page-fg)]">
                {camadas.camada3Oportunidades.nome}
              </h4>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-[color:var(--page-fg)]">
                {formatMoney(camadas.camada3Oportunidades.valorAlocadoAtual)}
              </span>
              <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                Excedente de longevidade
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
            <strong>Onde alocar:</strong> {camadas.camada3Oportunidades.ondeGuardar}
          </p>
        </div>
      </div>
    </Card>
  );
}
