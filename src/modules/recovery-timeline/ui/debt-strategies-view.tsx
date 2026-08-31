"use client";

import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { fromDecimalString } from "@/core/money/money";
import { Card, CardTitle, Stat } from "@/components/ui/primitives";
import {
  calculateRecoveryTimeline,
  type PayoffStrategy,
} from "@/modules/recovery-timeline/domain/recovery-calculator";
import { useFinance } from "@/modules/household/ui/finance-provider";

export function DebtStrategiesView() {
  const finance = useFinance();
  const [selectedStrategy, setSelectedStrategy] = useState<PayoffStrategy>("AVALANCHE");
  const [extraAmountText, setExtraAmountText] = useState("100");

  const extraMoney = fromDecimalString(extraAmountText || "0");

  const baseline = calculateRecoveryTimeline({
    asOf: finance.asOf,
    openingBalance: finance.totalCash,
    totalCash: finance.totalCash,
    protectedReserve: finance.protectedReserve,
    forecast: finance.forecast,
    debts: finance.debts,
    cardStatements: finance.cardStatements,
    reserves: finance.reserves,
  });

  const accelerated = calculateRecoveryTimeline({
    asOf: finance.asOf,
    openingBalance: finance.totalCash,
    totalCash: finance.totalCash,
    protectedReserve: finance.protectedReserve,
    forecast: finance.forecast,
    debts: finance.debts,
    cardStatements: finance.cardStatements,
    reserves: finance.reserves,
    extraMonthlyContribution: extraMoney ?? undefined,
  });

  const plan =
    selectedStrategy === "SNOWBALL" ? accelerated.snowballPlan : accelerated.avalanchePlan;

  const monthsSaved = Math.max(0, baseline.monthsToDebtFree - accelerated.monthsToDebtFree);

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

        <div className="mt-4 rounded-xl bg-[color:var(--color-surface-sunken)] p-4 border border-[color:var(--card-border)]">
          <h4 className="text-sm font-bold text-[color:var(--page-fg)]">{plan.strategyName}</h4>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            {plan.description}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-[color:var(--card-border)] pt-4">
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
              <dd className="mt-1 text-sm font-semibold">
                {formatCalendarDate(plan.targetDate)}
              </dd>
            </div>
            <Stat label="Total em Juros Estimados" value={plan.totalInterestPaid} tone="outflow" />
            <Stat
              label="Economia em Juros"
              value={plan.interestSavedVsMinimum}
              tone="positive"
              hint="Vs pagar só o mínimo"
            />
          </dl>
        </div>

        {/* Ordem recomendada de pagamento */}
        {plan.orderOfPayoff.length > 0 ? (
          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-fg)] mb-3">
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
          <div className="md:col-span-5 space-y-3">
            <label className="block text-xs font-semibold text-[color:var(--page-fg)]">
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
                type="number"
                min="0"
                step="10"
                value={extraAmountText}
                onChange={(e) => setExtraAmountText(e.target.value)}
                className="w-32 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[color:var(--color-positive-600)]"
              />
              <span className="text-xs text-[color:var(--muted-fg)]">/ mês a mais</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4 md:col-span-7 shadow-xs">
            <div>
              <p className="text-xs font-medium text-[color:var(--muted-fg)]">
                Tempo Economizado
              </p>
              <p className="tabular mt-1 text-2xl font-extrabold text-[color:var(--color-positive-700)]">
                {monthsSaved > 0 ? `${monthsSaved} meses a menos` : "Mesmo prazo"}
              </p>
              <p className="mt-0.5 text-2xs text-[color:var(--muted-fg)]">
                Nova meta: {formatCalendarDate(accelerated.debtFreeDate)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-[color:var(--muted-fg)]">
                Novo Prazo de Quitação
              </p>
              <p className="tabular mt-1 text-2xl font-extrabold text-[color:var(--color-brand-700)]">
                {accelerated.monthsToDebtFree} meses
              </p>
              <p className="mt-0.5 text-2xs text-[color:var(--muted-fg)]">
                Em vez de {baseline.monthsToDebtFree} meses
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
