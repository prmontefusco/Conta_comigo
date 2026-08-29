import type { Instant } from "@/core/date/calendar-date";
import type { Money } from "@/core/money/money";
import type { UserId } from "@/modules/shared/domain/common";

/**
 * Assinatura.
 *
 * O estado do plano tem uma fonte de verdade do lado do servidor. O cliente lê,
 * nunca escreve: as Security Rules negam escrita a todos em `subscriptions`, e
 * só o Admin SDK grava ali (docs/adr/0009-server-side-payments.md).
 *
 * Tudo neste arquivo é puro. Quem cobra é a infraestrutura; quem decide se
 * alguém tem direito ao plano é este módulo, e isso precisa ser testável sem
 * rede e sem banco.
 */

export type UserPlan = "FREE" | "PREMIUM";

export type SubscriptionStatus = "NONE" | "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export type SubscriptionCycle = "MONTHLY" | "YEARLY";

export type PaymentProvider = "ASAAS" | "MANUAL";

/**
 * Identifica o produto na conta do provedor.
 *
 * A mesma conta ASAAS atende mais de um produto. Sem isso, um pagamento feito
 * noutro produto poderia, em tese, ativar assinatura aqui.
 */
export const PRODUCT_CODE = "conta-comigo";

export interface Subscription {
  readonly userId: UserId;
  readonly plan: UserPlan;
  readonly status: SubscriptionStatus;
  readonly cycle?: SubscriptionCycle;
  readonly provider?: PaymentProvider;
  /** Identificador da cobrança no provedor, usado para reconciliar. */
  readonly externalTxId?: string;
  /** Instante em que o direito ao plano termina. */
  readonly expiresAt?: Instant;
  readonly activatedAt?: Instant;
  readonly updatedAt: Instant;
}

export function freeSubscription(userId: UserId, now: Instant): Subscription {
  return { userId, plan: "FREE", status: "NONE", updatedAt: now };
}

/**
 * O plano que a pessoa efetivamente tem agora.
 *
 * Uma assinatura vencida vira FREE aqui, na leitura. Isso evita depender de um
 * job agendado para rebaixar planos — e evita o bug em que uma assinatura
 * expirada continua sem anúncios para sempre porque ninguém rodou o job.
 */
export function resolveEffectivePlan(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): UserPlan {
  if (!subscription) return "FREE";
  if (subscription.plan !== "PREMIUM") return "FREE";
  if (subscription.status !== "ACTIVE") return "FREE";
  if (subscription.expiresAt && new Date(subscription.expiresAt).getTime() <= now.getTime()) {
    return "FREE";
  }
  return "PREMIUM";
}

export function isPremium(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): boolean {
  return resolveEffectivePlan(subscription, now) === "PREMIUM";
}

/** Dias que faltam para vencer. Negativo se já venceu, null se não há prazo. */
export function daysUntilExpiry(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!subscription?.expiresAt) return null;
  const millis = new Date(subscription.expiresAt).getTime() - now.getTime();
  return Math.ceil(millis / 86_400_000);
}

export function cycleDurationMs(cycle: SubscriptionCycle): number {
  return cycle === "MONTHLY" ? 30 * 86_400_000 : 365 * 86_400_000;
}

/**
 * Estende a assinatura a partir de um pagamento já confirmado.
 *
 * Estende a partir do vencimento atual quando ele ainda está no futuro, e não a
 * partir de hoje: quem renova antes do fim não deve perder os dias que já
 * pagou.
 */
