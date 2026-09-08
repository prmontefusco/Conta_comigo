import { formatCalendarDate, type CalendarDate } from "@/core/date/calendar-date";
import { type Money, subtract } from "@/core/money/money";
import type { CreditCard, CardStatement } from "@/modules/cards/domain/credit-card";
import { outstandingPrincipal, type Debt } from "@/modules/debts/domain/debt";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import { isOpen, remainingAmount, type Obligation } from "@/modules/obligations/domain/obligation";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import type { Reserve } from "@/modules/reserves/domain/reserve";

export type HealthStatus = "CRITICAL" | "ATTENTION" | "BALANCED" | "HEALTHY" | "EXCELLENT" | "AWAITING_DATA";

export interface HealthPillar {
  readonly id: string;
  readonly title: string;
  readonly score: number; // 0 to 100
  readonly weight: number; // percentage (0 to 1)
  readonly status: HealthStatus;
  readonly message: string;
  readonly recommendation: string;
}

export interface ActionPlanStep {
  readonly priority: number;
  readonly category: "EMERGENCY" | "DEBT" | "EXPENSE_CUT" | "SAVINGS" | "FUTURE";
  readonly title: string;
  readonly description: string;
  readonly impact: string;
  readonly estimatedDaysToComplete?: number;
}

export interface FinancialHealthReport {
  readonly score: number; // 0 to 100
  readonly status: HealthStatus;
  readonly statusLabel: string;
  readonly summary: string;
  readonly monthlyIncome: Money;
  readonly monthlyExpenses: Money;
  readonly monthlyNet: Money;
  readonly debtCommitmentRatio: number; // % of income taken by debt/cards (DTI)
  readonly totalDebtOutstanding: Money;
  readonly emergencyFundMonths: number; // how many months cash covers essential expenses
  readonly overdueBillsCount: number;
  readonly overdueBillsTotal: Money;
  readonly pillars: readonly HealthPillar[];
  readonly actionPlan: readonly ActionPlanStep[];
  readonly tips: readonly string[];
}

export interface EvaluateFinancialHealthInput {
  readonly asOf: CalendarDate;
  readonly openingBalance: Money;
  readonly totalCash: Money;
  readonly protectedReserve: Money;
  readonly forecast: ForecastResult;
  readonly debts: readonly Debt[];
  readonly cards: readonly CreditCard[];
  readonly cardStatements: readonly CardStatement[];
  readonly obligations: readonly Obligation[];
  readonly recurringRules: readonly RecurringRule[];
  readonly reserves: readonly Reserve[];
  /** Instalments already paid, per debt. Without it every debt looks untouched. */
  readonly paidDebtInstallments?: ReadonlyMap<string, readonly number[]>;
}

/**
 * Evaluates the household's financial health based on real projections,
 * debt levels, recurring obligations and emergency reserve.
 */
