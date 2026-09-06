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
  /**
   * False when the simulation hit its 30-year ceiling with debt still open.
   *
   * A balance that grows faster than it is paid never closes, and reporting
   * "360 meses" as though it were a plan is worse than reporting nothing.
   */
  readonly closes: boolean;
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

/**
 * Whether the household can actually run the plan it is being shown.
 *
 * The distinction this type exists to make: a plan can be slow, and a plan can
 * be impossible, and telling someone the second is the first is the single
 * most damaging thing a product like this can do. A household whose income
 * does not cover the minimum instalments does not need a payoff date - it
 * needs to renegotiate the term, and to be told so plainly.
 */
export type PlanViability =
  /** The minimums fit, and there is money left over to attack the debt. */
  | "ON_TRACK"
  /** The minimums fit, but nothing is left over: the plan only treads water. */
  | "TIGHT"
  /** Income does not cover the minimum instalments. No payoff date is honest. */
  | "NOT_VIABLE";

export interface PlanFeasibility {
  readonly viability: PlanViability;
  /** Money available for debt each month: income minus what the home must spend. */
  readonly monthlyCapacity: Money;
  /** What the minimum instalments demand every month. */
  readonly requiredMinimums: Money;
  /** How much the month is short of the minimums. Zero when it is not. */
  readonly monthlyShortfall: Money;
}

export interface RecoveryTimelineResult {
  readonly asOf: CalendarDate;
  readonly monthlySurplus: Money;
  /**
   * Whether a payoff date means anything for this household.
   *
   * Every date below is conditional on this being anything but `NOT_VIABLE`.
   */
  readonly feasibility: PlanFeasibility;
  readonly totalDebtAmount: Money;
  /** Null when the plan is not viable: there is no honest month to name. */
  readonly monthsToDebtFree: number | null;
  readonly debtFreeDate: CalendarDate | null;
  /**
   * The first step: a small cushion, built *before* the debt is gone.
   *
   * Placed ahead of the payoff on purpose - a household with nothing put aside
   * meets one emergency and goes straight back to the card.
   */
  readonly starterReserve: StarterReserveStatus;
  readonly monthsToStarterReserve: number | null;
  /** Null when there is no spare money to build it with. */
  readonly monthsToEmergencyFund: number | null;
  readonly emergencyFundDate: CalendarDate | null;
  readonly monthsToStability: number | null;
  readonly stabilityDate: CalendarDate | null;
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
  /** Card id to display name, so the plan can say which card it means. */
  readonly cardNames?: ReadonlyMap<string, string>;
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
  const monthlyDebtCommitment = averageOf(wholeMonths.map((month) => month.debtCommitment.amount));
  const extraAmount = input.extraMonthlyContribution?.amount ?? 0;

  // Everything the home must spend before a single real of debt is serviced.
  const monthlyEssentials = Math.max(0, monthlyOutflows - monthlyDebtCommitment);

  // The money that can go to debt this month - and it is allowed to be
  // negative. Clamping it to zero was how a household R$ 800 short every month
  // came to be shown a payoff date: the shortfall vanished and the simulation
  // went on paying instalments out of money that does not exist.
  const monthlyCapacityAmount = monthlyInflows - monthlyEssentials + extraAmount;

  // Kept for the screens that show "what is left after everything", which is a
  // different question from "what can service debt".
  const totalMonthlySurplus = monthlyInflows - monthlyOutflows + extraAmount;

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

  // Card debt is grouped by card, not by statement.
  //
  // One statement per month per card produced a list where "Fatura de setembro
  // de 2026" appeared twice - once per card, indistinguishable - and where
  // every one of them was cleared in month one, because a statement's
  // "minimum payment" had been set to its whole balance. Neither survives
  // grouping: a card is one debt with one balance, and what it demands next
  // month is its next fatura, not all of them at once.
  const openStatements = input.cardStatements.filter(
    (statement) => statement.remainingAmount.amount > 0,
  );
  const byCard = new Map<string, CardStatement[]>();
  for (const statement of openStatements) {
    const list = byCard.get(statement.creditCardId);
    if (list) list.push(statement);
    else byCard.set(statement.creditCardId, [statement]);
  }

