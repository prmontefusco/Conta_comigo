import "server-only";

import { fromDecimal, toDecimal, type Money } from "@/core/money/money";
import { describeError, logger } from "@/lib/observability/logger";
import {
  decodeExternalReference,
  encodeExternalReference,
  PRODUCT_CODE,
  type SubscriptionCycle,
} from "@/modules/billing/domain/subscription";
import type { UserId } from "@/modules/shared/domain/common";

/**
 * ASAAS.
 *
 * Portado de um projeto irmão que já roda em produção, com três mudanças
 * registradas em docs/adr/0009-server-side-payments.md: um provedor só, o
 * produto gravado na referência externa, e o segredo do webhook só por
 * cabeçalho.
 *
 * A conversão de valores é o ponto mais perigoso deste arquivo. O domínio
 * guarda centavos inteiros; a API do ASAAS recebe e devolve reais decimais.
 * Errar isso cobra cem vezes a mais ou a menos, então a conversão acontece
 * exclusivamente aqui, nas duas funções abaixo, e em nenhum outro lugar.
 */

/** Centavos inteiros → reais decimais, como o ASAAS espera. */
function toProviderAmount(value: Money): number {
  return toDecimal(value);
}

/** Reais decimais devolvidos pelo ASAAS → centavos inteiros. */
function fromProviderAmount(value: unknown): Money | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return fromDecimal(value);
}

export class PaymentGatewayUnavailableError extends Error {
  readonly code = "PAYMENT_GATEWAY_UNAVAILABLE";
  constructor() {
    super("Nenhum provedor de pagamento está configurado neste ambiente.");
    this.name = "PaymentGatewayUnavailableError";
  }
}

export class PaymentProviderError extends Error {
  readonly code = "PAYMENT_PROVIDER_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

/**
 * Falso numa máquina de desenvolvimento, e é assim que tem de ser: sem chave,
 * nenhuma cobrança pode ser aberta.
 */
export function isPaymentConfigured(): boolean {
  return Boolean(process.env.ASAAS_API_KEY);
}

export interface ChargeRequest {
  readonly userId: UserId;
  readonly cycle: SubscriptionCycle;
  readonly amount: Money;
  readonly userEmail?: string;
  readonly userName?: string;
  readonly cpfCnpj?: string;
}

export interface PixCharge {
  readonly chargeId: string;
  readonly amount: Money;
  readonly pixCopyPaste: string;
  readonly qrCodeImage?: string;
  readonly expiresAt?: string;
}

export interface HostedCheckout {
  readonly chargeId: string;
  readonly invoiceUrl: string;
  readonly amount: Money;
}

export interface PaymentVerification {
  readonly paid: boolean;
  readonly userId?: UserId;
  readonly cycle?: SubscriptionCycle;
  readonly amount?: Money;
  /** Falso quando a cobrança pertence a outro produto na mesma conta. */
  readonly belongsToThisProduct: boolean;
}

export class AsaasGateway {
  private get baseUrl(): string {
    return (process.env.ASAAS_API_BASE_URL ?? "https://api.asaas.com/v3").replace(/\/$/, "");
  }

  private get apiKey(): string {
    const key = process.env.ASAAS_API_KEY;
    if (!key) throw new PaymentGatewayUnavailableError();
    return key;
  }

  private headers(withBody: boolean): Record<string, string> {
    return {
      access_token: this.apiKey,
      ...(withBody ? { "Content-Type": "application/json" } : {}),
    };
  }

  /* ---------------------------------------------------------------- */
  /* Cobranças                                                         */
  /* ---------------------------------------------------------------- */

  async createPixCharge(request: ChargeRequest): Promise<PixCharge> {
    const chargeId = await this.createPayment(request, "PIX");

    const response = await fetch(`${this.baseUrl}/payments/${chargeId}/pixQrCode`, {
      headers: this.headers(false),
    });
    const data: unknown = await response.json().catch(() => ({}));
    const payload = readString(data, "payload");

    if (!payload) {
      // A cobrança existe mas não há como pagá-la. Mostrar um código inválido
      // seria pior que falhar: o banco recusa e a pessoa acha que pagou.
      throw new PaymentProviderError(
        firstProviderError(data) ?? "A cobrança foi criada, mas o Asaas não gerou o QR Code Pix.",
      );
    }

    return {
      chargeId,
      amount: request.amount,
      pixCopyPaste: payload,
      ...(readString(data, "encodedImage")
        ? { qrCodeImage: readString(data, "encodedImage")! }
        : {}),
      ...(readString(data, "expirationDate")
        ? { expiresAt: readString(data, "expirationDate")! }
        : {}),
    };
  }

  async createHostedCheckout(request: ChargeRequest): Promise<HostedCheckout> {
    const { chargeId, invoiceUrl } = await this.createPaymentWithInvoice(request);
    return { chargeId, invoiceUrl, amount: request.amount };
  }

  private async createPayment(
    request: ChargeRequest,
    billingType: "PIX" | "CREDIT_CARD",
  ): Promise<string> {
    const created = await this.postPayment(request, billingType);
    return created.chargeId;
  }

  private async createPaymentWithInvoice(
    request: ChargeRequest,
  ): Promise<{ chargeId: string; invoiceUrl: string }> {
    const created = await this.postPayment(request, "CREDIT_CARD");
    if (!created.invoiceUrl) {
      throw new PaymentProviderError("O Asaas não retornou o link de pagamento.");
    }
    return { chargeId: created.chargeId, invoiceUrl: created.invoiceUrl };
  }