export function evaluateFinancialHealth(
  input: EvaluateFinancialHealthInput,
): FinancialHealthReport {
  const currency = input.totalCash.currency;

  // 1. Monthly income and committed expenses.
  //
  // Averaged over the whole months of the projection, never taken from
  // `forecast.summary`: those totals cover the entire horizon, and reporting
  // thirteen months of salary as "renda mensal" flatters every ratio below and
  // reaches the person as advice.
  const wholeMonths = input.forecast.months.filter((month) => !month.isPartial);
  const monthlyInflows: Money = {
    amount: averageOf(wholeMonths.map((month) => month.expectedInflows.amount)),
    currency,
  };
  const monthlyOutflows: Money = {
    amount: averageOf(wholeMonths.map((month) => month.committedOutflows.amount)),
    currency,
  };
  const monthlyNet = subtract(monthlyInflows, monthlyOutflows);

  // Fallback monthly base income from the recurring rules, when the projection
  // has too few events to average.
  const recurringIncomes = input.recurringRules
    .filter((r) => r.direction === "INFLOW")
    .reduce((acc, r) => acc + r.amount.amount, 0);

  const baseMonthlyIncomeAmount = Math.max(monthlyInflows.amount, recurringIncomes, 1);

  // Verificação de ausência de dados: se não há contas, rendas, dívidas nem saldo,
  // não calcula pontuação cheia (evita falso diagnóstico positivo de 73 pts sem dados).
  const hasNoData =
    input.totalCash.amount === 0 &&
    input.obligations.length === 0 &&
    input.recurringRules.length === 0 &&
    input.debts.length === 0 &&
    input.cards.length === 0 &&
    monthlyInflows.amount === 0 &&
    monthlyOutflows.amount === 0;

  if (hasNoData) {
    const emptyMoney: Money = { amount: 0, currency };
    const awaitingPillars: readonly HealthPillar[] = [
      {
        id: "punctuality",
        title: "Pontualidade e Contas em Dia",
        score: 0,
        weight: 0.25,
        status: "AWAITING_DATA",
        message: "Nenhuma conta ou boleto cadastrado ainda.",
        recommendation: "Cadastre suas contas fixas e vencimentos para acompanhar a pontualidade.",
      },
      {
        id: "debt_burden",
        title: "Comprometimento com Dívidas",
        score: 0,
        weight: 0.3,
        status: "AWAITING_DATA",
        message: "Sem dados de renda ou dívidas para calcular comprometimento.",
        recommendation: "Informe sua renda mensal e empréstimos/parcelas se houver.",
      },
      {
        id: "cash_flow",
        title: "Fluxo de Caixa e Superávit",
        score: 0,
        weight: 0.25,
        status: "AWAITING_DATA",
        message: "Projeção aguardando suas entradas e saídas previstas.",
        recommendation: "Cadastre sua renda e contas para projetar os próximos meses.",
      },
      {
        id: "emergency_reserve",
        title: "Colchão de Proteção (Reserva)",
        score: 0,
        weight: 0.2,
        status: "AWAITING_DATA",
        message: "Nenhuma reserva financeira ou saldo registrado.",
        recommendation: "Cadastre suas contas bancárias para iniciar o acompanhamento.",
      },
    ];

    return {
      score: 0,
      status: "AWAITING_DATA",
      statusLabel: "Aguardando Primeiros Dados",
      summary:
        "Cadastre suas contas, rendas e saldos para que a inteligência do sistema avalie sua saúde financeira real.",
      monthlyIncome: monthlyInflows,
      monthlyExpenses: monthlyOutflows,
      monthlyNet,
      debtCommitmentRatio: 0,
      totalDebtOutstanding: emptyMoney,
      emergencyFundMonths: 0,
      overdueBillsCount: 0,
      overdueBillsTotal: emptyMoney,
      pillars: awaitingPillars,
      actionPlan: [
        {
          priority: 1,
          category: "EXPENSE_CUT",
          title: "Cadastre suas primeiras informações",
          description: "Adicione sua renda e contas fixas para começar a ver sua projeção e diagnóstico.",
          impact: "Permite ao sistema calcular sua margem mensal e pontualidade.",
        },
      ],
      tips: [
        "Comece cadastrando sua renda e despesas fixas para calibrar o diagnóstico.",
        "Com as contas cadastradas, você descobre com meses de antecedência se o mês vai fechar positivo.",
      ],
    };
  }

  // 2. Overdue bills
  const overdueObligations = input.obligations.filter((o) => isOpen(o) && o.dueDate < input.asOf);
  const overdueTotalAmount = overdueObligations.reduce(
    (acc, o) => acc + remainingAmount(o).amount,
    0,
  );
  const overdueTotal: Money = { amount: overdueTotalAmount, currency };

  // 3. Debt burden
  const activeDebts = input.debts.filter((d) => d.status !== "SETTLED");
  // What is still owed, not what was contracted: a debt half repaid must not
  // count twice over in the score that tells someone how they are doing.
  const totalDebtPrincipal = activeDebts.reduce(
    (acc, debt) =>
      acc + outstandingPrincipal(debt, input.paidDebtInstallments?.get(debt.id) ?? []).amount,
    0,
  );
  const totalDebtOutstanding: Money = { amount: totalDebtPrincipal, currency };

  const debtCommitmentAmount = averageOf(wholeMonths.map((month) => month.debtCommitment.amount));
  const debtCommitmentRatio =
    baseMonthlyIncomeAmount > 0
      ? Math.min(100, Math.round((debtCommitmentAmount / baseMonthlyIncomeAmount) * 100))
      : 0;

  // 4. Emergency reserve coverage (in months of essential expenses)
  //
  // Measured against the reserve the household actually protected, not the
  // balance in the account. Money that pays next week's bills is not a
  // cushion, and calling it one contradicts the distinction the rest of the
  // product is built on: saldo total and saldo livre are different numbers
  // (docs/DOMAIN.md, README "Reserva não é gasto").
  const averageMonthlyExpense = Math.max(1, monthlyOutflows.amount);
  const emergencyReserve = input.reserves
    .filter((reserve) => !reserve.archived && reserve.purpose === "EMERGENCY")
    .reduce((total, reserve) => total + reserve.currentAmount.amount, 0);
  const protectedLiquidity = Math.max(
    0,
    Math.max(emergencyReserve, Math.min(input.protectedReserve.amount, input.totalCash.amount)),
  );
  const emergencyFundMonths = Number((protectedLiquidity / averageMonthlyExpense).toFixed(1));

  // -------------------------------------------------------------
  // PILLAR 1: Pontualidade & Ausência de Atrasos (Peso: 25%)
  // -------------------------------------------------------------
  let onTimeScore = 100;
  if (overdueObligations.length > 0) {
    onTimeScore = Math.max(0, 70 - overdueObligations.length * 15);
  }
  const onTimePillar: HealthPillar = {
    id: "punctuality",
    title: "Pontualidade e Contas em Dia",
    score: onTimeScore,
    weight: 0.25,
    status: getPillarStatus(onTimeScore),
    message:
      overdueObligations.length === 0
        ? "Nenhuma conta em atraso identificada. Excelente!"
        : `Você possui ${overdueObligations.length} conta(s) em atraso somando ${formatMoneyRaw(overdueTotal)}.`,
    recommendation:
      overdueObligations.length === 0
        ? "Mantenha o calendário de vencimentos atualizado para evitar juros."
        : "Priorize pagar as contas essenciais e com multas diárias mais altas hoje mesmo.",
  };

  // -------------------------------------------------------------
  // PILLAR 2: Grau de Endividamento e Comprometimento (Peso: 30%)
  // -------------------------------------------------------------
  let debtScore = 100;
  if (debtCommitmentRatio > 50) {
    debtScore = Math.max(10, 100 - (debtCommitmentRatio - 30) * 1.8);
  } else if (debtCommitmentRatio > 30) {
    debtScore = Math.max(40, 100 - (debtCommitmentRatio - 20) * 1.5);
  } else if (debtCommitmentRatio > 15) {
    debtScore = 80;
  }
  const debtPillar: HealthPillar = {
    id: "debt_burden",
    title: "Comprometimento com Dívidas",
    score: Math.round(debtScore),
    weight: 0.3,
    status: getPillarStatus(debtScore),
    message:
      debtCommitmentRatio === 0
        ? "Nenhum comprometimento pesado de renda com empréstimos ou juros."
        : `Seus compromissos com dívidas e parcelas consomem ${debtCommitmentRatio}% da sua renda mensal.`,
    recommendation:
      debtCommitmentRatio > 30
        ? "O ideal é manter o comprometimento com dívidas abaixo de 30% da renda para evitar o efeito bola de neve."
        : "Comprometimento sob controle. Continue amortizando para reduzir juros.",
  };

  // -------------------------------------------------------------
  // PILLAR 3: Saldo Livre e Fluxo de Caixa Futuro (Peso: 25%)
  // -------------------------------------------------------------
  let cashFlowScore = 75;
  const firstDeficitMonth = input.forecast.summary.firstDeficitMonth;
  const firstNegativeDate = input.forecast.summary.firstNegativeDate;

  if (firstNegativeDate || firstDeficitMonth) {
    cashFlowScore = 35;
  } else if (monthlyNet.amount > 0) {
    const marginPct = (monthlyNet.amount / baseMonthlyIncomeAmount) * 100;
    cashFlowScore = Math.min(100, Math.round(70 + marginPct * 1.2));
  } else {
    cashFlowScore = 55;
  }
  const cashFlowPillar: HealthPillar = {
    id: "cash_flow",
    title: "Fluxo de Caixa e Superávit",
    score: Math.round(cashFlowScore),
    weight: 0.25,
    status: getPillarStatus(cashFlowScore),
    message: firstNegativeDate
      ? `Atenção: a projeção indica que o saldo pode ficar negativo a partir de ${formatCalendarDate(firstNegativeDate)}.`
      : monthlyNet.amount >= 0
        ? `Você tem uma sobra média estimada de ${formatMoneyRaw(monthlyNet)} no período.`
        : "O total de despesas está muito próximo ou superando a receita prevista.",
    recommendation: firstNegativeDate
      ? "Antecipe cortes de despesas variáveis nas próximas semanas para evitar entrar no cheque especial."
      : "Direcione a sobra mensal para liquidar dívidas ou reforçar a sua reserva.",
  };

  // -------------------------------------------------------------
  // PILLAR 4: Reserva de Emergência e Proteção (Peso: 20%)
  // -------------------------------------------------------------
  let reserveScore = 20;
  if (emergencyFundMonths >= 6) {
    reserveScore = 100;
  } else if (emergencyFundMonths >= 3) {
    reserveScore = 80;
  } else if (emergencyFundMonths >= 1) {
    reserveScore = 55;
  } else if (emergencyFundMonths > 0.3) {
    reserveScore = 35;
  }
  const reservePillar: HealthPillar = {
    id: "emergency_reserve",
    title: "Colchão de Proteção (Reserva)",
    score: Math.round(reserveScore),
    weight: 0.2,
    status: getPillarStatus(reserveScore),
    message:
      emergencyFundMonths >= 3
        ? `Sua reserva protegida cobre aproximadamente ${emergencyFundMonths} meses de custo de vida.`
        : emergencyFundMonths > 0
          ? `Sua reserva protegida cobre cerca de ${emergencyFundMonths} meses de despesas básicas. O resto do saldo já tem destino.`
          : "Você ainda não possui uma reserva de emergência protegida.",
    recommendation:
      emergencyFundMonths < 3
        ? "Construa um primeiro colchão de emergência de 1 mês de gastos básicos antes de investimentos de risco."
        : "Reserva de emergência saudável. Proteja-a para imprevistos reais.",
  };

  // Calculate final weighted score (0 to 100)
  const pillars = [onTimePillar, debtPillar, cashFlowPillar, reservePillar];
  const finalScore = Math.round(pillars.reduce((acc, p) => acc + p.score * p.weight, 0));

  const status = getHealthStatus(finalScore);
  const statusLabel = getHealthStatusLabel(status);
  const summary = buildSummaryText(
    status,
    finalScore,
    overdueObligations.length,
    debtCommitmentRatio,
  );

  // Action plan generation
  const actionPlan = buildActionPlan({
    overdueCount: overdueObligations.length,
    debtCommitmentRatio,
    emergencyFundMonths,
    hasDeficit: !!firstNegativeDate,
    monthlyNet,
  });

  const tips = buildFinancialTips(debtCommitmentRatio, emergencyFundMonths);

  return {
    score: finalScore,
    status,
    statusLabel,
    summary,
    monthlyIncome: monthlyInflows,
    monthlyExpenses: monthlyOutflows,
    monthlyNet,
    debtCommitmentRatio,
    totalDebtOutstanding,
    emergencyFundMonths,
    overdueBillsCount: overdueObligations.length,
    overdueBillsTotal: overdueTotal,
    pillars,
    actionPlan,
    tips,
  };
}

