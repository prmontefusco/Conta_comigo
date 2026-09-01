import { addMonths, monthKeyOf, type CalendarDate, type MonthKey } from "@/core/date/calendar-date";
import { type Money, clampToZero, subtract, zero } from "@/core/money/money";
import type { CardStatement } from "@/modules/cards/domain/credit-card";
import type { Debt } from "@/modules/debts/domain/debt";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { Reserve } from "@/modules/reserves/domain/reserve";

export type PayoffStrategy = "SNOWBALL" | "AVALANCHE";

export interface DebtItemForPayoff {
  readonly id: string;
  readonly name: string;
  readonly kind: "DEBT" | "CARD";
  readonly totalBalance: Money;
  readonly monthlyPayment: Money;
  readonly monthlyRate: number; // % monthly interest rate
  readonly remainingInstallments: number;
}

export interface DebtPayoffPlan {
  readonly strategy: PayoffStrategy;
  readonly strategyName: string;
  readonly description: string;
  readonly estimatedMonths: number;
  readonly targetDate: CalendarDate;
  readonly totalInterestPaid: Money;
  readonly interestSavedVsMinimum: Money;
  readonly orderOfPayoff: readonly {
    readonly debtId: string;
    readonly name: string;
    readonly payoffMonthIndex: number;
    readonly estimatedPayoffDate: CalendarDate;
  }[];
}

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly category: "CURRENT" | "DEBT_FREE" | "EMERGENCY_RESERVE" | "STABILITY";
  readonly targetDate: CalendarDate;
  readonly targetMonth: MonthKey;
  readonly monthsFromNow: number;
  readonly isCompleted: boolean;
  readonly progressPercentage: number;
  readonly description: string;
  readonly valueFormatted?: string;
}

export interface RecoveryTimelineResult {
  readonly asOf: CalendarDate;
  readonly monthlySurplus: Money;
  readonly totalDebtAmount: Money;
  readonly monthsToDebtFree: number;
  readonly debtFreeDate: CalendarDate;
  readonly monthsToEmergencyFund: number;
  readonly emergencyFundDate: CalendarDate;
  readonly monthsToStability: number;
  readonly stabilityDate: CalendarDate;
  readonly milestones: readonly Milestone[];
  readonly snowballPlan: DebtPayoffPlan;
  readonly avalanchePlan: DebtPayoffPlan;
  readonly acceleratedPayoffEstimate: {
    readonly extraAporte50: { readonly monthsReduced: number; readonly interestSaved: Money };
    readonly extraAporte100: { readonly monthsReduced: number; readonly interestSaved: Money };
    readonly extraAporte200: { readonly monthsReduced: number; readonly interestSaved: Money };
  };
}

export interface CalculateRecoveryTimelineInput {
  readonly asOf: CalendarDate;
  readonly openingBalance: Money;
  readonly totalCash: Money;
  readonly protectedReserve: Money;
  readonly forecast: ForecastResult;
  readonly debts: readonly Debt[];
  readonly cardStatements: readonly CardStatement[];
  readonly reserves: readonly Reserve[];
  readonly extraMonthlyContribution?: Money;
}

/**
 * Calculates a future recovery timeline:
 * - When will all debts be paid?
 * - When will the emergency fund be full?
 * - Compares Snowball vs Avalanche payoff methods.
 */
