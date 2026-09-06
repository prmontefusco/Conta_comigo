import type { UserPlan } from "./subscription";

/**
 * O que o plano gratuito comporta.
 *
 * Antes disto não havia limite nenhum: `isPremium` só escondia anúncios, e os
 * sete recursos vendidos como Premium estavam liberados para todo mundo. Sem
 * anúncios, a assinatura passou a ser a única receita — então os limites
 * precisam existir de verdade, e precisam estar num lugar só, senão a tela de
 * planos e o produto acabam contando histórias diferentes.
 *
 * ## Onde a linha foi traçada
 *
 * O público é quem está endividado, e a maior parte dele não tem como pagar
 * nada. Um limite que impeça essa pessoa de **enxergar a própria situação**
 * mata o propósito do produto. Por isso o gratuito mantém, para sempre e sem
 * teto:
 *
 * - todas as contas, dívidas e lançamentos que a pessoa quiser cadastrar;
 * - o diagnóstico honesto, incluindo o aviso de plano inviável;
 * - a tela de emergência e os roteiros de negociação;
 * - o cálculo de multa e juros de mora;
 * - os guias de educação financeira.
 *
 * O que fica no Premium é a **comodidade**: horizonte longo de projeção,
 * leitura automática de documentos por IA, o painel compartilhado com mais
 * gente e mais de um cartão. Coisas que ajudam a organizar melhor, não coisas
 * de que alguém precisa para sair do buraco.
 */

export interface PlanLimits {
  /** Pessoas com acesso ao grupo, incluindo quem criou. */
  readonly members: number;
  /** Cartões de crédito cadastrados. */
  readonly creditCards: number;
  /** Até quantos meses à frente a projeção mostra. */
  readonly forecastMonths: number;
  /** Leitura de fatura, boleto e comprovante por foto. */
  readonly documentReading: boolean;
  /** Diagnóstico redigido por modelo de linguagem, além do motor local. */
  readonly aiAdvisor: boolean;
}

export const FREE_LIMITS: PlanLimits = {
  members: 2,
  creditCards: 2,
  forecastMonths: 3,
  documentReading: false,
  aiAdvisor: false,
};

export const PREMIUM_LIMITS: PlanLimits = {
  members: 8,
  creditCards: 12,
  forecastMonths: 13,
  documentReading: true,
  aiAdvisor: true,
};

export function limitsFor(plan: UserPlan): PlanLimits {
  return plan === "PREMIUM" ? PREMIUM_LIMITS : FREE_LIMITS;
}

export type LimitedResource = "members" | "creditCards";

export interface LimitCheck {
  readonly allowed: boolean;
  readonly limit: number;
  readonly current: number;
  /** Frase pronta para a tela quando `allowed` é falso. */
  readonly message: string;
}

const RESOURCE_LABELS: Record<LimitedResource, { one: string; many: string }> = {
  members: { one: "pessoa no grupo", many: "pessoas no grupo" },
  creditCards: { one: "cartão", many: "cartões" },
};

/**
 * Se cabe mais um.
 *
 * A mensagem diz o teto e o que muda com o Premium, porque um bloqueio sem
 * explicação é indistinguível de um defeito.
 */
export function canAddOne(resource: LimitedResource, plan: UserPlan, current: number): LimitCheck {
  const limit = limitsFor(plan)[resource];
  const allowed = current < limit;
  const label = limit === 1 ? RESOURCE_LABELS[resource].one : RESOURCE_LABELS[resource].many;
  const premiumLimit = PREMIUM_LIMITS[resource];

  return {
    allowed,
    limit,
    current,
    message: allowed
      ? ""
      : plan === "PREMIUM"
        ? `O limite é de ${limit} ${label}. Se você precisa de mais, escreva para a gente.`
        : `O plano gratuito comporta ${limit} ${label}. O Premium vai até ${premiumLimit}.`,
  };
}