/** The same five bands rate a single pillar and the score as a whole. */
function getPillarStatus(score: number): HealthStatus {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "HEALTHY";
  if (score >= 50) return "BALANCED";
  if (score >= 30) return "ATTENTION";
  return "CRITICAL";
}

const getHealthStatus = getPillarStatus;

export function getHealthStatusLabel(status: HealthStatus): string {
  switch (status) {
    case "AWAITING_DATA":
      return "Aguardando Primeiros Dados";
    case "EXCELLENT":
      return "Excelente Saúde Financeira";
    case "HEALTHY":
      return "Saúde Financeira Boa";
    case "BALANCED":
      return "Em Equilíbrio (Atenção a Imprevistos)";
    case "ATTENTION":
      return "Alerta: Orçamento Pressionado";
    case "CRITICAL":
      return "Crítico: Risco de Inadimplência";
  }
}

function buildSummaryText(
  status: HealthStatus,
  score: number,
  overdueCount: number,
  debtRatio: number,
): string {
  if (overdueCount > 0) {
    return `Seu índice está em ${score}/100 principalmente por conta de faturas ou contas pendentes. O próximo passo é olhar primeiro o que pode cortar serviço essencial ou crescer com juros diários.`;
  }
  if (debtRatio > 40) {
    return `Seu score é ${score}/100. Dívidas e parcelamentos ocupam uma parte alta da renda (${debtRatio}%), então há pouca margem para imprevistos.`;
  }
  if (status === "CRITICAL" || status === "ATTENTION") {
    return `Seu diagnóstico aponta um mês sensível (${score}/100). Há risco de faltar caixa nos próximos meses; vale revisar compromissos antes de assumir novas parcelas.`;
  }
  if (status === "BALANCED") {
    return `Você está equilibrado (${score}/100), mas pequenas surpresas podem desestabilizar o orçamento. O foco agora é aumentar a sobra mensal e criar a reserva de emergência.`;
  }
  return `Sua pontuação é ${score}/100. As contas estão em dia, as dívidas estão sob controle e o fluxo de caixa está positivo.`;
}

