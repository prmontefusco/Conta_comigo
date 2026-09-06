import "server-only";

import { NextResponse } from "next/server";
import type { Instant } from "@/core/date/calendar-date";
import { adminDb } from "@/lib/firebase/admin";
import { limitsFor, type PlanLimits } from "@/modules/billing/domain/plan-limits";
import { resolveEffectivePlan, type UserPlan } from "@/modules/billing/domain/subscription";
import { SubscriptionRepository } from "@/modules/billing/infrastructure/subscription-repository";
import { describeError, logger } from "@/lib/observability/logger";

/**
 * O plano de quem está chamando, verificado no servidor.
 *
 * As rotas de IA custam por token e eram as duas coisas ao mesmo tempo:
 * anunciadas como Premium e abertas a qualquer conta autenticada. Checar isso
 * no cliente não serviria — quem quisesse gastar a chave só precisaria chamar
 * a rota direto.
 *
 * O período de teste entra aqui pela mesma função pura que o cliente usa, a
 * partir do `createdAt` do perfil. Uma conta nova é Premium nos primeiros
 * trinta dias, no servidor e na tela, sem nada gravado que possa divergir.
 */

export interface CallerPlan {
  readonly plan: UserPlan;
  readonly limits: PlanLimits;
}

export async function resolveCallerPlan(uid: string): Promise<CallerPlan> {
  const [subscription, createdAt] = await Promise.all([
    new SubscriptionRepository().find(uid),
    accountCreatedAt(uid),
  ]);

  const plan = resolveEffectivePlan(subscription, new Date(), createdAt);
  return { plan, limits: limitsFor(plan) };
}

async function accountCreatedAt(uid: string): Promise<Instant | undefined> {
  try {
    const snapshot = await adminDb().collection("users").doc(uid).get();
    const value = snapshot.data()?.createdAt;
    return typeof value === "string" ? (value as Instant) : undefined;
  } catch (error) {
    // Sem a data, a conta simplesmente não está em teste. Falhar fechado é a
    // escolha certa numa rota que gasta dinheiro.
    logger.warn("Não foi possível ler a data de criação da conta.", {
      operation: "resolveCallerPlan",
      ...describeError(error),
    });
    return undefined;
  }
}

/**
 * Recusa a chamada quando o recurso é do Premium e a conta não tem.
 *
 * Devolve `null` quando pode seguir. A resposta 402 carrega uma mensagem que
 * a tela mostra como está — e diz que o teste existe, porque quem acabou de
 * criar a conta tem trinta dias e precisa saber disso.
 */
export async function requirePremiumFeature(
  uid: string,
  feature: "documentReading" | "aiAdvisor",
  message: string,
): Promise<NextResponse | null> {
  const { limits } = await resolveCallerPlan(uid);
  if (limits[feature]) return null;

  return NextResponse.json({ error: "PLAN_REQUIRED", message }, { status: 402 });
}
