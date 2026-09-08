import type { Instant } from "@/core/date/calendar-date";
import {
  CYCLE_LABELS,
  daysUntilExpiry,
  isPendingEmailVerificationForTrial,
  isWithinRenewalWindow,
  planSource,
  resolveEffectivePlan,
  trialDaysRemaining,
  trialEndsAt,
  TRIAL_DAYS,
  type Subscription,
  type SubscriptionCycle,
  type UserPlan,
} from "./subscription";

/**
 * O estado do plano, em uma estrutura só.
 *
 * As peças já existiam — `planSource`, `daysUntilExpiry`, `trialDaysRemaining`,
 * `isWithinRenewalWindow` — e cada tela juntava as suas do seu jeito. O
 * resultado era que a pessoa não conseguia responder perguntas simples: **qual
 * plano eu contratei, mensal ou anual? até quando ele vale? quanto falta?**
 * O ciclo, em particular, estava gravado na assinatura e não aparecia em lugar
 * nenhum da interface.
 *
 * Juntar aqui, e não em cada tela, é o que garante que o cabeçalho, a tela de
 * assinatura e a de "Mais" nunca discordem sobre quantos dias faltam.
 *
 * ## Sobre cancelamento
 *
 * Não existe. O pagamento é avulso: cada compra vale por um período e termina
 * nele, sem cartão guardado e sem cobrança recorrente. Um botão "cancelar
 * assinatura" aqui só poderia encurtar o que a pessoa já pagou, sugerindo que
 * ela evita uma cobrança que nunca aconteceria. O que a tela deve dizer é o
 * fato tranquilizador: nada será cobrado de novo.
 */

/** Abaixo disto, o fim do teste vira aviso — cedo o bastante para decidir. */
export const TRIAL_ENDING_SOON_DAYS = 7;

export type PlanStatusKind =
  /** Assinatura paga, ativa e dentro do prazo. */
  | "PAID"
  /** Os trinta dias de teste correndo. */
  | "TRIAL"
  /** O teste existiria, mas falta confirmar o e-mail para liberá-lo. */
  | "TRIAL_PENDING_EMAIL"
  /** Plano gratuito: o teste acabou, ou a assinatura venceu. */
  | "FREE";

export interface PlanStatus {
  readonly kind: PlanStatusKind;
  /** O plano que vale agora, para decidir o que a interface libera. */
  readonly plan: UserPlan;
  readonly cycle: SubscriptionCycle | null;
  /** "Mensal" ou "Anual". Null quando não há ciclo contratado. */
  readonly cycleLabel: string | null;
  /** Dias que faltam do que estiver valendo — pago ou teste. Null sem prazo. */
  readonly daysRemaining: number | null;
  /** Quando o direito atual termina. */
  readonly endsAt: Instant | null;
  /** Perto do fim: vale avisar, sem fabricar urgência. */
  readonly endingSoon: boolean;
  /** A renovação antecipada está aberta. */
  readonly canRenew: boolean;
  /**
   * Já houve uma assinatura paga.
   *
   * Muda o verbo da tela: para quem já pagou uma vez, "renovar"; para quem
   * nunca pagou, "assinar". Chamar de renovação a primeira compra confunde.
   */
  readonly hadPaidPlan: boolean;
  /** Existe cobrança aberta aguardando confirmação. */
  readonly pendingCharge: boolean;
  /** Total de dias do teste, para a frase "restam 8 dos 30". */
  readonly trialTotalDays: number;
}

export interface DescribePlanStatusInput {
  readonly subscription: Subscription | null | undefined;
  /** `profile.createdAt`: o teste é derivado dela, nunca gravado. */
  readonly accountCreatedAt: Instant | undefined;
  readonly emailVerified: boolean;
  readonly now?: Date;
}