function buildActionPlan(params: {
  overdueCount: number;
  debtCommitmentRatio: number;
  emergencyFundMonths: number;
  hasDeficit: boolean;
  monthlyNet: Money;
}): ActionPlanStep[] {
  const steps: ActionPlanStep[] = [];
  let priority = 1;

  if (params.overdueCount > 0) {
    steps.push({
      priority: priority++,
      category: "EMERGENCY",
      title: "Estancar juros e regularizar contas vencidas",
      description: `Olhe as ${params.overdueCount} contas em atraso e comece pelas que cortam serviço essencial, têm garantia ou crescem com juros diários.`,
      impact: "Reduz multa, juros e risco de interrupção de serviço.",
      estimatedDaysToComplete: 7,
    });
  }

  if (params.debtCommitmentRatio > 25) {
    steps.push({
      priority: priority++,
      category: "DEBT",
      title: "Plano de redução das dívidas",
      description:
        "Compare o método bola de neve, que tira boletos pequenos da frente, com o avalanche, que prioriza juros maiores.",
      impact: `Ajuda a reorganizar os ${params.debtCommitmentRatio}% da renda hoje comprometidos.`,
      estimatedDaysToComplete: 90,
    });
  }

  if (params.hasDeficit || params.monthlyNet.amount <= 0) {
    steps.push({
      priority: priority++,
      category: "EXPENSE_CUT",
      title: "Revisão de gastos que podem esperar",
      description:
        "Procure assinaturas pouco usadas, compras que podem esperar e serviços fixos com margem de negociação.",
      impact: "Evita o uso de cheque especial ou rotativo de cartão de crédito.",
      estimatedDaysToComplete: 15,
    });
  }

  if (params.emergencyFundMonths < 3) {
    steps.push({
      priority: priority++,
      category: "SAVINGS",
      title: "Montar Reserva de Emergência Inicial",
      description:
        "Guarde pelo menos o equivalente a 1 mês de gastos essenciais onde dê para resgatar no mesmo dia e sem risco de sacar menos do que você guardou.",
      impact: "Garante segurança para imprevistos de saúde ou manutenção.",
      estimatedDaysToComplete: 60,
    });
  }

  steps.push({
    priority: priority++,
    category: "FUTURE",
    title: "Construir Projeção e Metas de Liberdade Financeira",
    description:
      "Acompanhe mensalmente seu progresso na Linha do Tempo e comemore cada marco de quitação e investimento conquistado.",
    impact: "Transforma sua relação com o dinheiro a longo prazo.",
  });

  return steps;
}

