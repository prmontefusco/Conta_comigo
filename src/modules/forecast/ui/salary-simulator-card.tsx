"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addMonths, calendarDate, formatMonthKey } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import {
  fromDecimalString,
  isNegative,
  isPositive,
  money,
  subtract,
  zero,
} from "@/core/money/money";
import { Button, Card, CardTitle } from "@/components/ui/primitives";
import { DateField, MoneyField, TextField } from "@/components/ui/form";
import { useFinance } from "@/modules/household/ui/finance-provider";
import {
  analyzeBreakEvenIncome,
  buildSalaryVariationChange,
  buildThirteenthSalaryChanges,
  buildVacationBonusChange,
} from "../domain/salary-simulator";
import { simulate, type ScenarioChange } from "../domain/scenario";

type SimulationMode = "VARIATION" | "THIRTEENTH" | "VACATION" | "EXTRA";

export function SalarySimulatorCard() {
  const finance = useFinance();
  const [mode, setMode] = useState<SimulationMode>("VARIATION");

  // Campos para Variação Salarial (Aumento ou Redução)
  const [salaryDeltaText, setSalaryDeltaText] = useState("500,00");
  const [isIncrease, setIsIncrease] = useState(true);
  const [salaryStartDate, setSalaryStartDate] = useState(
    addMonths(finance.asOf, 1).slice(0, 8) + "05",
  );

  // Campos para 13º Salário
  const [thirteenthSalaryText, setThirteenthSalaryText] = useState("");

  // Campos para Férias
  const [vacationSalaryText, setVacationSalaryText] = useState("");
  const [vacationDate, setVacationDate] = useState(addMonths(finance.asOf, 3).slice(0, 8) + "15");

  // Campos para Renda Extra Pontual
  const [extraAmountText, setExtraAmountText] = useState("1000,00");
  const [extraDesc, setExtraDesc] = useState("Freela / Renda Extra");
  const [extraDate, setExtraDate] = useState(addMonths(finance.asOf, 1).slice(0, 8) + "10");

  // Estado do resultado da simulação
  const [simulatedResult, setSimulatedResult] = useState<ReturnType<typeof simulate> | null>(null);

  // Análise de Ponto de Equilíbrio
  const breakEven = useMemo(() => {
    return analyzeBreakEvenIncome(finance.forecastInput);
  }, [finance.forecastInput]);

  // Se o usuário não preencheu o salário base do 13º, usamos a renda atual cadastrada
  const defaultMonthlyBase = useMemo(() => {
    return breakEven.currentMonthlyIncome.amount > 0
      ? breakEven.currentMonthlyIncome
      : money(350000); // R$ 3.500 fallback ilustrativo
  }, [breakEven.currentMonthlyIncome]);

  function handleSimulate() {
    let changes: ScenarioChange[] = [];

    try {
      if (mode === "VARIATION") {
        const parsed = fromDecimalString(salaryDeltaText);
        if (!parsed || parsed.amount <= 0) return;
        const signedAmount = isIncrease ? parsed.amount : -parsed.amount;
        changes = [
          buildSalaryVariationChange(
            money(signedAmount, parsed.currency),
            calendarDate(salaryStartDate),
            5,
            isIncrease
              ? `Aumento Salarial (+${formatMoney(parsed)})`
              : `Redução Salarial (-${formatMoney(parsed)})`,
          ),
        ];
      } else if (mode === "THIRTEENTH") {
        const parsed = thirteenthSalaryText
          ? fromDecimalString(thirteenthSalaryText)
          : defaultMonthlyBase;
        if (!parsed || parsed.amount <= 0) return;
        const currentYear = Number(finance.asOf.slice(0, 4));
        changes = [
          ...buildThirteenthSalaryChanges({
            monthlySalary: parsed,
            referenceYear: currentYear,
          }),
        ];
      } else if (mode === "VACATION") {
        const parsed = vacationSalaryText
          ? fromDecimalString(vacationSalaryText)
          : defaultMonthlyBase;
        if (!parsed || parsed.amount <= 0) return;
        changes = [buildVacationBonusChange(parsed, calendarDate(vacationDate))];
      } else if (mode === "EXTRA") {
        const parsed = fromDecimalString(extraAmountText);
        if (!parsed || parsed.amount <= 0) return;
        changes = [
          {
            kind: "EXTRA_INCOME",
            description: extraDesc.trim() || "Renda Extra",
            amount: parsed,
            date: calendarDate(extraDate),
          },
        ];
      }

      const res = simulate(finance.forecastInput, changes);
      setSimulatedResult(res);
    } catch {
      // Ignora datas inválidas durante digitação
    }
  }

  function handleReset() {
    setSimulatedResult(null);
  }

  // Comparações de impacto
  const impactSummary = useMemo(() => {
    if (!simulatedResult) return null;

    const baseLowest = simulatedResult.baseline.days.reduce(
      (min, d) => (d.freeProjectedBalance.amount < min.amount ? d.freeProjectedBalance : min),
      simulatedResult.baseline.days[0]?.freeProjectedBalance ?? zero(),
    );

    const simLowest = simulatedResult.lowestFreeBalance;

    const baseDeficits = simulatedResult.baseline.months.filter(
      (m) => m.isDeficit && !m.isPartial,
    ).length;
    const simDeficits = simulatedResult.scenario.months.filter(
      (m) => m.isDeficit && !m.isPartial,
    ).length;
    const solvedDeficits = Math.max(0, baseDeficits - simDeficits);

    const lastBaseMonth =
      simulatedResult.baseline.months[simulatedResult.baseline.months.length - 1];
    const lastSimMonth =
      simulatedResult.scenario.months[simulatedResult.scenario.months.length - 1];

    const finalDifference =
      lastBaseMonth && lastSimMonth
        ? subtract(lastSimMonth.freeEndingBalance, lastBaseMonth.freeEndingBalance)
        : zero();

    return {
      baseLowest,
      simLowest,
      lowestImproved: simLowest.amount > baseLowest.amount,
      solvedDeficits,
      baseDeficits,
      simDeficits,
      finalDifference,
    };
  }, [simulatedResult]);

  return (
    <Card className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-teal-50 text-lg text-teal-700 shadow-2xs">
              💼
            </span>
            <div>
              <CardTitle hint="Projete o impacto de aumentos, 13º salário, férias ou novas rendas nos próximos meses.">
                Simulador de Salários & Proventos Futuros
              </CardTitle>
            </div>
          </div>

          <Link
            href="/app/recorrentes"
            className="text-xs font-medium text-[color:var(--color-brand-600)] hover:underline"
          >
            Gerenciar receitas fixas →
          </Link>
        </div>
      </div>

      {/* Painel de Ponto de Equilíbrio */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-2xs backdrop-blur-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Renda Familiar Cadastrada
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {formatMoney(breakEven.currentMonthlyIncome)}
              </span>
              <span className="text-xs text-slate-500">/ mês</span>
            </div>
          </div>

          <div className="h-px bg-slate-200 sm:h-10 sm:w-px" />

          <div>
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Ponto de Equilíbrio (Pico de Gastos)
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {formatMoney(breakEven.breakEvenMonthlyIncome)}
              </span>
              <span className="text-xs text-slate-500">/ mês</span>
            </div>
          </div>

          <div className="h-px bg-slate-200 sm:h-10 sm:w-px" />

          <div>
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Margem Mensal
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold tracking-tight ${
                  breakEven.isComfortable ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {breakEven.isComfortable ? "+" : ""}
                {formatMoney(breakEven.monthlyGap)}
              </span>
              <span className="text-xs text-slate-500">/ mês</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-600">
          {breakEven.isComfortable ? (
            <p>
              ✅ <strong>Orçamento Equilibrado:</strong> Sua renda mensal cadastrada cobre o mês de
              maior custo previsto no horizonte com uma folga média de{" "}
              <strong>{formatMoney(breakEven.monthlyGap)}</strong>.
            </p>
          ) : (
            <p>
              ⚠️ <strong>Atenção ao Ponto de Equilíbrio:</strong> Em pelo menos um dos próximos
              meses, as contas e parcelamentos alcançam{" "}
              <strong>{formatMoney(breakEven.breakEvenMonthlyIncome)}</strong>. Para não fechar no
              negativo, a família precisa de aproximadamente{" "}
              <strong>{formatMoney(money(Math.abs(breakEven.monthlyGap.amount)))}</strong> a mais
              por mês ou renegociar prazos.
            </p>
          )}
        </div>
      </div>

      {/* Seletor de Modo de Simulação */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold tracking-wider text-slate-600 uppercase">
            Escolha o que deseja simular:
          </label>
          {simulatedResult && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 underline hover:text-slate-800"
            >
              Limpar simulação
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setMode("VARIATION");
              setSimulatedResult(null);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
              mode === "VARIATION"
                ? "border-teal-600 bg-teal-50/80 font-semibold text-teal-900 shadow-xs"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="text-lg">📈</span>
            <span className="mt-1 text-xs">Novo Salário / Aumento</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("THIRTEENTH");
              setSimulatedResult(null);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
              mode === "THIRTEENTH"
                ? "border-teal-600 bg-teal-50/80 font-semibold text-teal-900 shadow-xs"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="text-lg">🎁</span>
            <span className="mt-1 text-xs">13º Salário (Nov/Dez)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("VACATION");
              setSimulatedResult(null);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
              mode === "VACATION"
                ? "border-teal-600 bg-teal-50/80 font-semibold text-teal-900 shadow-xs"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="text-lg">🏖️</span>
            <span className="mt-1 text-xs">Férias (+1/3)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("EXTRA");
              setSimulatedResult(null);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
              mode === "EXTRA"
                ? "border-teal-600 bg-teal-50/80 font-semibold text-teal-900 shadow-xs"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="text-lg">⚡</span>
            <span className="mt-1 text-xs">Renda Extra / Bônus</span>
          </button>
        </div>
      </div>

      {/* Formulário do Modo Selecionado */}
      <div className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4 sm:p-5">
        {mode === "VARIATION" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsIncrease(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isIncrease
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                + Aumento Salarial
              </button>
              <button
                type="button"
                onClick={() => setIsIncrease(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  !isIncrease
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                - Redução Salarial
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyField
                label={isIncrease ? "Valor do aumento mensal" : "Valor da redução mensal"}
                value={salaryDeltaText}
                onChange={(e) => setSalaryDeltaText(e.target.value)}
                hint="Ex: 500,00 a mais por mês"
                required
              />

              <DateField
                label="A partir de qual mês?"
                value={salaryStartDate}
                onChange={(e) => setSalaryStartDate(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {mode === "THIRTEENTH" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              O sistema simulará automaticamente a <strong>1ª parcela em 30 de Novembro</strong>{" "}
              (50%) e a <strong>2ª parcela em 20 de Dezembro</strong> (50%) com base no salário
              informado:
            </p>
            <div className="max-w-md">
              <MoneyField
                label="Salário Base para o 13º"
                placeholder={formatMoney(defaultMonthlyBase)}
                value={thirteenthSalaryText}
                onChange={(e) => setThirteenthSalaryText(e.target.value)}
                hint={`Padrão: ${formatMoney(defaultMonthlyBase)} (renda mensal atual)`}
              />
            </div>
          </div>
        )}

        {mode === "VACATION" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Simula o recebimento de <strong>1 salário + 1/3 de férias</strong> na data escolhida:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyField
                label="Salário Base de Férias"
                placeholder={formatMoney(defaultMonthlyBase)}
                value={vacationSalaryText}
                onChange={(e) => setVacationSalaryText(e.target.value)}
                hint={`Padrão: ${formatMoney(defaultMonthlyBase)}`}
              />
              <DateField
                label="Data prevista de pagamento"
                value={vacationDate}
                onChange={(e) => setVacationDate(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        {mode === "EXTRA" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField
                label="Descrição"
                value={extraDesc}
                onChange={(e) => setExtraDesc(e.target.value)}
                placeholder="Ex: Restituição IR, Venda, Bônus"
                required
              />
              <MoneyField
                label="Valor da entrada"
                value={extraAmountText}
                onChange={(e) => setExtraAmountText(e.target.value)}
                required
              />
              <DateField
                label="Data prevista"
                value={extraDate}
                onChange={(e) => setExtraDate(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleSimulate}>🚀 Calcular impacto nos próximos meses</Button>
        </div>
      </div>

      {/* Resultados e Comparativo */}
      {simulatedResult && impactSummary && (
        <div className="animate-in fade-in space-y-5 rounded-2xl border border-teal-200/80 bg-teal-50/40 p-4 shadow-sm duration-200 sm:p-5">
          <div className="flex items-center justify-between border-b border-teal-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📊</span>
              <h3 className="text-sm font-semibold text-teal-950">
                Resultado da Simulação no Horizonte
              </h3>
            </div>
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
              Projeção 12 Meses
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-2xs">
              <span className="text-xs text-slate-500">Pior Saldo Livre Previsto</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-slate-900">
                  {formatMoney(impactSummary.simLowest)}
                </span>
                <span className="text-xs text-slate-400">
                  (era {formatMoney(impactSummary.baseLowest)})
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-2xs">
              <span className="text-xs text-slate-500">Meses com Déficit</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-slate-900">
                  {impactSummary.simDeficits} {impactSummary.simDeficits === 1 ? "mês" : "meses"}
                </span>
                {impactSummary.solvedDeficits > 0 && (
                  <span className="text-xs font-medium text-emerald-600">
                    ({impactSummary.solvedDeficits} meses salvos!)
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-2xs">
              <span className="text-xs text-slate-500">Diferença Acumulada no Fim</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={`text-lg font-bold ${
                    isNegative(impactSummary.finalDifference)
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {isPositive(impactSummary.finalDifference) ? "+" : ""}
                  {formatMoney(impactSummary.finalDifference)}
                </span>
              </div>
            </div>
          </div>

          {/* Comparativo Mês a Mês Compacto */}
          <div className="space-y-2">
            <span className="text-xs font-semibold tracking-wider text-slate-600 uppercase">
              Comparativo Mês a Mês (Saldo Livre ao Final de Cada Mês):
            </span>

            <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
                    <th className="px-3 py-2 font-medium">Mês</th>
                    <th className="px-3 py-2 font-medium">Hoje (Atual)</th>
                    <th className="px-3 py-2 font-medium">Simulado</th>
                    <th className="px-3 py-2 font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {simulatedResult.months.slice(0, 8).map((m) => {
                    const diff = m.difference;
                    return (
                      <tr key={m.month} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {formatMonthKey(m.month)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 tabular-nums">
                          {formatMoney(m.baselineFreeBalance)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900 tabular-nums">
                          {formatMoney(m.scenarioFreeBalance)}
                        </td>
                        <td
                          className={`px-3 py-2 font-medium tabular-nums ${
                            isNegative(diff)
                              ? "text-amber-600"
                              : isPositive(diff)
                                ? "text-emerald-600"
                                : "text-slate-400"
                          }`}
                        >
                          {isPositive(diff) ? "+" : ""}
                          {formatMoney(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-500">
              * Esta é uma simulação descritiva. Nenhuma conta foi alterada no seu banco de dados.
            </p>

            <Link
              href="/app/recorrentes"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-2xs transition-colors hover:bg-teal-700"
            >
              <span>💾</span> Cadastrar este salário como regra fixa
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
