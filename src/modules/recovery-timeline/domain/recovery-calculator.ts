import {
  addMonths,
  formatMonthKey,
  monthKeyOf,
  type CalendarDate,
  type MonthKey,
} from "@/core/date/calendar-date";
import { type Money, clampToZero, money, subtract, zero } from "@/core/money/money";
import type { CardStatement } from "@/modules/cards/domain/credit-card";
import {
  effectiveMonthlyRate,
  outstandingPrincipal,
  upcomingInstallments,
  type Debt,
  type RateSource,
} from "@/modules/debts/domain/debt";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { Reserve } from "@/modules/reserves/domain/reserve";
import {
  monthsToStarterReserve,
  starterReserveStatus,
  type StarterReserveStatus,
} from "@/modules/reserves/domain/starter-reserve";

export type PayoffStrategy = "SNOWBALL" | "AVALANCHE";

/** Where an item's rate came from. See `effectiveMonthlyRate`. */
export type PayoffRateSource = RateSource | "MARKET_ESTIMATE";

/**
 * Estimated monthly cost of carrying an overdue card statement.
 *
 * The real rate is printed on a fatura this app never sees, and rotativo in
 * Brazil sits around this figure. It is flagged as an estimate everywhere it
 * shows up, because a household deciding what to attack first deserves to know
 * which numbers came from their contracts and which came from an average.
 */
export const REVOLVING_MONTHLY_RATE_ESTIMATE = 14.5;

export interface DebtItemForPayoff {
  readonly id: string;
  readonly name: string;
  readonly kind: "DEBT" | "CARD";
  readonly totalBalance: Money;
  readonly monthlyPayment: Money;
  readonly monthlyRate: number; // % monthly interest rate
  readonly rateSource: PayoffRateSource;
  readonly remainingInstallments: number;
}

export interface DebtPayoffPlan {
  readonly strategy: PayoffStrategy;
  readonly strategyName: string;
  readonly description: string;
  readonly estimatedMonths: number;
  readonly targetDate: CalendarDate;
  readonly totalInterestPaid: Money;
  /** How much less interest this plan pays than paying only the minimums. */
  readonly interestSavedVsMinimum: Money;
  /** Items whose rate is a solved or market estimate, not a contract figure. */
  readonly estimatedRateItems: number;
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
  readonly category:
    "CURRENT" | "STARTER_RESERVE" | "DEBT_FREE" | "EMERGENCY_RESERVE" | "STABILITY";
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
  /**
   * The first step: a small cushion, built *before* the debt is gone.
   *
   * Placed ahead of the payoff on purpose - a household with nothing put aside
   * meets one emergency and goes straight back to the card.
   */
  readonly starterReserve: StarterReserveStatus;
  readonly monthsToStarterReserve: number | null;
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
  /**
   * Instalments already paid, per debt.
   *
   * Without it every plan starts from the contracted amount, which turns a
   * debt half repaid into a debt untouched.
   */
  readonly paidDebtInstallments?: ReadonlyMap<string, readonly number[]>;
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

  // What a month actually leaves over.
  //
  // Deliberately *not* `forecast.summary`: those totals cover the whole
  // horizon - thirteen months - so using them here multiplied the household's
  // monthly capacity by thirteen and promised a payoff date that could never
  // arrive. Partial months are skipped for the reason the forecast states:
  // income already received is not in them, so their "deficit" is an artefact.
  const wholeMonths = input.forecast.months.filter((month) => !month.isPartial);
  const monthlyInflows = averageOf(wholeMonths.map((month) => month.expectedInflows.amount));
  const monthlyOutflows = averageOf(wholeMonths.map((month) => month.committedOutflows.amount));
  const rawSurplus = Math.max(0, monthlyInflows - monthlyOutflows);
  const extraAmount = input.extraMonthlyContribution?.amount ?? 0;
  const totalMonthlySurplus = rawSurplus + extraAmount;

  // Build debt items list
  const debtItems: DebtItemForPayoff[] = [];

  const paidByDebt = input.paidDebtInstallments ?? new Map<string, readonly number[]>();