function buildFinancialTips(debtRatio: number, reserveMonths: number): string[] {
  const tips: string[] = [
    "A regra 50-30-20: Tente direcionar 50% da renda para necessidades básicas, 30% para estilo de vida e 20% para quitação de dívidas e futuro.",
    "Ao usar cartão de crédito, lembre-se: ele é uma forma de pagamento, não uma extensão do salário. Sempre pague a fatura integral.",
  ];

  if (debtRatio > 30) {
    // Deliberately not "procure um consignado". Telling someone whose income
    // is already 30% committed to take on new credit is how the hole gets
    // deeper, and it is a credit recommendation the terms of use rule out.
    // What is safe to say is the criterion, and where to check it.
    tips.push(
      "Antes de trocar uma dívida cara por outra, compare pelo CET (Custo Efetivo Total), não pela parcela: uma parcela menor com prazo maior quase sempre custa mais no fim. Peça o CET por escrito das duas.",
    );
  }

  if (reserveMonths < 1) {
    tips.push(
      "Comece pequeno: mesmo R$ 50 ou R$ 100 por semana já cria uma barreira contra imprevistos.",
    );
  }

  return tips;
}

function formatMoneyRaw(money: Money): string {
  const isNeg = money.amount < 0;
  const abs = Math.abs(money.amount);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${isNeg ? "- " : ""}R$ ${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`;
}

/** Mean of a list of cent amounts, rounded. Zero for an empty list. */
function averageOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}