export function calculateRecoveryTimeline(
  input: CalculateRecoveryTimelineInput,
): RecoveryTimelineResult {
  const currency = input.totalCash.currency;
  const asOf = input.asOf;

  // Average monthly surplus from forecast
  const monthlyInflows = input.forecast.summary.expectedInflows.amount;
  const monthlyOutflows = input.forecast.summary.committedOutflows.amount;
  const rawSurplus = Math.max(0, monthlyInflows - monthlyOutflows);
  const extraAmount = input.extraMonthlyContribution?.amount ?? 0;
  const totalMonthlySurplus = rawSurplus + extraAmount;

  // Build debt items list
  const debtItems: DebtItemForPayoff[] = [];

  for (const debt of input.debts) {
    if (debt.status === "SETTLED") continue;
    const rate = debt.interestRateMonthly ?? 2.5; // fallback average rate if unknown
    const remaining = debt.principalContracted.amount;
    const installments = Math.max(1, debt.installmentCount);
    const installmentAmount = Math.round(remaining / installments);

    debtItems.push({
      id: debt.id,
      name: debt.description,
      kind: "DEBT",
      totalBalance: { amount: remaining, currency },
      monthlyPayment: { amount: installmentAmount, currency },
      monthlyRate: rate,
      remainingInstallments: installments,
    });
  }

  for (const statement of input.cardStatements) {
    if (statement.remainingAmount.amount <= 0) continue;
    debtItems.push({
      id: statement.id,
      name: `Fatura ${statement.referenceMonth}`,
      kind: "CARD",
      totalBalance: statement.remainingAmount,
      monthlyPayment: statement.remainingAmount,
      monthlyRate: 14.5, // Brazilian revolving credit average ~14% a month
      remainingInstallments: 1,
    });
  }

  const totalDebtCents = debtItems.reduce((acc, d) => acc + d.totalBalance.amount, 0);
  const totalDebtAmount: Money = { amount: totalDebtCents, currency };

  // Calculate payoff plans: Snowball (smallest balance first) & Avalanche (highest rate first)
  const snowballPlan = simulateStrategy(debtItems, "SNOWBALL", totalMonthlySurplus, asOf, currency);
  const avalanchePlan = simulateStrategy(
    debtItems,
    "AVALANCHE",
    totalMonthlySurplus,
    asOf,
    currency,
  );

  const monthsToDebtFree = avalanchePlan.estimatedMonths;
  const debtFreeDate = avalanchePlan.targetDate;

  // Target emergency reserve (3 months of essential outflows)
  const monthlyExpenseBase = Math.max(50000, monthlyOutflows); // at least R$ 500/mo
  const emergencyTargetCents = monthlyExpenseBase * 3;
  const currentReserveCents = Math.max(0, input.protectedReserve.amount);
  const reserveNeededCents = Math.max(0, emergencyTargetCents - currentReserveCents);

  // Time to complete emergency fund (saving after or alongside debt relief)
  const effectiveSavingCapacity = Math.max(
    10000,
    totalMonthlySurplus > 0 ? totalMonthlySurplus : 20000,
  ); // at least R$ 100/mo
  const monthsToFundAfterDebts = Math.ceil(reserveNeededCents / effectiveSavingCapacity);
  const monthsToEmergencyFund = monthsToDebtFree + monthsToFundAfterDebts;
  const emergencyFundDate = addMonths(asOf, monthsToEmergencyFund);

  // Time to stability (Emergency fund full + 6 months of positive track record)
  const monthsToStability = monthsToEmergencyFund + 6;
  const stabilityDate = addMonths(asOf, monthsToStability);

  // Milestones for the visual roadmap
  const milestones: Milestone[] = [
    {
      id: "m0",
      title: "Diagnóstico e Mapeamento Atual",
      category: "CURRENT",
      targetDate: asOf,
      targetMonth: monthKeyOf(asOf),
      monthsFromNow: 0,
      isCompleted: true,
      progressPercentage: 100,
      description: "Suas contas e dívidas foram mapeadas e o plano está em andamento.",
      valueFormatted: `Saldo inicial: ${formatMoney(input.totalCash)}`,
    },
  ];

  if (totalDebtCents > 0) {
    milestones.push({
      id: "m1",
      title: "Quitação Total de Dívidas e Cartões",
      category: "DEBT_FREE",
      targetDate: debtFreeDate,
      targetMonth: monthKeyOf(debtFreeDate),
      monthsFromNow: monthsToDebtFree,
      isCompleted: false,
      progressPercentage: 0,
      description: `Meta para zerar ${debtItems.length} dívida(s) e compromisso(s) ativo(s).`,
      valueFormatted: `Elimina ${formatMoney(totalDebtAmount)} em passivos`,
    });
  }

  milestones.push(
    {
      id: "m2",
      title: "Reserva de Emergência Essencial (3 meses)",
      category: "EMERGENCY_RESERVE",
      targetDate: emergencyFundDate,
      targetMonth: monthKeyOf(emergencyFundDate),
      monthsFromNow: monthsToEmergencyFund,
      isCompleted: reserveNeededCents === 0,
      progressPercentage: Math.min(
        100,
        Math.round((currentReserveCents / emergencyTargetCents) * 100),
      ),
      description:
        "Colchão financeiro seguro para proteger sua família contra qualquer imprevisto.",
      valueFormatted: `Meta: ${formatMoney({ amount: emergencyTargetCents, currency })}`,
    },
    {
      id: "m3",
      title: "Estabilidade Financeira e Liberdade",
      category: "STABILITY",
      targetDate: stabilityDate,
      targetMonth: monthKeyOf(stabilityDate),
      monthsFromNow: monthsToStability,
      isCompleted: false,
      progressPercentage: 0,
      description:
        "Finanças 100% blindadas, com superávit recorrente e capacidade de novos investimentos.",
      valueFormatted: "Liberdade Financeira Conquistada",
    },
  );

  // Accelerated payoff estimates
  const acceleratedPayoffEstimate = {
    extraAporte50: computeAccelerationSavings(debtItems, 5000, asOf, currency),
    extraAporte100: computeAccelerationSavings(debtItems, 10000, asOf, currency),
    extraAporte200: computeAccelerationSavings(debtItems, 20000, asOf, currency),
  };

  return {
    asOf,
    monthlySurplus: { amount: totalMonthlySurplus, currency },
    totalDebtAmount,
    monthsToDebtFree,
    debtFreeDate,
    monthsToEmergencyFund,
    emergencyFundDate,
    monthsToStability,
    stabilityDate,
    milestones,
    snowballPlan,
    avalanchePlan,
    acceleratedPayoffEstimate,
  };
}

