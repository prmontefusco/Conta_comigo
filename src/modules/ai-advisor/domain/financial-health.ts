import type { CalendarDate } from "@/core/date/calendar-date";
import { type Money, subtract } from "@/core/money/money";
import type { CreditCard, CardStatement } from "@/modules/cards/domain/credit-card";
import type { Debt } from "@/modules/debts/domain/debt";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import { isOpen, remainingAmount, type Obligation } from "@/modules/obligations/domain/obligation";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import type { Reserve } from "@/modules/reserves/domain/reserve";

export type HealthStatus = "CRITICAL" | "ATTENTION" | "BALANCED" | "HEALTHY" | "EXCELLENT";

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
}

/**
 * Evaluates the household's financial health based on real projections,
 * debt levels, recurring obligations and emergency reserve.
 */
export function evaluateFinancialHealth(
  input: EvaluateFinancialHealthInput,
): FinancialHealthReport {
  const currency = input.totalCash.currency;

  // 1. Monthly income and committed expenses (from the forecast summary)
  const monthlyInflows = input.forecast.summary.expectedInflows;
  const monthlyOutflows = input.forecast.summary.committedOutflows;
  const monthlyNet = subtract(monthlyInflows, monthlyOutflows);

  // Fallback monthly base income from recurring rules if forecast has few events
  const recurringIncomes = input.recurringRules
    .filter((r) => r.direction === "INFLOW")
    .reduce((acc, r) => acc + r.amount.amount, 0);

  const baseMonthlyIncomeAmount = Math.max(
    monthlyInflows.amount,
    recurringIncomes,
    input.totalCash.amount > 0 ? input.totalCash.amount : 1,
  );

  // 2. Overdue bills
  const overdueObligations = input.obligations.filter(
    (o) => isOpen(o) && o.dueDate < input.asOf,
  );
  const overdueTotalAmount = overdueObligations.reduce(
    (acc, o) => acc + remainingAmount(o).amount,
    0,
  );
  const overdueTotal: Money = { amount: overdueTotalAmount, currency };

  // 3. Debt burden
  const activeDebts = input.debts.filter((d) => d.status !== "SETTLED");
  const totalDebtPrincipal = activeDebts.reduce(
    (acc, d) => acc + d.principalContracted.amount,
    0,
  );
  const totalDebtOutstanding: Money = { amount: totalDebtPrincipal, currency };

  const debtCommitmentAmount = input.forecast.summary.debtCommitment.amount;
  const debtCommitmentRatio =
    baseMonthlyIncomeAmount > 0
      ? Math.min(100, Math.round((debtCommitmentAmount / baseMonthlyIncomeAmount) * 100))
      : 0;

  // 4. Emergency reserve coverage (in months of essential expenses)
  const averageMonthlyExpense = Math.max(1, monthlyOutflows.amount);
  const availableLiquidity = Math.max(0, input.totalCash.amount);
  const emergencyFundMonths = Number(
    (availableLiquidity / averageMonthlyExpense).toFixed(1),
  );

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
        : `Seus compromissos com dívidas e parcelas consom ${debtCommitmentRatio}% da sua renda mensal.`,
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
      ? `Atenção: A projeção indica que o saldo pode ficar negativo a partir de ${firstNegativeDate}.`
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
        ? `Você possui reserva para aproximadamente ${emergencyFundMonths} meses de custo de vida.`
        : emergencyFundMonths > 0
          ? `Sua liquidez atual cobre cerca de ${emergencyFundMonths} meses de despesas básicas.`
          : "Você ainda não possui uma reserva de emergência protegida.",
    recommendation:
      emergencyFundMonths < 3
        ? "Construa um primeiro colchão de emergência de 1 mês de gastos básicos antes de investimentos de risco."
        : "Reserva de emergência saudável. Proteja-a para imprevistos reais.",
  };

  // Calculate final weighted score (0 to 100)
  const pillars = [onTimePillar, debtPillar, cashFlowPillar, reservePillar];
  const finalScore = Math.round(
    pillars.reduce((acc, p) => acc + p.score * p.weight, 0),
  );

  const status = getHealthStatus(finalScore);
  const statusLabel = getHealthStatusLabel(status);
  const summary = buildSummaryText(status, finalScore, overdueObligations.length, debtCommitmentRatio);

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

