import "server-only";

import type { Instant } from "@/core/date/calendar-date";
import { describeError, logger } from "@/lib/observability/logger";
import {
  activate,
  markPending,
  resolveEffectivePlan,
  type Subscription,
  type SubscriptionCycle,
} from "@/modules/billing/domain/subscription";
import {
  AsaasGateway,
  type HostedCheckout,
  type PixCharge,
} from "@/modules/billing/infrastructure/asaas-gateway";
import { planCatalogue } from "@/modules/billing/infrastructure/plan-config";
import { SubscriptionRepository } from "@/modules/billing/infrastructure/subscription-repository";
import type { UserId } from "@/modules/shared/domain/common";

/** O ciclo pedido não está à venda — normalmente porque não tem preço. */
export class PlanNotAvailableError extends Error {
  readonly code = "PLAN_NOT_AVAILABLE";
  constructor(cycle: SubscriptionCycle) {
    super(`O plano ${cycle} não está disponível para contratação.`);
    this.name = "PlanNotAvailableError";
  }
}

/**
 * Concessão de plano.
 *
 * Todo caminho que concede PREMIUM passa por aqui, e nenhum deles acredita em
 * quem chamou: a confirmação vem sempre de uma releitura no provedor.
 */
export class SubscriptionService {
  constructor(
    private readonly repository = new SubscriptionRepository(),
    private readonly gateway = new AsaasGateway(),
  ) {}

  async get(userId: UserId): Promise<Subscription> {
    return this.repository.findOrFree(userId, new Date().toISOString() as Instant);
  }

  /**
   * Abre uma cobrança e registra que ela está pendente.
   *
   * **O preço vem daqui, nunca do cliente.** O navegador escolhe o ciclo e a
   * forma de pagamento; o valor é lido do catálogo do servidor. Aceitar um
   * valor vindo do cliente deixaria qualquer pessoa assinar por um centavo.
   */
  async openCheckout(input: {
    readonly userId: UserId;
    readonly cycle: SubscriptionCycle;
    readonly method: "PIX" | "CARD";
    readonly email?: string;
    readonly name?: string;
    readonly cpfCnpj?: string;
  }): Promise<
    | { readonly kind: "PIX"; readonly charge: PixCharge }
    | { readonly kind: "CARD"; readonly checkout: HostedCheckout }
  > {
    const option = planCatalogue()[input.cycle];
    if (!option) {
      throw new PlanNotAvailableError(input.cycle);
    }

    const request = {
      userId: input.userId,
      cycle: input.cycle,
      amount: option.price,
      ...(input.email ? { userEmail: input.email } : {}),
      ...(input.name ? { userName: input.name } : {}),
      ...(input.cpfCnpj ? { cpfCnpj: input.cpfCnpj } : {}),
    };

    const result =
      input.method === "PIX"
        ? ({ kind: "PIX" as const, charge: await this.gateway.createPixCharge(request) })
        : ({ kind: "CARD" as const, checkout: await this.gateway.createHostedCheckout(request) });

    const chargeId = result.kind === "PIX" ? result.charge.chargeId : result.checkout.chargeId;

    // Registrar como pendente é o que permite a reconciliação encontrar esta
    // cobrança depois, caso o webhook não chegue.
    //
    // Só uma cobrança fica registrada por vez. Se alguém abrir um Pix, depois um
    // cartão, e pagar o Pix, a reconciliação olhará a do cartão e não achará
    // nada — mas o webhook ainda ativa, porque ele parte do id que o provedor
    // envia, não do que guardamos.
    const current = await this.repository.find(input.userId);
    await this.repository.save(
      markPending(current, {
        userId: input.userId,
        cycle: input.cycle,
        provider: "ASAAS",
        externalTxId: chargeId,
        now: new Date(),
      }),
    );

    logger.info("Cobrança aberta.", {
      operation: "openCheckout",
      cycle: input.cycle,
      method: input.method,
      chargeId,
    });

    return result;
  }

  /**
   * Confirma uma cobrança no provedor e, se paga, concede o plano.
   *
   * `expectedUserId` existe para o caminho da reconciliação, onde já se sabe
   * quem está pedindo: se o pagamento pertencer a outra pessoa, nada acontece.
   * No webhook não há quem pedir, então a pessoa vem da própria cobrança.
   */
  async confirmAndActivate(input: {
    readonly chargeId: string;
    readonly expectedUserId?: UserId;
  }): Promise<{ activated: boolean; subscription?: Subscription; reason?: string }> {
    const verification = await this.gateway.verifyPayment(input.chargeId);

    if (!verification.belongsToThisProduct) {
      return { activated: false, reason: "OTHER_PRODUCT" };
    }
    if (!verification.paid || !verification.userId || !verification.cycle) {
      return { activated: false, reason: "NOT_PAID" };
    }
    if (input.expectedUserId && verification.userId !== input.expectedUserId) {
      logger.warn("Cobrança confirmada pertence a outra pessoa.", {
        operation: "confirmAndActivate",
        chargeId: input.chargeId,
      });
      return { activated: false, reason: "USER_MISMATCH" };
    }

    const subscription = await this.grant({
      userId: verification.userId,
      cycle: verification.cycle,
      externalTxId: input.chargeId,
    });

    return { activated: true, subscription };
  }

  private async grant(input: {
    readonly userId: UserId;
    readonly cycle: SubscriptionCycle;
    readonly externalTxId: string;
  }): Promise<Subscription> {
    const now = new Date();
    const current = await this.repository.find(input.userId);

    // Reprocessar o mesmo pagamento não pode estender o plano de novo. Webhooks
    // repetem — o provedor reenvia até receber 200.
    if (current?.externalTxId === input.externalTxId && current.status === "ACTIVE") {
      logger.info("Pagamento já processado; nada a fazer.", {
        operation: "grant",
        chargeId: input.externalTxId,
      });
      return current;
    }

    const next = activate(current, {
      userId: input.userId,
      cycle: input.cycle,
      provider: "ASAAS",
      externalTxId: input.externalTxId,
      now,
    });

    await this.repository.save(next);

    try {
      await this.repository.mirrorPlanOnProfile(
        input.userId,
        resolveEffectivePlan(next, now),
        now.toISOString() as Instant,
      );
    } catch (error) {
      // O espelho é conveniência. Se falhar, a assinatura já está gravada e o
      // direito continua valendo — a tela é que pode demorar a acompanhar.
      logger.warn("Não foi possível espelhar o plano no perfil.", {
        operation: "grant",
        ...describeError(error),
      });
    }

    logger.info("Plano concedido.", {
      operation: "grant",
      cycle: input.cycle,
      chargeId: input.externalTxId,
    });

    return next;
  }
}
