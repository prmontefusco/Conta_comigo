import { NextResponse } from "next/server";
import { describeError, logger } from "@/lib/observability/logger";
import {
  PlanNotAvailableError,
  SubscriptionService,
} from "@/modules/billing/application/subscription-service";
import {
  isWithinRenewalWindow,
  RENEWAL_WINDOW_DAYS,
  resolveEffectivePlan,
} from "@/modules/billing/domain/subscription";
import {
  PaymentGatewayUnavailableError,
  PaymentProviderError,
} from "@/modules/billing/infrastructure/asaas-gateway";
import { checkoutRequestSchema } from "@/modules/billing/domain/checkout-schema";
import { requireAuth } from "@/server/auth-guard";

/**
 * Abertura de cobrança.
 *
 * O cliente escolhe **ciclo** e **forma de pagamento**, e mais nada. O valor sai
 * do catálogo do servidor: aceitar um preço vindo do navegador deixaria qualquer
 * pessoa assinar por um centavo. O mesmo vale para a identidade — quem está
 * pagando vem do token verificado, nunca do corpo.
 *
 * Pagar não ativa nada aqui. A ativação depende sempre de uma releitura no
 * provedor, pelo webhook ou pela reconciliação.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const body: unknown = await request.json().catch(() => null);
  const parsed = checkoutRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Escolha um plano e uma forma de pagamento." },
      { status: 400 },
    );
  }

  try {
    const service = new SubscriptionService();

    // Cobrar de novo quem acabou de assinar seria cobrar duas vezes pela mesma
    // coisa. Mas a renovação antecipada precisa caber: `activate()` estende a
    // partir do vencimento atual, não de hoje, justamente para que ninguém
    // perca os dias já pagos ao renovar antes do fim. Fechar isso obrigaria a
    // pessoa a deixar o plano expirar para poder renovar.
    const current = await service.get(auth.caller.uid);

    if (resolveEffectivePlan(current) === "PREMIUM" && !isWithinRenewalWindow(current)) {
      return NextResponse.json(
        {
          error: "ALREADY_PREMIUM",
          message: `Seu plano já está ativo. A renovação abre nos últimos ${RENEWAL_WINDOW_DAYS} dias.`,
          expiresAt: current.expiresAt ?? null,
        },
        { status: 409 },
      );
    }

    const result = await service.openCheckout({
      userId: auth.caller.uid,
      cycle: parsed.data.cycle,
      method: parsed.data.method,
      ...(auth.caller.email ? { email: auth.caller.email } : {}),
      ...(auth.caller.name ? { name: auth.caller.name } : {}),
      ...(parsed.data.cpfCnpj ? { cpfCnpj: parsed.data.cpfCnpj } : {}),
    });

    if (result.kind === "PIX") {
      return NextResponse.json({
        method: "PIX",
        chargeId: result.charge.chargeId,
        amountCents: result.charge.amount.amount,
        pixCopyPaste: result.charge.pixCopyPaste,
        qrCodeImage: result.charge.qrCodeImage ?? null,
        expiresAt: result.charge.expiresAt ?? null,
      });
    }

    return NextResponse.json({
      method: "CARD",
      chargeId: result.checkout.chargeId,
      amountCents: result.checkout.amount.amount,
      invoiceUrl: result.checkout.invoiceUrl,
    });
  } catch (error) {
    if (error instanceof PlanNotAvailableError) {
      return NextResponse.json(
        { error: error.code, message: "Este plano não está disponível no momento." },
        { status: 409 },
      );
    }

    if (error instanceof PaymentGatewayUnavailableError) {
      // Ambiente sem chave, ou apontado para produção fora de produção. Fechado
      // é o comportamento correto — mas quem opera precisa saber qual dos dois.
      logger.error("Checkout indisponível por configuração.", {
        operation: "checkout",
        reason: error.message,
      });
      return NextResponse.json(
        { error: error.code, message: "Os pagamentos ainda não estão disponíveis." },
        { status: 503 },
      );
    }

    if (error instanceof PaymentProviderError) {
      // A mensagem do provedor vai para o log, não para a tela. Verificando
      // localmente, uma chave inválida virou "A chave de API fornecida é
      // inválida" na cara de quem tentava assinar — um problema de operação
      // exposto como se fosse culpa da pessoa, e nada que ela pudesse resolver.
      logger.error("O provedor recusou a cobrança.", {
        operation: "checkout",
        providerMessage: error.message,
      });
      return NextResponse.json(
        {
          error: error.code,
          message: "O provedor de pagamento recusou a cobrança. Tente novamente em alguns minutos.",
        },
        { status: 502 },
      );
    }

    logger.error("Falha ao abrir cobrança.", {
      operation: "checkout",
      ...describeError(error),
    });
    return NextResponse.json(
      { error: "CHECKOUT_FAILED", message: "Não foi possível iniciar o pagamento agora." },
      { status: 500 },
    );
  }
}
