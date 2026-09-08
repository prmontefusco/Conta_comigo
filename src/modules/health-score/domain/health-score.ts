import type { Money } from "@/core/money/money";

export type HealthTier = "CRITICAL" | "ATTENTION" | "HEALTHY" | "EXCELLENT" | "CALIBRATING";

export interface PillarScore {
  readonly current: number;
  readonly max: number;
  readonly label: string;
  readonly feedback: string;
}

export interface BadgeItem {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly description: string;
  readonly unlocked: boolean;
}

export interface FinancialHealthScore {
  readonly totalScore: number; // 0 to 1000
  readonly tier: HealthTier;
  readonly tierLabel: string;
  readonly tierDescription: string;
  readonly pillars: {
    readonly incomeCommitment: PillarScore; // 0 to 300
    readonly emergencyReserve: PillarScore; // 0 to 250
    readonly punctuality: PillarScore; // 0 to 250
    readonly debtTrajectory: PillarScore; // 0 to 200
  };
  readonly badges: readonly BadgeItem[];
  readonly topRecommendation: string;
}

export interface HealthScoreInput {
  readonly monthlyIncome: Money;
  readonly monthlyEssentialOutflows: Money;
  readonly reserveBalance: Money;
  readonly overdueBillsCount: number;
  readonly totalDebtsBalance: Money;
  readonly impulseSavingsCount?: number;
  readonly hasBudgetsConfigured?: boolean;
  readonly hasRegisteredBills?: boolean;
  readonly hasActiveAccounts?: boolean;
}

/**
 * Calcula o pilar de comprometimento de renda (0 a 300 pontos).
 */
export function calculateIncomeCommitmentPillar(
  income: Money,
  outflows: Money,
): PillarScore {
  const max = 300;
  if (income.amount <= 0) {
    return {
      current: 30,
      max,
      label: "Comprometimento de Renda",
      feedback: "Sem renda cadastrada ou renda zerada. Cadastre entradas para calibrar.",
    };
  }

  const ratio = outflows.amount / income.amount;

  if (ratio <= 0.5) {
    return {
      current: 300,
      max,
      label: "Comprometimento de Renda",
      feedback: "Excelente! Menos de 50% da renda está comprometida com contas fixas.",
    };
  }
  if (ratio <= 0.7) {
    return {
      current: 220,
      max,
      label: "Comprometimento de Renda",
      feedback: "Bom. Gastos fixos entre 50% e 70% da renda líquida.",
    };
  }
  if (ratio <= 0.9) {
    return {
      current: 120,
      max,
      label: "Comprometimento de Renda",
      feedback: "Atenção: Entre 70% e 90% da renda comprometida com contas fixas.",
    };
  }
  return {
    current: 40,
    max,
    label: "Comprometimento de Renda",
    feedback: "Crítico: Mais de 90% da renda já nasce comprometida.",
  };
}

/**
 * Calcula o pilar de reserva de emergência (0 a 250 pontos).
 */
export function calculateEmergencyReservePillar(
  reserve: Money,
  monthlyOutflows: Money,
): PillarScore {
  const max = 250;
  const monthlyNeed = Math.max(1, monthlyOutflows.amount);
  const monthsCovered = reserve.amount / monthlyNeed;

  if (monthsCovered >= 6) {
    return {
      current: 250,
      max,
      label: "Reserva de Emergência",
      feedback: `Excelente! ${monthsCovered.toFixed(1)} meses de custos essenciais cobertos.`,
    };
  }
  if (monthsCovered >= 3) {
    return {
      current: 200,
      max,
      label: "Reserva de Emergência",
      feedback: `Forte. ${monthsCovered.toFixed(1)} meses garantidos de proteção.`,
    };
  }
  if (monthsCovered >= 1) {
    return {
      current: 140,
      max,
      label: "Reserva de Emergência",
      feedback: `Inicial. ${monthsCovered.toFixed(1)} mês coberto. Meta recomendada: 3 meses.`,
    };
  }
  if (reserve.amount > 0) {
    return {
      current: 70,
      max,
      label: "Reserva de Emergência",
      feedback: "Em construção. Qualquer valor poupado já evita novas dívidas.",
    };
  }
  return {
    current: 15,
    max,
    label: "Reserva de Emergência",
    feedback: "Vulnerável. Sem reserva financeira para imprevistos imediatos.",
  };
}

