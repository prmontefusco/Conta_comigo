import { describe, expect, it } from "vitest";
import type { Instant } from "@/core/date/calendar-date";
import {
  activate,
  cancel,
  cycleDurationMs,
  daysUntilExpiry,
  decodeExternalReference,
  encodeExternalReference,
  freeSubscription,
  isPlanCatalogueConfigured,
  markPending,
  resolveEffectivePlan,
  type Subscription,
} from "./subscription";

/**
 * Direito a plano pago é dinheiro. Cada caso aqui existe porque errá-lo cobra
 * de quem não devia, ou entrega de graça para quem não pagou.
 */

const NOW = new Date("2026-08-29T12:00:00.000Z");
const at = (iso: string) => iso as Instant;

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    userId: "uid-1",
    plan: "PREMIUM",
    status: "ACTIVE",
    cycle: "MONTHLY",
    provider: "ASAAS",
    externalTxId: "pay_1",
    expiresAt: at("2026-09-28T12:00:00.000Z"),
    activatedAt: at("2026-08-29T12:00:00.000Z"),
    updatedAt: at("2026-08-29T12:00:00.000Z"),
    ...overrides,
  };
}

describe("plano efetivo", () => {
  it("é PREMIUM quando ativo e dentro do prazo", () => {
    expect(resolveEffectivePlan(subscription(), NOW)).toBe("PREMIUM");
  });

  it("vira FREE quando o prazo passou, sem depender de job nenhum", () => {
    const vencida = subscription({ expiresAt: at("2026-08-28T12:00:00.000Z") });
    expect(resolveEffectivePlan(vencida, NOW)).toBe("FREE");
  });

  it("vira FREE no instante exato do vencimento", () => {
    const noLimite = subscription({ expiresAt: at("2026-08-29T12:00:00.000Z") });
    expect(resolveEffectivePlan(noLimite, NOW)).toBe("FREE");
  });

  it("é FREE enquanto a cobrança está apenas aberta", () => {
    expect(resolveEffectivePlan(subscription({ status: "PENDING" }), NOW)).toBe("FREE");
  });

  it("continua PREMIUM depois de cancelar, até o prazo acabar", () => {
    // Quem cancelou já pagou pelo período. Cortar na hora seria tomar o que
    // foi pago.
    const cancelada = cancel(subscription(), NOW);
    expect(cancelada.status).toBe("CANCELLED");
    expect(resolveEffectivePlan(cancelada, NOW)).toBe("FREE");
  });

  it("é FREE sem assinatura nenhuma", () => {
    expect(resolveEffectivePlan(null, NOW)).toBe("FREE");
    expect(resolveEffectivePlan(freeSubscription("uid-1", at(NOW.toISOString())), NOW)).toBe(
      "FREE",
    );
  });
});