function simulateStrategy(
  items: readonly DebtItemForPayoff[],
  strategy: PayoffStrategy,
  monthlySurplus: number,
  asOf: CalendarDate,
  currency: Money["currency"],
): DebtPayoffPlan {
  if (items.length === 0) {
    return {
      strategy,
      strategyName: strategy === "SNOWBALL" ? "Método Bola de Neve" : "Método Avalanche",
      description: "Você não possui dívidas ativas. Parabéns!",
      estimatedMonths: 0,
      targetDate: asOf,
      totalInterestPaid: zero(currency),
      interestSavedVsMinimum: zero(currency),
      orderOfPayoff: [],
    };
  }

  // Clone items
  const pool = items.map((i) => ({ ...i, balance: i.totalBalance.amount }));

  // Sort order:
  // Snowball: smallest balance first (quick wins)
  // Avalanche: highest rate first (saves most money)
  if (strategy === "SNOWBALL") {
    pool.sort((a, b) => a.balance - b.balance);
  } else {
    pool.sort((a, b) => b.monthlyRate - a.monthlyRate);
  }

  let months = 0;
  let totalInterest = 0;
  const payoffOrder: {
    debtId: string;
    name: string;
    payoffMonthIndex: number;
    estimatedPayoffDate: CalendarDate;
  }[] = [];

  const maxMonths = 360; // 30 years cap

  while (pool.some((d) => d.balance > 0) && months < maxMonths) {
    months++;
    let extraCash = monthlySurplus;

    // 1. Accrue monthly interest & pay minimums
    for (const d of pool) {
      if (d.balance <= 0) continue;
      const interest = Math.round(d.balance * (d.monthlyRate / 100));
      totalInterest += interest;
      d.balance += interest;

      // Minimum payment
      const minPayment = Math.min(d.monthlyPayment.amount, d.balance);
      d.balance -= minPayment;

      if (d.balance <= 0 && !payoffOrder.some((p) => p.debtId === d.id)) {
        payoffOrder.push({
          debtId: d.id,
          name: d.name,
          payoffMonthIndex: months,
          estimatedPayoffDate: addMonths(asOf, months),
        });
      }
    }

    // 2. Direct extra surplus to the target debt of the strategy
    for (const d of pool) {
      if (d.balance <= 0 || extraCash <= 0) continue;
      const payment = Math.min(extraCash, d.balance);
      d.balance -= payment;
      extraCash -= payment;

      if (d.balance <= 0 && !payoffOrder.some((p) => p.debtId === d.id)) {
        payoffOrder.push({
          debtId: d.id,
          name: d.name,
          payoffMonthIndex: months,
          estimatedPayoffDate: addMonths(asOf, months),
        });
      }
    }
  }

  const targetDate = addMonths(asOf, months);

  return {
    strategy,
    strategyName:
      strategy === "SNOWBALL"
        ? "Método Bola de Neve (Menores dívidas primeiro)"
        : "Método Avalanche (Maiores juros primeiro)",
    description:
      strategy === "SNOWBALL"
        ? "Foca em liquidar as menores dívidas primeiro para obter vitórias psicológicas rápidas e liberar fluxo."
        : "Foca em liquidar as dívidas mais caras (juros maiores) primeiro, economizando o máximo de dinheiro em taxas.",
    estimatedMonths: months,
    targetDate,
    totalInterestPaid: { amount: totalInterest, currency },
    interestSavedVsMinimum: {
      amount: strategy === "AVALANCHE" ? Math.round(totalInterest * 0.2) : 0,
      currency,
    },
    orderOfPayoff: payoffOrder,
  };
}

function computeAccelerationSavings(
  items: readonly DebtItemForPayoff[],
  extraMonthlyCents: number,
  asOf: CalendarDate,
  currency: Money["currency"],
): { monthsReduced: number; interestSaved: Money } {
  if (items.length === 0) return { monthsReduced: 0, interestSaved: zero(currency) };

  const baseline = simulateStrategy(items, "AVALANCHE", 0, asOf, currency);
  const accelerated = simulateStrategy(items, "AVALANCHE", extraMonthlyCents, asOf, currency);

  const monthsReduced = Math.max(0, baseline.estimatedMonths - accelerated.estimatedMonths);
  const interestSaved = clampToZero(
    subtract(baseline.totalInterestPaid, accelerated.totalInterestPaid),
  );

  return { monthsReduced, interestSaved };
}

function formatMoney(money: Money): string {
  const isNeg = money.amount < 0;
  const abs = Math.abs(money.amount);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${isNeg ? "- " : ""}R$ ${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`;
}
