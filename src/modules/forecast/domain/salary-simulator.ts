import { type CalendarDate, calendarDate } from "@/core/date/calendar-date";
import {
  type CurrencyCode,
  type Money,
  add,
  isNegative,
  money,
  subtract,
  zero,
} from "@/core/money/money";
import { forecast } from "./forecast";
import type { ForecastInput } from "./forecast-types";
import type { ExtraIncomeChange, IncomeChangeChange } from "./scenario";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";

export interface SeasonalIncomeOptions {
  /** Valor base do salário líquido mensal para calcular parcelas proporcionais. */
  readonly monthlySalary: Money;
  /** Ano de referência (padrão: ano corrente de asOf). */
  readonly referenceYear: number;
  /** Dia de pagamento para 1ª parcela (padrão: 30/11). */
  readonly firstInstallmentDate?: CalendarDate;
  /** Dia de pagamento para 2ª parcela (padrão: 20/12). */
  readonly secondInstallmentDate?: CalendarDate;
}

export interface BreakEvenAnalysis {
  /** Soma das receitas recorrentes ativas cadastradas por mês. */
  readonly currentMonthlyIncome: Money;
  /** Maior custo mensal previsto no horizonte (o valor que a renda precisa cobrir). */
  readonly peakMonthlyOutflow: Money;
  /** Média mensal de despesas comprometidas no horizonte. */
  readonly averageMonthlyOutflow: Money;
  /** Renda mensal mínima sugerida para que nenhum mês feche em déficit. */
  readonly breakEvenMonthlyIncome: Money;
  /** Diferença mensal: positivo significa sobra/folga, negativo significa aperto/déficit. */
  readonly monthlyGap: Money;
  /** Indica se a renda atual já cobre com segurança todos os meses. */
  readonly isComfortable: boolean;
}

/**
 * Calcula a soma mensal aproximada de todas as regras recorrentes de receita ativas.
 */
export function calculateRegisteredMonthlyIncome(
  recurringRules: readonly RecurringRule[],
  currency = "BRL",
): Money {
  const incomes = recurringRules.filter((rule) => rule.active && rule.direction === "INFLOW");

  let totalCents = 0;
  for (const rule of incomes) {
    const amount = rule.amount.amount;
    switch (rule.frequency) {
      case "MONTHLY":
        totalCents += amount;
        break;
      case "WEEKLY":
        // ~4.33 semanas por mês
        totalCents += Math.round((amount * 52) / 12);
        break;
      case "BIWEEKLY":
        // ~2.16 quinzenas por mês
        totalCents += Math.round((amount * 26) / 12);
        break;
      case "ANNUAL":
        totalCents += Math.round(amount / 12);
        break;
      default:
        totalCents += amount;
        break;
    }
  }

  return money(totalCents, currency as CurrencyCode);
}

/**
 * Analisa o ponto de equilíbrio: quanto a família precisa receber por mês
 * para que nenhuma conta atrase e nenhum mês feche com déficit.
 */
export function analyzeBreakEvenIncome(input: ForecastInput): BreakEvenAnalysis {
  const result = forecast(input);
  const currency = input.openingBalance.currency;
  const currentIncome = calculateRegisteredMonthlyIncome(input.recurringRules, currency);

  // Ignora o primeiro mês se for parcial, pois só reflete frações de despesas
  const fullMonths = result.months.filter((m) => !m.isPartial);
  const consideredMonths = fullMonths.length > 0 ? fullMonths : result.months;

  if (consideredMonths.length === 0) {
    return {
      currentMonthlyIncome: currentIncome,
      peakMonthlyOutflow: zero(currency),
      averageMonthlyOutflow: zero(currency),
      breakEvenMonthlyIncome: zero(currency),
      monthlyGap: currentIncome,
      isComfortable: true,
    };
  }

  const outflows = consideredMonths.map((m) => m.committedOutflows);
  const peak = outflows.reduce(
    (max, curr) => (curr.amount > max.amount ? curr : max),
    zero(currency),
  );
  const totalOutflows = outflows.reduce((acc, curr) => add(acc, curr), zero(currency));
  const avgCents = Math.round(totalOutflows.amount / consideredMonths.length);
  const avg = money(avgCents, currency);

  // O ponto de equilíbrio é o teto necessário para cobrir o pico de despesas comprometidas
  const breakEven = peak;
  const gap = subtract(currentIncome, breakEven);

  return {
    currentMonthlyIncome: currentIncome,
    peakMonthlyOutflow: peak,
    averageMonthlyOutflow: avg,
    breakEvenMonthlyIncome: breakEven,
    monthlyGap: gap,
    isComfortable: !isNegative(gap),
  };
}

/**
 * Gera eventos simulados de 13º Salário (dividido em 2 parcelas de 50%).
 */
export function buildThirteenthSalaryChanges(
  options: SeasonalIncomeOptions,
): readonly ExtraIncomeChange[] {
  const { monthlySalary, referenceYear } = options;
  const currency = monthlySalary.currency;

  const halfAmount = money(Math.round(monthlySalary.amount / 2), currency);
  const remainder = subtract(monthlySalary, halfAmount);

  const d1 = options.firstInstallmentDate ?? calendarDate(`${referenceYear}-11-30`);
  const d2 = options.secondInstallmentDate ?? calendarDate(`${referenceYear}-12-20`);

  return [
    {
      kind: "EXTRA_INCOME",
      description: "1ª Parcela do 13º Salário",
      amount: halfAmount,
      date: d1,
    },
    {
      kind: "EXTRA_INCOME",
      description: "2ª Parcela do 13º Salário",
      amount: remainder,
      date: d2,
    },
  ];
}

/**
 * Gera evento simulado de Terço Constitucional de Férias (adicional de ~33.33%).
 */
export function buildVacationBonusChange(
  monthlySalary: Money,
  vacationDate: CalendarDate,
): ExtraIncomeChange {
  const oneThirdCents = Math.round(monthlySalary.amount / 3);
  return {
    kind: "EXTRA_INCOME",
    description: "Adicional de Férias (+1/3)",
    amount: money(oneThirdCents, monthlySalary.currency),
    date: vacationDate,
  };
}

/**
 * Gera evento simulado de variação permanente no salário a partir de uma data.
 */
export function buildSalaryVariationChange(
  delta: Money,
  startDate: CalendarDate,
  dayOfMonth = 5,
  description = "Ajuste Salarial Simulado",
): IncomeChangeChange {
  return {
    kind: "INCOME_CHANGE",
    description,
    monthlyDelta: delta,
    startDate,
    dayOfMonth,
  };
}
