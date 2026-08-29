import { NextResponse } from "next/server";
import { SubscriptionService } from "@/modules/billing/application/subscription-service";
import { describeError, logger } from "@/lib/observability/logger";

/**
 * Webhook de pagamento do ASAAS.
 *
 * Duas regras tornam este endpoint seguro de expor:
 *
 * 1. **Fail-closed.** Sem `PAYMENT_WEBHOOK_SECRET`, recusa toda requisição em
 *    vez de pular a verificação. Uma variável ausente não pode desligar a
 *    autenticação.
 * 2. **O corpo não é prova.** O payload diz apenas *qual* cobrança olhar.
 *    Status, valor e pagador são relidos da API do ASAAS antes de conceder
 *    qualquer plano, então um POST forjado não vira assinatura.
 *
 * O segredo vem apenas pelo cabeçalho `asaas-access-token`. Query string
 * aparece em log de acesso e em referer.
 *
 * Ver docs/adr/0009-server-side-payments.md.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  // Útil para conferir que a rota subiu, sem revelar nada.
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;

  if (!secret) {
    logger.error("Webhook chamado sem PAYMENT_WEBHOOK_SECRET configurado.", {
      operation: "paymentWebhook",
      code: "WEBHOOK_MISCONFIGURED",
    });
    return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }

  const provided = request.headers.get("asaas-access-token") ?? "";

  if (!timingSafeEqual(provided, secret)) {
    logger.warn("Webhook recusado: segredo inválido.", {
      operation: "paymentWebhook",
      code: "WEBHOOK_UNAUTHORIZED",
    });
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json().catch(() => ({}));
    const event = readString(body, "event");
    const chargeId = readString(readUnknown(body, "payment"), "id");

    logger.info("Webhook de pagamento recebido.", { operation: "paymentWebhook", event });

    if (!event?.startsWith("PAYMENT_") || !chargeId) {
      // Evento que não é de cobrança, ou sem id. Responder 200 evita que o
      // ASAAS fique reenviando algo que nunca vamos processar.
      return NextResponse.json({ received: true, activated: false });
    }

    const result = await new SubscriptionService().confirmAndActivate({ chargeId });

    if (!result.activated) {
      logger.warn("Webhook não sobreviveu à releitura no provedor.", {
        operation: "paymentWebhook",
        chargeId,
        reason: result.reason,
      });
    }

    return NextResponse.json({ received: true, activated: result.activated });
  } catch (error) {
    logger.error("Falha ao processar webhook de pagamento.", {
      operation: "paymentWebhook",
      ...describeError(error),
    });
    // 500 faz o ASAAS reenviar, que é o comportamento desejado numa falha
    // transitória. A concessão é idempotente por `externalTxId`.
    return NextResponse.json({ error: "WEBHOOK_ERROR" }, { status: 500 });
  }
}

/** Comparação em tempo constante, para o segredo não vazar pelo tempo de resposta. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function readUnknown(data: unknown, key: string): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  return (data as Record<string, unknown>)[key];
}

function readString(data: unknown, key: string): string | undefined {
  const value = readUnknown(data, key);
  return typeof value === "string" && value !== "" ? value : undefined;
}