/**
 * Calcula o pilar de pontualidade de vencimentos (0 a 250 pontos).
 */
export function calculatePunctualityPillar(overdueCount: number): PillarScore {
  const max = 250;
  if (overdueCount === 0) {
    return {
      current: 250,
      max,
      label: "Pontualidade de Contas",
      feedback: "Impecável! Nenhuma conta ou boleto em atraso.",
    };
  }
  if (overdueCount === 1) {
    return {
      current: 150,
      max,
      label: "Pontualidade de Contas",
      feedback: "1 conta vencida pendente. Priorize regularizá-la para não acumular juros.",
    };
  }
  if (overdueCount <= 3) {
    return {
      current: 80,
      max,
      label: "Pontualidade de Contas",
      feedback: `${overdueCount} contas vencidas. Risco de corte de serviços e negativação.`,
    };
  }
  return {
    current: 20,
    max,
    label: "Pontualidade de Contas",
    feedback: `${overdueCount} contas em atraso. Use a tela 'Pagar Primeiro' com urgência.`,
  };
}

/**
 * Calcula o pilar de trajetória da dívida (0 a 200 pontos).
 */
export function calculateDebtTrajectoryPillar(totalDebt: Money): PillarScore {
  const max = 200;
  if (totalDebt.amount <= 0) {
    return {
      current: 200,
      max,
      label: "Trajetória da Dívida",
      feedback: "Livre de dívidas bancárias ou empréstimos onerosos!",
    };
  }
  if (totalDebt.amount < 500000) {
    // Menos de R$ 5.000
    return {
      current: 140,
      max,
      label: "Trajetória da Dívida",
      feedback: "Endividamento moderado e perfeitamente amortizável com método bola de neve.",
    };
  }
  if (totalDebt.amount < 3000000) {
    // Menos de R$ 30.000
    return {
      current: 90,
      max,
      label: "Trajetória da Dívida",
      feedback: "Volume significativo de dívidas. Foco total em conter juros e renegociar.",
    };
  }
  return {
    current: 30,
    max,
    label: "Trajetória da Dívida",
    feedback: "Endividamento pesado. Avalie os requisitos da Lei do Superendividamento.",
  };
}

/**
 * Avalia as conquistas (badges) com base no panorama do usuário.
 */
export function evaluateBadges(input: HealthScoreInput): readonly BadgeItem[] {
  const monthsCovered =
    input.monthlyEssentialOutflows.amount > 0
      ? input.reserveBalance.amount / input.monthlyEssentialOutflows.amount
      : 0;

  // Só desbloqueia pontualidade se houver contas cadastradas
  const hasBills = input.hasRegisteredBills ?? (input.monthlyEssentialOutflows.amount > 0);
  // Só desbloqueia livre das amarras se houver alguma conta, renda ou conta bancária
  const hasActivity = input.hasActiveAccounts ?? (input.monthlyIncome.amount > 0 || hasBills);

  return [
    {
      id: "SHIELD",
      title: "Escudo de Emergência",
      icon: "🛡️",
      description: "Possui pelo menos 1 mês de custos essenciais guardados em reserva.",
      unlocked: monthsCovered >= 1,
    },
    {
      id: "PUNCTUALITY",
      title: "Pontualidade Britânica",
      icon: "⚡",
      description: "Zero contas ou boletos em atraso no momento.",
      unlocked: Boolean(hasBills && input.overdueBillsCount === 0),
    },
    {
      id: "DEBT_FREE",
      title: "Livre das Amarras",
      icon: "📉",
      description: "Sem dívidas financeiras ativas registradas.",
      unlocked: Boolean(hasActivity && input.totalDebtsBalance.amount <= 0),
    },
    {
      id: "SELF_CONTROL",
      title: "Mestre do Autocontrole",
      icon: "🧘",
      description: "Completou período de reflexão de 24h e desistiu de uma compra por impulso.",
      unlocked: (input.impulseSavingsCount ?? 0) > 0,
    },
    {
      id: "ORGANIZED",
      title: "Casa em Ordem",
      icon: "📊",
      description: "Orçamento e planejamento financeiro estruturados.",
      unlocked: Boolean(input.hasBudgetsConfigured),
    },
  ];
}

