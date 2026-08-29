import "server-only";

import type { Instant } from "@/core/date/calendar-date";
import { adminDb } from "@/lib/firebase/admin";
import type { Subscription, SubscriptionCycle } from "@/modules/billing/domain/subscription";
import { freeSubscription } from "@/modules/billing/domain/subscription";
import type { UserId } from "@/modules/shared/domain/common";

/**
 * Assinaturas em `subscriptions/{uid}`.
 *
 * Escrito exclusivamente por aqui, com o Admin SDK. As Security Rules negam
 * escrita a todo mundo nessa coleção: o cliente lê a própria assinatura para
 * saber o que mostrar, e nada mais. Quem paga não declara que pagou.
 */

const COLLECTION = "subscriptions";

export class SubscriptionRepository {
  async find(userId: UserId): Promise<Subscription | null> {
    const snapshot = await adminDb().collection(COLLECTION).doc(userId).get();
    if (!snapshot.exists) return null;
    return this.fromDocument(userId, snapshot.data() ?? {});
  }

  async findOrFree(userId: UserId, now: Instant): Promise<Subscription> {
    return (await this.find(userId)) ?? freeSubscription(userId, now);
  }

  async save(subscription: Subscription): Promise<void> {
    // `undefined` não é gravável no Firestore, e um campo ausente é mais
    // honesto que um null que ninguém sabe interpretar.
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(subscription)) {
      if (value !== undefined) payload[key] = value;
    }

    await adminDb().collection(COLLECTION).doc(subscription.userId).set(payload, { merge: false });
  }

  /**
   * Espelha o plano em `users/{uid}` para que a interface saiba o que mostrar
   * sem uma segunda leitura.
   *
   * O espelho é conveniência, não fonte de verdade: quem decide é
   * `resolveEffectivePlan` sobre a assinatura, que também considera a data de
   * vencimento. Um espelho desatualizado atrasa a tela, nunca concede direito.
   */
  async mirrorPlanOnProfile(userId: UserId, plan: "FREE" | "PREMIUM", now: Instant): Promise<void> {
    await adminDb().collection("users").doc(userId).set({ plan, updatedAt: now }, { merge: true });
  }

  private fromDocument(userId: UserId, data: Record<string, unknown>): Subscription {
    const asString = (key: string): string | undefined =>
      typeof data[key] === "string" && data[key] !== "" ? (data[key] as string) : undefined;

    return {
      userId,
      plan: data.plan === "PREMIUM" ? "PREMIUM" : "FREE",
      status: isStatus(data.status) ? data.status : "NONE",
      ...(isCycle(data.cycle) ? { cycle: data.cycle } : {}),
      ...(data.provider === "ASAAS" || data.provider === "MANUAL"
        ? { provider: data.provider }
        : {}),
      ...(asString("externalTxId") ? { externalTxId: asString("externalTxId")! } : {}),
      ...(asString("expiresAt") ? { expiresAt: asString("expiresAt")! as Instant } : {}),
      ...(asString("activatedAt") ? { activatedAt: asString("activatedAt")! as Instant } : {}),
      updatedAt: (asString("updatedAt") ?? new Date().toISOString()) as Instant,
    };
  }
}

function isStatus(value: unknown): value is Subscription["status"] {
  return (
    value === "NONE" ||
    value === "PENDING" ||
    value === "ACTIVE" ||
    value === "EXPIRED" ||
    value === "CANCELLED"
  );
}

function isCycle(value: unknown): value is SubscriptionCycle {
  return value === "MONTHLY" || value === "YEARLY";
}