  for (const [creditCardId, statements] of byCard) {
    const balance = statements.reduce((total, item) => total + item.remainingAmount.amount, 0);
    if (balance <= 0) continue;

    const sorted = [...statements].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    const overdue = sorted.filter((statement) => statement.dueDate < asOf);
    const next = sorted[0];

    // A fatura still to close is a scheduled payment and costs nothing extra.
    // One already past due is being carried on rotativo, which is the most
    // expensive money in the country - and an estimate, so it is labelled one.
    const carryingRevolving = overdue.length > 0;

    // What the card demands next month: the overdue balance if there is one -
    // it is all payable today - otherwise the next fatura alone. Never the
    // whole card at once, which is precisely what a household in trouble
    // cannot do.
    const overdueAmount = overdue.reduce((total, item) => total + item.remainingAmount.amount, 0);
    const demandedNext = carryingRevolving
      ? Math.max(overdueAmount, minimumStatementPayment(overdueAmount))
      : (next?.remainingAmount.amount ?? balance);

    debtItems.push({
      id: `card:${creditCardId}`,
      name: cardDebtName(input.cardNames?.get(creditCardId), sorted),
      kind: "CARD",
      totalBalance: money(balance, currency),
      monthlyPayment: money(Math.min(demandedNext, balance), currency),
      monthlyRate: carryingRevolving ? REVOLVING_MONTHLY_RATE_ESTIMATE : 0,
      rateSource: carryingRevolving ? "MARKET_ESTIMATE" : "CONTRACT",
      remainingInstallments: sorted.length,
    });
  }

  const totalDebtCents = debtItems.reduce((acc, d) => acc + d.totalBalance.amount, 0);
  const totalDebtAmount: Money = { amount: totalDebtCents, currency };

  // Can this household even run the plan?
  //
  // Answered before any date is computed, because the answer decides whether a
  // date is worth computing at all.
  const requiredMinimums = debtItems.reduce((total, item) => total + item.monthlyPayment.amount, 0);
  const shortfall = Math.max(0, requiredMinimums - monthlyCapacityAmount);
  const feasibility: PlanFeasibility = {
    viability:
      totalDebtCents === 0
        ? "ON_TRACK"
        : shortfall > 0
          ? "NOT_VIABLE"
          : monthlyCapacityAmount - requiredMinimums <= 0
            ? "TIGHT"
            : "ON_TRACK",
    monthlyCapacity: money(monthlyCapacityAmount, currency),
    requiredMinimums: money(requiredMinimums, currency),
    monthlyShortfall: money(shortfall, currency),
  };

  // Calculate payoff plans: Snowball (smallest balance first) & Avalanche (highest rate first)
  const snowballPlan = simulateStrategy(
    debtItems,
    "SNOWBALL",
    monthlyCapacityAmount,
    asOf,
    currency,
  );
  const avalanchePlan = simulateStrategy(
    debtItems,
    "AVALANCHE",
    monthlyCapacityAmount,
    asOf,
    currency,
  );

  // No honest month to name when the minimums do not fit. The screens read
  // `feasibility` and say so, instead of printing a date thirty years out.
  const planCloses = feasibility.viability !== "NOT_VIABLE" && avalanchePlan.closes;
  const monthsToDebtFree = planCloses ? avalanchePlan.estimatedMonths : null;
  const debtFreeDate = planCloses ? avalanchePlan.targetDate : null;

  // Target emergency reserve (3 months of essential outflows)
  const monthlyExpenseBase = Math.max(50000, monthlyOutflows); // at least R$ 500/mo
  const emergencyTargetCents = monthlyExpenseBase * 3;
  const currentReserveCents = Math.max(0, input.protectedReserve.amount);
  const reserveNeededCents = Math.max(0, emergencyTargetCents - currentReserveCents);

  // Time to complete the emergency fund.
  //
  // Once the debt is gone, everything that was servicing it can be saved -
  // that, and nothing invented. The previous floor of R$ 100 a month conjured
  // money the household had said it did not have, and turned into milestones
  // thirteen years out that no one could act on. When there is nothing to save
  // with, the honest answer is no date at all.
  const savingCapacityAfterDebts = monthlyCapacityAmount;
  const monthsToEmergencyFund =
    reserveNeededCents === 0
      ? monthsToDebtFree
      : monthsToDebtFree !== null && savingCapacityAfterDebts > 0
        ? monthsToDebtFree + Math.ceil(reserveNeededCents / savingCapacityAfterDebts)
        : null;
  const emergencyFundDate =
    monthsToEmergencyFund === null ? null : addMonths(asOf, monthsToEmergencyFund);

