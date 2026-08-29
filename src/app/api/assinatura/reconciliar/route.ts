import { NextResponse } from "next/server";
import { SubscriptionService } from "@/modules/billing/application/subscription-service";
import { resolveEffectivePlan } from "@/modules/billing/domain/subscription";
import { describeError, logger } from "@/lib/observability/logger";
import { requireAuth } from "@/server/auth-guard";

/**
 * Reconciliação de pagamento.
 *
 * Webhooks se perdem — é questão de quando, não de se. Sem este caminho, quem
 * pagou e não teve o webhook entregue ficaria sem o plano, e a única saída
 * seria suporte manual.
 *
 * A rota é autenticada e só olha a cobrança que a própria assinatura da pessoa
 * registrou como pendente. Ela não aceita um id de cobrança vindo do cliente:
 * isso deixaria qualquer um tentar reivindicar pagamentos alheios.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const service = new SubscriptionService();
    const current = await service.get(auth.caller.uid);

    if (resolveEffectivePlan(current) === "PREMIUM") {
      return NextResponse.json({ activated: true, plan: "PREMIUM", expiresAt: current.expiresAt });
    }

    if (current.status !== "PENDING" || !current.externalTxId) {
      return NextResponse.json({ activated: false, plan: "FREE", reason: "NO_PENDING_PAYMENT" });
    }

    const result = await service.confirmAndActivate({
      chargeId: current.externalTxId,
      expectedUserId: auth.caller.uid,
    });

    if (!result.activated) {
      return NextResponse.json({
        activated: false,
        plan: "FREE",
        reason: result.reason ?? "NOT_CONFIRMED",
      });
    }

    return NextResponse.json({
      activated: true,
      plan: "PREMIUM",
      expiresAt: result.subscription?.expiresAt ?? null,
    });
  } catch (error) {
    logger.error("Falha ao reconciliar assinatura.", {
      operation: "reconcileSubscription",
      ...describeError(error),
    });
    return NextResponse.json(
      { error: "Não foi possível verificar o pagamento agora." },
      { status: 500 },
    );
  }
}