export function describePlanStatus(input: DescribePlanStatusInput): PlanStatus {
  const now = input.now ?? new Date();
  const { subscription, accountCreatedAt, emailVerified } = input;

  const plan = resolveEffectivePlan(subscription, now, accountCreatedAt, emailVerified);
  const source = planSource(subscription, accountCreatedAt, now, emailVerified);
  const pendingCharge = subscription?.status === "PENDING";

  // "Já pagou alguma vez" não é o mesmo que "está pago agora": uma assinatura
  // vencida continua com `activatedAt` e `cycle` preenchidos, e é justamente
  // esse caso que precisa ler "renovar".
  const hadPaidPlan = Boolean(subscription?.activatedAt);

  if (source === "PAID") {
    const daysRemaining = daysUntilExpiry(subscription, now);
    return {
      kind: "PAID",
      plan,
      cycle: subscription?.cycle ?? null,
      cycleLabel: subscription?.cycle ? CYCLE_LABELS[subscription.cycle] : null,
      daysRemaining,
      endsAt: subscription?.expiresAt ?? null,
      // Perto do fim é exatamente quando há o que fazer a respeito: a janela
      // de renovação. Avisar antes disso seria pedir uma ação que a rota
      // ainda recusaria.
      endingSoon: isWithinRenewalWindow(subscription, now),
      canRenew: isWithinRenewalWindow(subscription, now),
      hadPaidPlan: true,
      pendingCharge,
      trialTotalDays: TRIAL_DAYS,
    };
  }

  if (source === "TRIAL") {
    const daysRemaining = trialDaysRemaining(accountCreatedAt, now);
    return {
      kind: "TRIAL",
      plan,
      cycle: null,
      cycleLabel: null,
      daysRemaining,
      endsAt: trialEndsAt(accountCreatedAt),
      endingSoon: daysRemaining <= TRIAL_ENDING_SOON_DAYS,
      // Assinar durante o teste é compra, não renovação — e continua aberto.
      canRenew: false,
      hadPaidPlan,
      pendingCharge,
      trialTotalDays: TRIAL_DAYS,
    };
  }

  if (isPendingEmailVerificationForTrial(subscription, accountCreatedAt, emailVerified, now)) {
    return {
      kind: "TRIAL_PENDING_EMAIL",
      plan,
      cycle: null,
      cycleLabel: null,
      daysRemaining: trialDaysRemaining(accountCreatedAt, now),
      endsAt: trialEndsAt(accountCreatedAt),
      // Não é um prazo acabando: é um passo pendente. Tratar como urgência
      // apressaria quem só precisa abrir um e-mail.
      endingSoon: false,
      canRenew: false,
      hadPaidPlan,
      pendingCharge,
      trialTotalDays: TRIAL_DAYS,
    };
  }

  return {
    kind: "FREE",
    plan,
    cycle: null,
    cycleLabel: null,
    daysRemaining: null,
    endsAt: null,
    endingSoon: false,
    canRenew: false,
    hadPaidPlan,
    pendingCharge,
    trialTotalDays: TRIAL_DAYS,
  };
}

/**
 * O nome do plano como a pessoa deve lê-lo.
 *
 * "Premium anual" e não "PREMIUM/YEARLY": quem pagou precisa reconhecer o que
 * comprou, e o ciclo faz parte disso.
 */
export function planStatusLabel(status: PlanStatus): string {
  switch (status.kind) {
    case "PAID":
      return status.cycleLabel ? `Premium ${status.cycleLabel.toLowerCase()}` : "Premium";
    case "TRIAL":
      return "Premium — período de teste";
    case "TRIAL_PENDING_EMAIL":
      return "Gratuito — teste aguardando confirmação";
    case "FREE":
      return "Gratuito";
  }
}

/**
 * Se ainda faz sentido oferecer a compra.
 *
 * Quem já pagou só volta a ver a oferta na janela de renovação; oferecer antes
 * seria vender duas vezes o mesmo período, e a rota recusaria com 409.
 */
export function canOfferPurchase(status: PlanStatus): boolean {
  return status.kind !== "PAID" || status.canRenew;
}

/** Se a pessoa está no teste sem nunca ter pago. Usado só para escolher o verbo. */
export function isFirstPurchase(status: PlanStatus): boolean {
  return !status.hadPaidPlan;
}
