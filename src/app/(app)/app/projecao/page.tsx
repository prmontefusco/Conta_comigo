"use client";

import { useMemo, useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { isNegative } from "@/core/money/money";
import { Card, CardTitle, Spinner, Stat } from "@/components/ui/primitives";
import { forecastWindows, type ForecastWindowDays } from "@/modules/forecast/domain/forecast";
import { MonthsTable } from "@/modules/forecast/ui/months-table";
import { SalarySimulatorCard } from "@/modules/forecast/ui/salary-simulator-card";
import { ScenarioSimulator } from "@/modules/forecast/ui/scenario-simulator";
import { useFinance } from "@/modules/household/ui/finance-provider";

const WINDOWS: readonly ForecastWindowDays[] = [7, 15, 30, 90, 180, 365];

const WINDOW_LABELS: Record<number, string> = {
  7: "7 dias",
  15: "15 dias",
  30: "30 dias",
  90: "3 meses",
  180: "6 meses",
  365: "12 meses",
};

/**
 * The projection screen.
 *
 * Several horizons are shown side by side because a household that looks fine
 * in seven days can be short in ninety, and the difference between those two
 * numbers is usually the whole story.
 */
export default function ForecastPage() {
  const finance = useFinance();
  const [window, setWindow] = useState<ForecastWindowDays>(90);

  const windows = useMemo(() => {
    const { horizon: _horizon, ...rest } = finance.forecastInput;
    return forecastWindows(rest, WINDOWS);
  }, [finance.forecastInput]);

  const selected = windows.find((item) => item.days === window) ?? windows[0];

  if (finance.loading) return <Spinner label="Calculando sua projeção" />;
  if (!selected) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Projeção</h1>

      <Card>
        <CardTitle hint="Escolha o horizonte para ver o que muda.">Horizonte</CardTitle>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {windows.map((item) => (
            <button
              key={item.days}
              onClick={() => setWindow(item.days)}
              aria-pressed={window === item.days}
              className={[
                "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                window === item.days
                  ? "bg-[color:var(--color-brand-600)] text-white"
                  : "border border-[color:var(--card-border)]",
              ].join(" ")}
            >
              {WINDOW_LABELS[item.days] ?? `${item.days} dias`}
            </button>
          ))}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Vai entrar" value={selected.summary.expectedInflows} tone="positive" />
          <Stat label="Vai sair" value={selected.summary.committedOutflows} tone="outflow" />
          <Stat
            label="Sendo dívida"
            value={selected.summary.debtCommitment}
            tone="outflow"
            hint="Faturas, empréstimos e financiamentos."
          />
          <Stat
            label="Saldo ao final"
            value={selected.summary.projectedCashBalance}
            tone={isNegative(selected.summary.projectedCashBalance) ? "critical" : "positive"}
          />
        </dl>

        <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-[color:var(--card-border)] pt-4 sm:grid-cols-3">
          <Stat
            label="Reserva protegida"
            value={selected.summary.protectedReserve}
            size="base"
            tone="outflow"
          />
          <Stat
            label="Saldo livre ao final"
            value={selected.summary.freeProjectedBalance}
            size="base"
            tone={isNegative(selected.summary.freeProjectedBalance) ? "critical" : "positive"}
            hint="Sem contar a reserva."
          />
          <Stat
            label="Menor saldo no período"
            value={selected.summary.lowestProjectedBalance}
            size="base"
            tone={isNegative(selected.summary.lowestProjectedBalance) ? "critical" : "neutral"}
            hint={`Em ${formatCalendarDate(selected.summary.lowestProjectedBalanceDate)}`}
          />
        </dl>

        {selected.summary.firstNegativeDate ? (
          <p
            role="note"
            className="mt-4 rounded-lg border-l-4 border-[color:var(--color-attention-600)] bg-[color:var(--color-attention-100)] p-3 text-sm text-[color:var(--color-ink-900)]"
          >
            Mantendo tudo como está, o saldo livre fica negativo em{" "}
            <strong>{formatCalendarDate(selected.summary.firstNegativeDate)}</strong>.
          </p>
        ) : null}
      </Card>

      <MonthsTable months={finance.forecast.months} limit={13} title="Mês a mês" />

      <SalarySimulatorCard />

      <ScenarioSimulator />

      <Card>
        <CardTitle>Como esta projeção é feita</CardTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm" style={{ color: "var(--muted-fg)" }}>
          <li>Parte do saldo atual das suas contas.</li>
          <li>
            Soma as receitas previstas e subtrai as contas, parcelas e faturas já registradas.
          </li>
          <li>Contas vencidas continuam no cálculo até serem pagas.</li>
          <li>Reservas protegidas não entram no saldo livre, mesmo estando no saldo total.</li>
          <li>
            Empréstimos e financiamentos entram como compromisso mensal, não como despesa de
            consumo.
          </li>
          <li>
            São projeções a partir do que está cadastrado, não previsões garantidas. Quanto mais
            completo o cadastro, mais próximas da realidade elas ficam.
          </li>
        </ul>
      </Card>
    </div>
  );
}