  private async postPayment(
    request: ChargeRequest,
    billingType: "PIX" | "CREDIT_CARD",
  ): Promise<{ chargeId: string; invoiceUrl?: string }> {
    const customerId = await this.ensureCustomer(request);

    try {
      const response = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({
          customer: customerId,
          billingType,
          value: toProviderAmount(request.amount),
          dueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
          description: `Conta comigo Premium (${request.cycle === "MONTHLY" ? "mensal" : "anual"})`,
          // Devolvido tal e qual pelo webhook. É como um pagamento volta a ser
          // associado a uma pessoa - e a este produto.
          externalReference: encodeExternalReference({
            product: PRODUCT_CODE,
            userId: request.userId,
            cycle: request.cycle,
          }),
        }),
      });

      const data: unknown = await response.json().catch(() => ({}));
      const chargeId = readString(data, "id");

      if (!chargeId) {
        logger.warn("Asaas recusou a criação da cobrança.", {
          operation: "postPayment",
          billingType,
        });
        throw new PaymentProviderError(
          firstProviderError(data) ?? "O Asaas recusou a criação da cobrança.",
        );
      }

      const invoiceUrl = readString(data, "invoiceUrl");
      return { chargeId, ...(invoiceUrl ? { invoiceUrl } : {}) };
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;
      logger.error("Falha ao comunicar com o Asaas.", {
        operation: "postPayment",
        ...describeError(error),
      });
      throw new PaymentProviderError(
        "Falha ao comunicar com o Asaas. Tente novamente em instantes.",
      );
    }
  }

  /* ---------------------------------------------------------------- */
  /* Cliente                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Idempotente: procura pelo `externalReference` antes de criar.
   *
   * A referência inclui o produto porque a conta é compartilhada — sem isso,
   * o mesmo uid noutro produto acharia o cliente errado.
   */
  private async ensureCustomer(request: ChargeRequest): Promise<string> {
    const externalReference = `${PRODUCT_CODE}:${request.userId}`;
    const cpfCnpj = request.cpfCnpj?.replace(/\D/g, "");
    const email = request.userEmail?.includes("@") ? request.userEmail : undefined;

    try {
      const search = await fetch(
        `${this.baseUrl}/customers?externalReference=${encodeURIComponent(externalReference)}`,
        { headers: this.headers(false) },
      );
      const searchData: unknown = await search.json().catch(() => ({}));
      const existing = readFirstDataId(searchData);
      if (existing) return existing;

      const create = await fetch(`${this.baseUrl}/customers`, {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({
          name: request.userName ?? email ?? "Cliente Conta comigo",
          email,
          cpfCnpj,
          externalReference,
          // O produto já fala com a pessoa; o provedor não precisa.
          notificationDisabled: true,
        }),
      });

      const created: unknown = await create.json().catch(() => ({}));
      const id = readString(created, "id");
      if (id) return id;

      throw new PaymentProviderError(
        firstProviderError(created) ?? "Não foi possível preparar o cliente no Asaas.",
      );
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;
      logger.error("Falha ao preparar cliente no Asaas.", {
        operation: "ensureCustomer",
        ...describeError(error),
      });
      throw new PaymentProviderError(
        "Falha ao comunicar com o Asaas. Tente novamente em instantes.",
      );
    }
  }

  /* ---------------------------------------------------------------- */
  /* Verificação                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Relê a cobrança direto no provedor.
   *
   * **Esta é a única afirmação sobre pagamento em que o sistema acredita.**
   * Corpo de webhook é pista, não prova: quem sabe a URL do endpoint pode
   * enviar qualquer coisa.
   */
  async verifyPayment(chargeId: string): Promise<PaymentVerification> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(chargeId)}`, {
        headers: this.headers(false),
      });
      const data: unknown = await response.json().catch(() => ({}));

      const status = readString(data, "status");
      const paid = status === "RECEIVED" || status === "CONFIRMED";
      const reference = decodeExternalReference(readUnknown(data, "externalReference"));

      if (!reference) {
        // Cobrança legítima, mas de outro produto na mesma conta — ou de uma
        // versão anterior do formato. Em qualquer caso, não concede nada aqui.
        logger.warn("Cobrança do Asaas não pertence a este produto.", {
          operation: "verifyPayment",
          chargeId,
        });
        return { paid: false, belongsToThisProduct: false };
      }

      const amount = fromProviderAmount(readUnknown(data, "value"));

      return {
        paid,
        userId: reference.userId,
        cycle: reference.cycle,
        ...(amount ? { amount } : {}),
        belongsToThisProduct: true,
      };
    } catch (error) {
      logger.error("Falha ao verificar pagamento no Asaas.", {
        operation: "verifyPayment",
        chargeId,
        ...describeError(error),
      });
      // Falhar fechado: na dúvida, ninguém ganha plano.
      return { paid: false, belongsToThisProduct: false };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Leitura defensiva da resposta                                       */
/* ------------------------------------------------------------------ */

function readUnknown(data: unknown, key: string): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  return (data as Record<string, unknown>)[key];
}

function readString(data: unknown, key: string): string | undefined {
  const value = readUnknown(data, key);
  return typeof value === "string" && value !== "" ? value : undefined;
}

function readFirstDataId(data: unknown): string | undefined {
  const list = readUnknown(data, "data");
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return readString(list[0], "id");
}

function firstProviderError(data: unknown): string | undefined {
  const errors = readUnknown(data, "errors");
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  return readString(errors[0], "description");
}