  // Time to stability (Emergency fund full + 6 months of positive track record)
  const monthsToStability = monthsToEmergencyFund === null ? null : monthsToEmergencyFund + 6;
  const stabilityDate = monthsToStability === null ? null : addMonths(asOf, monthsToStability);

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
  // A reserva de partida também precisa passar pelo teste de viabilidade.
  //
  // O que sobra depois das contas do mês não é o que sobra para guardar: se as
  // parcelas mínimas já não cabem, cada real guardado é um real que faltou
  // numa parcela. Prometer "reserva de partida em 35 meses" a quem está R$ 577
  // curto por mês contradiz, na mesma tela, o aviso de que o plano não fecha.
  const canSaveAnything = feasibility.viability !== "NOT_VIABLE";
  const starterMonths = canSaveAnything
    ? monthsToStarterReserve(starter, {
        amount: Math.max(totalMonthlySurplus, 0),
        currency,
      })
    : null;

  if (starter.isComplete || starterMonths !== null) {
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
  }

  // Milestones only exist where a date exists.
  //
  // A milestone with no reachable date is not a goal, it is a verdict, and
  // showing "estabilidade em agosto de 2040" to a family in trouble teaches
  // them the app is not talking about their life. When the plan does not
  // close, the screens fall back to `feasibility` and say what to do instead.
  const itemCount = debtItems.length;

  if (totalDebtCents > 0 && monthsToDebtFree !== null && debtFreeDate !== null) {
    milestones.push({
      id: "m1",
      title: "Quitação Total de Dívidas e Cartões",
      category: "DEBT_FREE",
      targetDate: debtFreeDate,
      targetMonth: monthKeyOf(debtFreeDate),
      monthsFromNow: monthsToDebtFree,
      isCompleted: false,
      progressPercentage: 0,
      description: `Meta para zerar ${itemCount} ${itemCount === 1 ? "dívida ativa" : "dívidas ativas"}.`,
      valueFormatted: `Elimina ${formatMoney(totalDebtAmount)} em passivos`,
    });
  }

  if (monthsToEmergencyFund !== null && emergencyFundDate !== null) {
    milestones.push({
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
    });
  }

  if (monthsToStability !== null && stabilityDate !== null) {
    milestones.push({
      id: "m3",
      title: "Estabilidade Financeira e Liberdade",
      category: "STABILITY",
      targetDate: stabilityDate,
      targetMonth: monthKeyOf(stabilityDate),
      monthsFromNow: monthsToStability,
      isCompleted: false,
      progressPercentage: 0,
      description:
        "Finanças com folga recorrente e um colchão que absorve imprevistos sem voltar ao cartão.",
      valueFormatted: "Estabilidade conquistada",
    });
  }

  // Accelerated payoff estimates
  const acceleratedPayoffEstimate = {
    extraAporte50: computeAccelerationSavings(
      debtItems,
      5000,
      monthlyCapacityAmount,
      asOf,
      currency,
    ),
    extraAporte100: computeAccelerationSavings(
      debtItems,
      10000,
      monthlyCapacityAmount,
      asOf,
      currency,
    ),
    extraAporte200: computeAccelerationSavings(
      debtItems,
      20000,
      monthlyCapacityAmount,
      asOf,
      currency,
    ),
  };

