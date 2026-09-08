"use client";

import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { fromDecimalString, zero } from "@/core/money/money";
import { Card, Stat } from "@/components/ui/primitives";
import { MoneyField } from "@/components/ui/form";
import type { PayoffStrategy } from "@/modules/recovery-timeline/domain/recovery-calculator";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useRecoveryTimeline } from "./use-recovery-timeline";

export function PayoffStrategyComparator() {
  const finance = useFinance();
  const [selectedStrategy, setSelectedStrategy] = useState<PayoffStrategy>("AVALANCHE");
  const [extraPaymentText, setExtraPaymentText] = useState("0");

  const currency = finance.totalCash.currency;
  const extraPayment = fromDecimalString(extraPaymentText) ?? zero(currency);

  const timeline = useRecoveryTimeline(extraPayment.amount > 0 ? extraPayment : undefined);

  const activeDebts = finance.debts.filter((d) => d.status !== "SETTLED");
  if (activeDebts.length === 0) {
    return null;
  }

  const activePlan = selectedStrategy === "AVALANCHE" ? timeline.avalanchePlan : timeline.snowballPlan;

  return (
    <Card className="border-l-4 border-l-[color:var(--color-brand-600)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-brand-600)] uppercase">
            Simulador de Quitação Acelerada
          </span>
          <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
            Comparador: Bola de Neve vs. Avalanche
          </h3>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-1">
          <button
            type="button"
            onClick={() => setSelectedStrategy("AVALANCHE")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectedStrategy === "AVALANCHE"
                ? "bg-[color:var(--color-brand-600)] text-white shadow-2xs"
                : "text-[color:var(--page-fg)] hover:bg-[color:var(--card-bg)]"
            }`}
          >
            🏔️ Avalanche (Matemático)
          </button>
          <button
            type="button"
            onClick={() => setSelectedStrategy("SNOWBALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectedStrategy === "SNOWBALL"
                ? "bg-[color:var(--color-brand-600)] text-white shadow-2xs"
                : "text-[color:var(--page-fg)] hover:bg-[color:var(--card-bg)]"
            }`}
          >
            ⛄ Bola de Neve (Psicológico)
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
        {selectedStrategy === "AVALANCHE"
          ? "O método Avalanche ataca prioritariamente as dívidas com maiores taxas de juros mensais. É a estratégia que economiza a maior quantidade possível de dinheiro em juros."
          : "O método Bola de Neve elimina primeiro as menores dívidas, proporcionando vitórias rápidas e alívio mental imediato para liberar fluxo de caixa para as seguintes."}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3">
        <div className="flex-1 min-w-[200px]">
          <MoneyField
            label="Aporte extra mensal que você pode fazer"
            value={extraPaymentText}
            onChange={(e) => setExtraPaymentText(e.target.value)}
            hint="Ex: R$ 100, R$ 200 de renda extra ou corte de despesas supérfluas."
          />
        </div>
        <div className="flex gap-2">
          {["50", "100", "200", "500"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setExtraPaymentText(v)}
              className="rounded-lg border border-[color:var(--card-border)] px-2.5 py-1 text-xs font-medium hover:bg-[color:var(--color-surface-sunken)]"
            >
              + R$ {v}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Meses até Quitação
          </dt>
          <dd className="mt-0.5 text-xl font-semibold text-[color:var(--tone-positive)]">
            {activePlan.estimatedMonths} meses
          </dd>
        </div>
        <div>
          <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Data Prevista
          </dt>
          <dd className="mt-0.5 text-xl font-semibold text-[color:var(--page-fg)]">
            {formatCalendarDate(activePlan.targetDate)}
          </dd>
        </div>
        <Stat
          label="Total em Juros"
          value={activePlan.totalInterestPaid}
          tone="outflow"
        />
        <Stat
          label="Economia em Juros"
          value={activePlan.interestSavedVsMinimum}
          tone="positive"
          hint="Comparado a pagar apenas o mínimo"
        />
      </dl>

      <div className="mt-5">
        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>
          Ordem de Ataque Recomendada ({selectedStrategy === "AVALANCHE" ? "Maior Taxa" : "Menor Saldo"}):
        </h4>
        <ol className="mt-2 space-y-2">
          {activePlan.orderOfPayoff.map((step, idx: number) => (
            <li
              key={step.debtId}
              className="flex items-center justify-between rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-xs font-bold text-[color:var(--color-brand-700)]">
                  {idx + 1}
                </span>
                <span className="font-medium text-[color:var(--page-fg)]">{step.name}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-[color:var(--color-positive-600)]">
                  Quitação em {formatCalendarDate(step.estimatedPayoffDate)}
                </span>
                <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                  Mês {step.payoffMonthIndex}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
