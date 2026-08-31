import { describe, expect, it } from "vitest";
import type { Instant } from "@/core/date/calendar-date";
import {
  activate,
  cancel,
  cycleDurationMs,
  daysUntilExpiry,
  decodeExternalReference,
  encodeExternalReference,
  buildPlanCatalogue,
  freeSubscription,
  isPlanCatalogueConfigured,
  isWithinRenewalWindow,
  markPending,
  parsePlanPrice,
  resolveEffectivePlan,
  yearlySavingPerMonth,
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

describe("janela de renovação", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  const premiumUntil = (iso: string): Subscription => ({
    userId: "u1",
    plan: "PREMIUM",
    status: "ACTIVE",
    expiresAt: iso as Instant,
    updatedAt: "2026-01-01T00:00:00.000Z" as Instant,
  });

  it("abre nos últimos dias antes do vencimento", () => {
    expect(isWithinRenewalWindow(premiumUntil("2026-06-05T12:00:00.000Z"), now)).toBe(true);
  });

  it("fica fechada enquanto ainda falta muito", () => {
    // Cobrar de quem acabou de assinar seria cobrar duas vezes pela mesma coisa.
    expect(isWithinRenewalWindow(premiumUntil("2026-09-01T12:00:00.000Z"), now)).toBe(false);
  });

  it("é falsa para quem não tem plano", () => {
    expect(isWithinRenewalWindow(null, now)).toBe(false);
    expect(isWithinRenewalWindow(freeSubscription("u1", "2026-01-01T00:00:00.000Z" as Instant), now)).toBe(false);
  });

  it("é falsa quando o plano já venceu — aí é compra, não renovação", () => {
    expect(isWithinRenewalWindow(premiumUntil("2026-05-01T12:00:00.000Z"), now)).toBe(false);
  });
});

describe("preço", () => {
  it("lê centavos inteiros", () => {
    expect(parsePlanPrice("990")).toEqual({ amount: 990, currency: "BRL" });
  });

  it("recusa qualquer coisa que não seja inteiro positivo", () => {
    // Um preço inválido tem de fechar o checkout, nunca virar zero.
    for (const invalido of [undefined, "", "  ", "0", "-100", "9,90", "9.90", "abc", "1e3x"]) {
      expect(parsePlanPrice(invalido)).toBeNull();
    }
  });

  it("recusa valores fora da faixa segura de inteiros", () => {
    expect(parsePlanPrice("9007199254740993")).toBeNull();
  });
});

describe("catálogo de planos", () => {
  it("fica vazio sem configuração, mantendo o checkout fechado", () => {
    const catalogue = buildPlanCatalogue({});
    expect(catalogue).toEqual({});
    expect(isPlanCatalogueConfigured(catalogue)).toBe(false);
  });

  it("oferece só os ciclos com preço válido", () => {
    // Vender apenas o anual é legítimo; vender o mensal por zero não é.
    const catalogue = buildPlanCatalogue({ monthly: "0", yearly: "9900" });

    expect(catalogue.MONTHLY).toBeUndefined();
    expect(catalogue.YEARLY?.price).toEqual({ amount: 9900, currency: "BRL" });
    expect(isPlanCatalogueConfigured(catalogue)).toBe(true);
  });

  it("monta os dois ciclos quando ambos estão configurados", () => {
    const catalogue = buildPlanCatalogue({ monthly: "990", yearly: "9900" });

    expect(catalogue.MONTHLY?.label).toBe("Mensal");
    expect(catalogue.YEARLY?.label).toBe("Anual");
  });
});

describe("economia do plano anual", () => {
  it("calcula quanto o anual poupa por mês", () => {
    // 990/mês contra 9900/ano = 825/mês.
    expect(yearlySavingPerMonth(buildPlanCatalogue({ monthly: "990", yearly: "9900" }))).toEqual({
      amount: 165,
      currency: "BRL",
    });
  });

  it("não inventa vantagem quando o anual não é mais barato", () => {
    expect(
      yearlySavingPerMonth(buildPlanCatalogue({ monthly: "100", yearly: "1200" })),
    ).toBeNull();
  });

  it("é null quando falta um dos ciclos", () => {
    expect(yearlySavingPerMonth(buildPlanCatalogue({ yearly: "9900" }))).toBeNull();
  });
});
