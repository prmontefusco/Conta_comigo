"use client";

import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { fromDecimalString } from "@/core/money/money";
import { Card, CardTitle, Stat } from "@/components/ui/primitives";
import type { PayoffStrategy } from "@/modules/recovery-timeline/domain/recovery-calculator";
import { useRecoveryTimeline } from "./use-recovery-timeline";

export function DebtStrategiesView() {
  const [selectedStrategy, setSelectedStrategy] = useState<PayoffStrategy>("AVALANCHE");
  const [extraAmountText, setExtraAmountText] = useState("100");

  const extraMoney = fromDecimalString(extraAmountText || "0");

  const baseline = useRecoveryTimeline();

  const accelerated = useRecoveryTimeline(extraMoney ?? undefined);

  // O plano em destaque é o **real**, sem aporte extra.
  //
  // Aqui estava a divergência que aparecia na tela: o campo de aporte nasce
  // preenchido com R$ 100, e o comparador mostrava o plano acelerado como se
  // fosse o plano. O topo da mesma página dizia "45 meses" e este bloco dizia
  // "43", sem nada explicando a diferença. O aporte agora só aparece no
  // simulador abaixo, que é onde ele foi digitado.
  const plan = selectedStrategy === "SNOWBALL" ? baseline.snowballPlan : baseline.avalanchePlan;

  // Both horizons can be absent: an extra R$ 100 does not rescue a plan whose
  // minimums already do not fit, and pretending otherwise is the exact false
  // comfort this screen is meant to replace.
  const monthsSaved =
    baseline.monthsToDebtFree !== null && accelerated.monthsToDebtFree !== null
      ? Math.max(0, baseline.monthsToDebtFree - accelerated.monthsToDebtFree)
      : null;

  return (
    <div className="space-y-6">
      {/* Comparador de Estratégias */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
          <CardTitle hint="Descubra a melhor metodologia para eliminar seus passivos">
            Comparador de Métodos de Quitação
          </CardTitle>

          <div className="flex rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-1">
            <button
              type="button"
              onClick={() => setSelectedStrategy("AVALANCHE")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                selectedStrategy === "AVALANCHE"
                  ? "bg-[color:var(--color-brand-600)] text-white shadow-xs"
                  : "text-[color:var(--page-fg)] hover:text-[color:var(--color-brand-600)]"
              }`}
            >
              Método Avalanche (Mais Econômico)
            </button>
            <button
              type="button"
              onClick={() => setSelectedStrategy("SNOWBALL")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                selectedStrategy === "SNOWBALL"
                  ? "bg-[color:var(--color-brand-600)] text-white shadow-xs"
                  : "text-[color:var(--page-fg)] hover:text-[color:var(--color-brand-600)]"
              }`}
            >
              Método Bola de Neve (Mais Motivador)
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-4">
          <h4 className="text-sm font-bold text-[color:var(--page-fg)]">{plan.strategyName}</h4>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            {plan.description}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[color:var(--card-border)] pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
                Tempo Estimado
              </dt>
              <dd className="tabular mt-1 text-lg font-bold text-[color:var(--color-brand-700)]">
                {plan.estimatedMonths} meses
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
                Data de Conclusão
              </dt>
              <dd className="mt-1 text-sm font-semibold">{formatCalendarDate(plan.targetDate)}</dd>
            </div>
            <Stat label="Total em Juros Estimados" value={plan.totalInterestPaid} tone="outflow" />
            <Stat
              label="Economia em Juros"
              value={plan.interestSavedVsMinimum}
              tone="positive"
              hint="Comparado a pagar só as parcelas mínimas"
            />
          </dl>

          {plan.estimatedRateItems > 0 ? (
            <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
              {plan.estimatedRateItems === 1
                ? "Um destes compromissos entra com taxa estimada"
                : `${plan.estimatedRateItems} destes compromissos entram com taxa estimada`}{" "}
              — calculada a partir da parcela, ou a média do rotativo para fatura vencida. Informe a
              taxa ou o CET do contrato em Dívidas para a ordem ficar exata.
            </p>
          ) : null}
        </div>

        {/* Ordem recomendada de pagamento */}
        {plan.orderOfPayoff.length > 0 ? (
          <div className="mt-5">
            <h4 className="mb-3 text-xs font-semibold tracking-wider text-[color:var(--muted-fg)] uppercase">
              Ordem Prioritária de Quitação Recomendada
            </h4>
            <div className="space-y-2">
              {plan.orderOfPayoff.map((item, idx) => (
                <div
                  key={item.debtId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-xs font-bold text-[color:var(--color-brand-700)]">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-[color:var(--page-fg)]">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[color:var(--color-positive-700)]">
                      Quitado no mês {item.payoffMonthIndex}
                    </span>
                    <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                      ({formatCalendarDate(item.estimatedPayoffDate)})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {/* Simulador de Aporte Extra Acelerador */}
      <Card className="border-2 border-[color:var(--color-positive-600)]/30 bg-gradient-to-br from-[color:var(--card-bg)] to-[color:var(--color-positive-100)]/20">
        <div className="flex items-center gap-2 border-b border-[color:var(--card-border)] pb-3">
          <span className="text-2xl">⚡</span>
          <CardTitle hint="Veja o impacto de economizar um valor extra por mês para abater dívidas">
            Simulador de Quitação Acelerada
          </CardTitle>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
          <div className="space-y-3 md:col-span-5">
            {/*
              O rótulo já estava na tela; faltava ligá-lo ao campo. Sem `htmlFor`
              ele é texto solto, e quem usa leitor de tela chega a um campo de
              número sem nome nenhum. Associar os dois resolve sem nenhum ARIA —
              o rótulo visível e o anunciado passam a ser o mesmo.
            */}
            <label
              htmlFor="aporte-extra-mensal"
              className="block text-xs font-semibold text-[color:var(--page-fg)]"
            >
              Aporte Extra Mensal (R$)
            </label>
            <div className="flex gap-2">
              {["50", "100", "200", "500"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setExtraAmountText(val)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    extraAmountText === val
                      ? "border-[color:var(--color-positive-600)] bg-[color:var(--color-positive-100)] text-[color:var(--color-positive-700)]"
                      : "border-[color:var(--card-border)] bg-[color:var(--card-bg)] hover:bg-[color:var(--color-surface-sunken)]"
                  }`}
                >
                  + R$ {val}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">R$</span>
              <input
                id="aporte-extra-mensal"
                type="number"
                min="0"
                step="10"
                value={extraAmountText}
                onChange={(e) => setExtraAmountText(e.target.value)}
                className="w-32 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-[color:var(--color-positive-600)] focus:outline-none"
              />
              <span className="text-xs text-[color:var(--muted-fg)]">/ mês a mais</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4 shadow-xs md:col-span-7">
            <div>
              <p className="text-xs font-medium text-[color:var(--muted-fg)]">Tempo Economizado</p>
              <p className="tabular mt-1 text-2xl font-extrabold text-[color:var(--color-positive-700)]">
                {monthsSaved === null
                  ? "—"
                  : monthsSaved > 0
                    ? `${monthsSaved} meses a menos`
                    : "Mesmo prazo"}
              </p>
              <p className="text-2xs mt-0.5 text-[color:var(--muted-fg)]">
                {accelerated.debtFreeDate
                  ? `Nova meta: ${formatCalendarDate(accelerated.debtFreeDate)}`
                  : "Um aporte extra não fecha um mês que já está no vermelho."}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-[color:var(--muted-fg)]">
                Novo Prazo de Quitação
              </p>
              <p className="tabular mt-1 text-2xl font-extrabold text-[color:var(--color-brand-700)]">
                {accelerated.monthsToDebtFree === null
                  ? "—"
                  : `${accelerated.monthsToDebtFree} meses`}
              </p>
              <p className="text-2xs mt-0.5 text-[color:var(--muted-fg)]">
                {baseline.monthsToDebtFree === null
                  ? "Sem prazo enquanto as parcelas mínimas não couberem"
                  : `Em vez de ${baseline.monthsToDebtFree} meses`}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