/**
 * Calcula o Health Score consolidado (0 a 1000) e os badges.
 */
export function calculateFinancialHealthScore(
  input: HealthScoreInput,
): FinancialHealthScore {
  const hasInitialData = Boolean(
    (input.hasActiveAccounts ?? false) ||
    (input.hasRegisteredBills ?? false) ||
    input.monthlyIncome.amount > 0 ||
    input.monthlyEssentialOutflows.amount > 0 ||
    input.totalDebtsBalance.amount > 0 ||
    input.reserveBalance.amount > 0,
  );

  if (!hasInitialData) {
    return {
      totalScore: 0,
      tier: "CALIBRATING",
      tierLabel: "Aguardando Dados",
      tierDescription: "Cadastre suas contas e rendas para calcular sua pontuação de saúde financeira.",
      pillars: {
        incomeCommitment: { current: 0, max: 300, label: "Comprometimento de Renda", feedback: "Cadastre sua renda para iniciar o cálculo." },
        emergencyReserve: { current: 0, max: 250, label: "Reserva de Emergência", feedback: "Registre sua reserva ou contas com saldo." },
        punctuality: { current: 0, max: 250, label: "Pontualidade de Contas", feedback: "Cadastre contas fixas para acompanhar pontualidade." },
        debtTrajectory: { current: 0, max: 200, label: "Trajetória da Dívida", feedback: "Cadastre empréstimos ou dívidas se houver." },
      },
      badges: evaluateBadges(input),
      topRecommendation: "Cadastre sua renda mensal e contas fixas para ativar a pontuação de saúde financeira.",
    };
  }

  const incomePillar = calculateIncomeCommitmentPillar(
    input.monthlyIncome,
    input.monthlyEssentialOutflows,
  );
  const reservePillar = calculateEmergencyReservePillar(
    input.reserveBalance,
    input.monthlyEssentialOutflows,
  );
  const punctualityPillar = calculatePunctualityPillar(input.overdueBillsCount);
  const debtPillar = calculateDebtTrajectoryPillar(input.totalDebtsBalance);

  const totalScore = Math.min(
    1000,
    Math.max(
      0,
      incomePillar.current +
        reservePillar.current +
        punctualityPillar.current +
        debtPillar.current,
    ),
  );

  let tier: HealthTier;
  let tierLabel: string;
  let tierDescription: string;

  if (totalScore >= 800) {
    tier = "EXCELLENT";
    tierLabel = "Excelente";
    tierDescription = "Finanças blindadas com alta resiliência e folga orçamentária.";
  } else if (totalScore >= 600) {
    tier = "HEALTHY";
    tierLabel = "Saudável";
    tierDescription = "Balanço equilibrado e sob controle com margem de segurança.";
  } else if (totalScore >= 400) {
    tier = "ATTENTION";
    tierLabel = "Atenção";
    tierDescription = "Orçamento vulnerável a imprevistos. Qualquer choque pode gerar dívida.";
  } else {
    tier = "CRITICAL";
    tierLabel = "Crítico";
    tierDescription = "Comprometimento severo com risco eminente de insolvência financeira.";
  }

  // Recomendação principal para o próximo salto de pontuação
  let topRecommendation = "";
  if (input.overdueBillsCount > 0) {
    topRecommendation =
      "Liquide ou renegocie primeiro as contas em atraso para recuperar até 170 pontos.";
  } else if (reservePillar.current < 140) {
    topRecommendation =
      "Guarde o equivalente a 1 mês de contas fixas na reserva para destravar o badge 'Escudo de Emergência'.";
  } else if (debtPillar.current < 140) {
    topRecommendation =
      "Adote o plano de amortização acelerada para eliminar as dívidas de juros altos.";
  } else {
    topRecommendation =
      "Mantenha os aportes na reserva para alcançar 6 meses de tranquilidade absoluta.";
  }

  return {
    totalScore,
    tier,
    tierLabel,
    tierDescription,
    pillars: {
      incomeCommitment: incomePillar,
      emergencyReserve: reservePillar,
      punctuality: punctualityPillar,
      debtTrajectory: debtPillar,
    },
    badges: evaluateBadges(input),
    topRecommendation,
  };
}