  return {
    asOf,
    monthlySurplus: { amount: totalMonthlySurplus, currency },
    feasibility,
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

/**
 * Runs the payoff month by month against a real monthly budget.
 *
 * `monthlyCapacity` is everything the household can put towards debt in a
 * month - minimums included, not on top of them. That single change is what
 * separates a plan from a wish.
 */
function simulateStrategy(
  items: readonly DebtItemForPayoff[],
  strategy: PayoffStrategy,
  monthlyCapacity: number,
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
      closes: true,
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

  const settle = (d: { id: string; name: string; balance: number }) => {
    if (d.balance > 0 || payoffOrder.some((p) => p.debtId === d.id)) return;
    payoffOrder.push({
      debtId: d.id,
      name: d.name,
      payoffMonthIndex: months,
      estimatedPayoffDate: addMonths(asOf, months),
    });
  };

  // A plan that is going backwards is not a slow plan.
  //
  // When the month's money does not even cover the interest, the balance grows
  // and keeps growing: running that to the 360-month ceiling produces numbers
  // that overflow the money type long before they produce an answer. Three
  // consecutive months without progress is proof enough - capacity and rates
  // are constant here, so a stall never un-stalls itself.
  let previousTotal = pool.reduce((total, d) => total + d.balance, 0);
  let stalledMonths = 0;
  const STALL_LIMIT = 3;

  while (pool.some((d) => d.balance > 0) && months < maxMonths) {
    months++;

    // Every month starts with a fixed amount of real money, and not one
    // centavo more. The old loop paid every minimum unconditionally and then
    // added the surplus on top, so a household with nothing still "paid" its
    // instalments - which is how an impossible plan acquired a completion
    // date. Here the month can genuinely run out of money, and a debt that
    // goes unpaid simply keeps its balance and accrues next month.
    let cash = Math.max(0, monthlyCapacity);

    // 1. Interest first: it accrues whether or not anything is paid.
    for (const d of pool) {
      if (d.balance <= 0) continue;
      const interest = Math.round(d.balance * (d.monthlyRate / 100));
      totalInterest += interest;
      d.balance += interest;
    }

    // 2. Minimums, in strategy order, while the money lasts.
    for (const d of pool) {
      if (d.balance <= 0 || cash <= 0) continue;
      const payment = Math.min(d.monthlyPayment.amount, d.balance, cash);
      d.balance -= payment;
      cash -= payment;
      settle(d);
    }

    // 3. Whatever is left over goes to the strategy's target debt.
    for (const d of pool) {
      if (d.balance <= 0 || cash <= 0) continue;
      const payment = Math.min(cash, d.balance);
      d.balance -= payment;
      cash -= payment;
      settle(d);
    }

    const total = pool.reduce((sofar, d) => sofar + d.balance, 0);
    stalledMonths = total >= previousTotal ? stalledMonths + 1 : 0;
    previousTotal = total;
    if (stalledMonths >= STALL_LIMIT) break;
  }

  const closes = pool.every((d) => d.balance <= 0);
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
    closes,
    totalInterestPaid: { amount: totalInterest, currency },
    // Measured, not assumed: the same plan run with no extra money is what
    // "paying only the minimums" costs, and the difference is the saving.
    interestSavedVsMinimum: withBaseline
      ? clampToZero(
          subtract(
            simulateStrategy(items, strategy, minimumsOnly(items), asOf, currency, false)
              .totalInterestPaid,
            { amount: totalInterest, currency },
          ),
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
  baseCapacity: number,
  asOf: CalendarDate,
  currency: Money["currency"],
): { monthsReduced: number; interestSaved: Money } {
  if (items.length === 0) return { monthsReduced: 0, interestSaved: zero(currency) };

  const baseline = simulateStrategy(items, "AVALANCHE", baseCapacity, asOf, currency, false);
  const accelerated = simulateStrategy(
    items,
    "AVALANCHE",
    baseCapacity + extraMonthlyCents,
    asOf,
    currency,
    false,
  );

  // An extra R$ 50 cannot shorten a plan that never ends. Saying it does is
  // the same false comfort this module exists to avoid.
  if (!baseline.closes && !accelerated.closes) {
    return { monthsReduced: 0, interestSaved: zero(currency) };
  }

  const monthsReduced = Math.max(0, baseline.estimatedMonths - accelerated.estimatedMonths);
  const interestSaved = clampToZero(
    subtract(baseline.totalInterestPaid, accelerated.totalInterestPaid),
  );

  return { monthsReduced, interestSaved };
}

/** Just enough money to cover every minimum, and nothing beyond it. */
function minimumsOnly(items: readonly DebtItemForPayoff[]): number {
  return items.reduce((total, item) => total + item.monthlyPayment.amount, 0);
}

/**
 * The regulated floor for a credit-card statement in Brazil.
 *
 * Fifteen percent of the balance is the minimum a card issuer may accept
 * (CMN Res. 4.549). It is the smallest payment that keeps the account from
 * default - and the most expensive way to carry the debt, which is why the
 * rotativo rate is applied to whatever is left.
 */
export const MINIMUM_STATEMENT_SHARE = 0.15;

export function minimumStatementPayment(balanceCents: number): number {
  return Math.min(balanceCents, Math.ceil(balanceCents * MINIMUM_STATEMENT_SHARE));
}

/** "Cartão Nubank" when the name is known, otherwise the months it covers. */
function cardDebtName(cardName: string | undefined, statements: readonly CardStatement[]): string {
  if (cardName) return `Cartão ${cardName}`;
  const first = statements[0];
  return first ? `Fatura de ${formatMonthKey(first.referenceMonth)}` : "Cartão de crédito";
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