function getPillarStatus(score: number): HealthStatus {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "HEALTHY";
  if (score >= 50) return "BALANCED";
  if (score >= 30) return "ATTENTION";
  return "CRITICAL";
}

function getHealthStatus(score: number): HealthStatus {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "HEALTHY";
  if (score >= 50) return "BALANCED";
  if (score >= 30) return "ATTENTION";
  return "CRITICAL";
}

export function getHealthStatusLabel(status: HealthStatus): string {
  switch (status) {
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
    return `Seu índice está em ${score}/100 principalmente por conta de faturas ou contas pendentes. A prioridade absoluta é regularizar esses débitos para cessar multas diárias.`;
  }
  if (debtRatio > 40) {
    return `Seu score é ${score}/100. As dívidas e parcelamentos estão absorvendo uma fatia muito alta da sua renda (${debtRatio}%), reduzindo sua margem de segurança.`;
  }
  if (status === "CRITICAL" || status === "ATTENTION") {
    return `Seu diagnóstico aponta vulnerabilidade financeira (${score}/100). Há risco de faltar caixa nos próximos meses se os gastos não forem ajustados.`;
  }
  if (status === "BALANCED") {
    return `Você está equilibrado (${score}/100), mas pequenas surpresas podem desestabilizar o orçamento. O foco agora é aumentar a sobra mensal e criar a reserva de emergência.`;
  }
  return `Parabéns! Sua pontuação é ${score}/100. Suas contas estão em dia, as dívidas sob controle e o fluxo de caixa opera no positivo.`;
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
      description: `Negocie ou quite imediatamente as ${params.overdueCount} contas em atraso para evitar bloqueio de serviços e cobranças abusivas.`,
      impact: "Elimina multas de mora e recupera sua tranquilidade.",
      estimatedDaysToComplete: 7,
    });
  }

  if (params.debtCommitmentRatio > 25) {
    steps.push({
      priority: priority++,
      category: "DEBT",
      title: "Plano de Quitação Acelerada de Dívidas",
      description:
        "Aplique o Método Bola de Neve (pagar as menores primeiro para liberar fluxo) ou Avalanche (as de maior juros primeiro).",
      impact: `Libera até ${params.debtCommitmentRatio}% da sua renda mensal.`,
      estimatedDaysToComplete: 90,
    });
  }

  if (params.hasDeficit || params.monthlyNet.amount <= 0) {
    steps.push({
      priority: priority++,
      category: "EXPENSE_CUT",
      title: "Revisão e corte de despesas não essenciais",
      description:
        "Identifique assinaturas não utilizadas, compras por impulso e renegocie planos de internet, telefonia e tarifas bancárias.",
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
        "Guarde pelo menos o equivalente a 1 mês de gastos essenciais em uma aplicação líquida e segura (CDB 100% CDI ou Tesouro Selic).",
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

function buildFinancialTips(
  debtRatio: number,
  reserveMonths: number,
): string[] {
  const tips: string[] = [
    "A regra 50-30-20: Tente direcionar 50% da renda para necessidades básicas, 30% para estilo de vida e 20% para quitação de dívidas e futuro.",
    "Ao usar cartão de crédito, lembre-se: ele é uma forma de pagamento, não uma extensão do salário. Sempre pague a fatura integral.",
  ];

  if (debtRatio > 30) {
    tips.push(
      "Dica de ouro para dívidas: Se o juros do cartão ou cheque especial for alto, busque um empréstimo consignado ou com garantia com taxa menor para trocar uma dívida cara por uma barata.",
    );
  }

  if (reserveMonths < 1) {
    tips.push(
      "Comece pequeno: Guardar mesmo R$ 50 ou R$ 100 por semana cria o hábito e constrói sua barreira contra dívidas futuras.",
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