export function activate(
  current: Subscription | null,
  input: {
    readonly userId: UserId;
    readonly cycle: SubscriptionCycle;
    readonly provider: PaymentProvider;
    readonly externalTxId: string;
    readonly now: Date;
  },
): Subscription {
  const nowMs = input.now.getTime();
  const currentExpiry = current?.expiresAt ? new Date(current.expiresAt).getTime() : 0;
  const base = Math.max(nowMs, currentExpiry);
  const instant = (ms: number) => new Date(ms).toISOString() as Instant;

  return {
    userId: input.userId,
    plan: "PREMIUM",
    status: "ACTIVE",
    cycle: input.cycle,
    provider: input.provider,
    externalTxId: input.externalTxId,
    expiresAt: instant(base + cycleDurationMs(input.cycle)),
    activatedAt: current?.activatedAt ?? instant(nowMs),
    updatedAt: instant(nowMs),
  };
}

/** Marca uma cobrança aberta, ainda não paga. */
export function markPending(
  current: Subscription | null,
  input: {
    readonly userId: UserId;
    readonly cycle: SubscriptionCycle;
    readonly provider: PaymentProvider;
    readonly externalTxId: string;
    readonly now: Date;
  },
): Subscription {
  const instant = input.now.toISOString() as Instant;

  return {
    ...(current ?? freeSubscription(input.userId, instant)),
    userId: input.userId,
    // Uma cobrança aberta não concede nada. Só o pagamento confirmado concede.
    plan: current?.plan === "PREMIUM" ? "PREMIUM" : "FREE",
    status: "PENDING",
    cycle: input.cycle,
    provider: input.provider,
    externalTxId: input.externalTxId,
    updatedAt: instant,
  };
}

export function cancel(current: Subscription, now: Date): Subscription {
  return {
    ...current,
    // Cancelar não tira o que já foi pago: o direito vai até o vencimento.
    status: "CANCELLED",
    updatedAt: now.toISOString() as Instant,
  };
}

/* ------------------------------------------------------------------ */
/* Catálogo de planos                                                  */
/* ------------------------------------------------------------------ */

export interface PlanOption {
  readonly cycle: SubscriptionCycle;
  readonly price: Money;
  readonly label: string;
}

/**
 * Preços definidos no servidor, nunca escolhidos pelo cliente.
 *
 * ATENÇÃO: os valores abaixo são provisórios e ainda não foram decididos para
 * este produto. A rota que abre uma cobrança ainda não existe justamente por
 * isso — ver docs/adr/0009-server-side-payments.md. Confirme os preços antes de
 * expor qualquer checkout.
 */
export const PLAN_CATALOGUE: Readonly<Record<SubscriptionCycle, PlanOption>> = {
  MONTHLY: {
    cycle: "MONTHLY",
    price: { amount: 0, currency: "BRL" },
    label: "Mensal",
  },
  YEARLY: {
    cycle: "YEARLY",
    price: { amount: 0, currency: "BRL" },
    label: "Anual",
  },
};

/** Falso enquanto os preços não forem definidos. Mantém o checkout fechado. */
export function isPlanCatalogueConfigured(): boolean {
  return Object.values(PLAN_CATALOGUE).every((option) => option.price.amount > 0);
}

/* ------------------------------------------------------------------ */
/* Referência externa                                                  */
/* ------------------------------------------------------------------ */

export interface ExternalReference {
  readonly product: string;
  readonly userId: UserId;
  readonly cycle: SubscriptionCycle;
}

export function encodeExternalReference(reference: ExternalReference): string {
  return JSON.stringify(reference);
}

/**
 * Lê a referência que o provedor devolve, sem confiar nela.
 *
 * Devolve null para qualquer coisa que não seja deste produto — inclusive uma
 * cobrança legítima de outro produto na mesma conta ASAAS.
 */
export function decodeExternalReference(raw: unknown): ExternalReference | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    if (candidate.product !== PRODUCT_CODE) return null;
    if (typeof candidate.userId !== "string" || candidate.userId === "") return null;
    if (candidate.cycle !== "MONTHLY" && candidate.cycle !== "YEARLY") return null;

    return {
      product: PRODUCT_CODE,
      userId: candidate.userId,
      cycle: candidate.cycle,
    };
  } catch {
    return null;
  }
}