  for (const debt of input.debts) {
    if (debt.status === "SETTLED") continue;

    // The same functions the debts screen uses, so the two never disagree
    // about what is still owed or what the next instalment costs.
    const paid = paidByDebt.get(debt.id) ?? [];
    const balance = outstandingPrincipal(debt, paid);
    if (balance.amount <= 0) continue;

    const upcoming = upcomingInstallments(debt, asOf, paid);
    const rate = effectiveMonthlyRate(debt);

    // Everything overdue leaves `upcoming` empty; the contract instalment, or
    // the balance spread over what is left, still describes the monthly bite.
    const remainingCount = Math.max(1, debt.installmentCount - paid.length);
    const monthlyPayment =
      upcoming[0]?.total ??
      debt.installmentAmount ??
      money(Math.round(balance.amount / remainingCount), currency);

    debtItems.push({
      id: debt.id,
      name: debt.description,
      kind: "DEBT",
      totalBalance: balance,
      monthlyPayment,
      monthlyRate: rate.monthly,
      rateSource: rate.source,
      remainingInstallments: Math.max(upcoming.length, remainingCount),
    });
  }

  for (const statement of input.cardStatements) {
    if (statement.remainingAmount.amount <= 0) continue;

    // A fatura still to close is a scheduled payment and costs nothing extra.
    // One already past due is being carried on rotativo, which is the most
    // expensive money in the country - and an estimate, so it is labelled one.
    const overdue = statement.dueDate < asOf;

    debtItems.push({
      id: statement.id,
      name: `Fatura de ${formatMonthKey(statement.referenceMonth)}`,
      kind: "CARD",
      totalBalance: statement.remainingAmount,
      monthlyPayment: statement.remainingAmount,
      monthlyRate: overdue ? REVOLVING_MONTHLY_RATE_ESTIMATE : 0,
      rateSource: overdue ? "MARKET_ESTIMATE" : "CONTRACT",
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

  const starter = starterReserveStatus(input.reserves, { amount: monthlyOutflows, currency });
  const starterMonths = monthsToStarterReserve(starter, {
    amount: Math.max(totalMonthlySurplus, 0),
    currency,
  });

  milestones.push({
    id: "m0b",
    title: "Reserva de partida (antes de quitar tudo)",
    category: "STARTER_RESERVE",
    targetDate: addMonths(asOf, starterMonths ?? 0),
    targetMonth: monthKeyOf(addMonths(asOf, starterMonths ?? 0)),
    monthsFromNow: starterMonths ?? 0,
    isCompleted: starter.isComplete,
    progressPercentage: Math.round(starter.ratio * 100),
    description:
      "Um colchão pequeno guardado antes da quitação total. É ele que impede um imprevisto de jogar a família de volta no cartão.",
    valueFormatted: `${formatMoney(starter.current)} de ${formatMoney(starter.target)}`,
  });

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
    starterReserve: starter,
    monthsToStarterReserve: starterMonths,
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
  /** False on the inner run that measures "paying only the minimums". */
  withBaseline = true,
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
      estimatedRateItems: 0,
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
    // Measured, not assumed: the same plan run with no extra money is what
    // "paying only the minimums" costs, and the difference is the saving.
    interestSavedVsMinimum: withBaseline
      ? clampToZero(
          subtract(simulateStrategy(items, strategy, 0, asOf, currency, false).totalInterestPaid, {
            amount: totalInterest,
            currency,
          }),
        )
      : zero(currency),
    estimatedRateItems: items.filter(
      (item) => item.rateSource === "IMPLIED" || item.rateSource === "MARKET_ESTIMATE",
    ).length,
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

  const baseline = simulateStrategy(items, "AVALANCHE", 0, asOf, currency, false);
  const accelerated = simulateStrategy(
    items,
    "AVALANCHE",
    extraMonthlyCents,
    asOf,
    currency,
    false,
  );

  const monthsReduced = Math.max(0, baseline.estimatedMonths - accelerated.estimatedMonths);
  const interestSaved = clampToZero(
    subtract(baseline.totalInterestPaid, accelerated.totalInterestPaid),
  );

  return { monthsReduced, interestSaved };
}

function averageOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function formatMoney(money: Money): string {
  const isNeg = money.amount < 0;
  const abs = Math.abs(money.amount);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${isNeg ? "- " : ""}R$ ${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`;
}