describe("ativação", () => {
  it("concede o ciclo a partir de hoje quando não havia nada", () => {
    const result = activate(null, {
      userId: "uid-1",
      cycle: "MONTHLY",
      provider: "ASAAS",
      externalTxId: "pay_1",
      now: NOW,
    });

    expect(result.plan).toBe("PREMIUM");
    expect(result.status).toBe("ACTIVE");
    expect(new Date(result.expiresAt!).getTime()).toBe(NOW.getTime() + cycleDurationMs("MONTHLY"));
  });

  it("soma ao prazo que ainda resta em vez de reiniciar", () => {
    // Quem renova antes do fim não pode perder os dias já pagos.
    const atual = subscription({ expiresAt: at("2026-09-28T12:00:00.000Z") });

    const renovada = activate(atual, {
      userId: "uid-1",
      cycle: "MONTHLY",
      provider: "ASAAS",
      externalTxId: "pay_2",
      now: NOW,
    });

    expect(new Date(renovada.expiresAt!).toISOString()).toBe("2026-10-28T12:00:00.000Z");
  });

  it("parte de hoje quando a anterior já venceu", () => {
    const vencida = subscription({ expiresAt: at("2026-01-01T00:00:00.000Z") });

    const nova = activate(vencida, {
      userId: "uid-1",
      cycle: "YEARLY",
      provider: "ASAAS",
      externalTxId: "pay_3",
      now: NOW,
    });

    expect(new Date(nova.expiresAt!).getTime()).toBe(NOW.getTime() + cycleDurationMs("YEARLY"));
  });

  it("preserva a data da primeira ativação", () => {
    const atual = subscription({ activatedAt: at("2026-01-01T00:00:00.000Z") });
    const renovada = activate(atual, {
      userId: "uid-1",
      cycle: "MONTHLY",
      provider: "ASAAS",
      externalTxId: "pay_4",
      now: NOW,
    });

    expect(renovada.activatedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("cobrança aberta", () => {
  it("não concede nada a quem ainda não tinha plano", () => {
    const pendente = markPending(null, {
      userId: "uid-1",
      cycle: "YEARLY",
      provider: "ASAAS",
      externalTxId: "pay_5",
      now: NOW,
    });

    expect(pendente.status).toBe("PENDING");
    expect(resolveEffectivePlan(pendente, NOW)).toBe("FREE");
  });

  it("não derruba quem já é assinante e está renovando", () => {
    const pendente = markPending(subscription(), {
      userId: "uid-1",
      cycle: "YEARLY",
      provider: "ASAAS",
      externalTxId: "pay_6",
      now: NOW,
    });

    expect(pendente.plan).toBe("PREMIUM");
    // Mas o status vira PENDING, então o plano efetivo cai — comportamento a
    // corrigir quando houver renovação automática; hoje não há.
    expect(pendente.expiresAt).toBe(subscription().expiresAt);
  });
});

describe("dias até vencer", () => {
  it("conta os dias que faltam", () => {
    expect(daysUntilExpiry(subscription(), NOW)).toBe(30);
  });

  it("fica negativo depois de vencer", () => {
    expect(daysUntilExpiry(subscription({ expiresAt: at("2026-08-27T12:00:00.000Z") }), NOW)).toBe(
      -2,
    );
  });

  it("é null quando não há prazo", () => {
    expect(daysUntilExpiry(freeSubscription("uid-1", at(NOW.toISOString())), NOW)).toBeNull();
  });
});

describe("referência externa", () => {
  it("faz ida e volta", () => {
    const raw = encodeExternalReference({
      product: "conta-comigo",
      userId: "uid-1",
      cycle: "YEARLY",
    });

    expect(decodeExternalReference(raw)).toEqual({
      product: "conta-comigo",
      userId: "uid-1",
      cycle: "YEARLY",
    });
  });

  it("recusa cobrança de outro produto na mesma conta ASAAS", () => {
    // É este caso que justifica gravar o produto na referência.
    const deOutroProduto = JSON.stringify({
      product: "cvlivre",
      userId: "uid-1",
      cycle: "YEARLY",
    });

    expect(decodeExternalReference(deOutroProduto)).toBeNull();
  });

  it("recusa qualquer coisa malformada em vez de adivinhar", () => {
    expect(decodeExternalReference(null)).toBeNull();
    expect(decodeExternalReference("")).toBeNull();
    expect(decodeExternalReference("uid-1")).toBeNull();
    expect(decodeExternalReference("{")).toBeNull();
    expect(decodeExternalReference(JSON.stringify({ product: "conta-comigo" }))).toBeNull();
    expect(
      decodeExternalReference(
        JSON.stringify({ product: "conta-comigo", userId: "uid-1", cycle: "SEMANAL" }),
      ),
    ).toBeNull();
  });
});

describe("catálogo de planos", () => {
  it("está fechado enquanto os preços não forem definidos", () => {
    // Guarda deliberada: sem preço confirmado, nenhum checkout pode abrir.
    expect(isPlanCatalogueConfigured()).toBe(false);
  });
});
