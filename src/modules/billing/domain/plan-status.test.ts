import { describe, expect, it } from "vitest";
import type { Instant } from "@/core/date/calendar-date";
import {
  canOfferPurchase,
  describePlanStatus,
  planStatusLabel,
  TRIAL_ENDING_SOON_DAYS,
} from "./plan-status";
import { TRIAL_DAYS, type Subscription } from "./subscription";

const NOW = new Date("2026-09-08T12:00:00.000Z");
const instant = (value: string): Instant => value as Instant;
const daysFromNow = (days: number): Instant =>
  new Date(NOW.getTime() + days * 86_400_000).toISOString() as Instant;
const daysAgo = (days: number): Instant => daysFromNow(-days);

function paid(overrides: Partial<Subscription> = {}): Subscription {
  return {
    userId: "uid",
    plan: "PREMIUM",
    status: "ACTIVE",
    cycle: "MONTHLY",
    provider: "ASAAS",
    externalTxId: "cob_1",
    expiresAt: daysFromNow(20),
    activatedAt: daysAgo(10),
    updatedAt: daysAgo(10),
    ...overrides,
  };
}

/** Conta criada há tempo suficiente para o teste de 30 dias já ter acabado. */
const contaVelha = daysAgo(TRIAL_DAYS + 5);
/** Conta nova: o teste está correndo. */
const contaNova = daysAgo(2);

describe("describePlanStatus — assinatura paga", () => {
  it("informa o ciclo contratado, que antes não aparecia em lugar nenhum", () => {
    const anual = describePlanStatus({
      subscription: paid({ cycle: "YEARLY", expiresAt: daysFromNow(300) }),
      accountCreatedAt: contaVelha,
      emailVerified: true,
      now: NOW,
    });

    expect(anual.kind).toBe("PAID");
    expect(anual.cycle).toBe("YEARLY");
    expect(anual.cycleLabel).toBe("Anual");
    expect(planStatusLabel(anual)).toBe("Premium anual");
  });

  it("conta os dias que faltam e diz a data do fim", () => {
    const status = describePlanStatus({
      subscription: paid({ expiresAt: daysFromNow(20) }),
      accountCreatedAt: contaVelha,
      emailVerified: true,
      now: NOW,
    });

    expect(status.daysRemaining).toBe(20);
    expect(status.endsAt).toBe(daysFromNow(20));
  });

  it("não avisa de fim próximo enquanto a renovação não abre", () => {
    // Avisar antes da janela seria pedir uma ação que a rota recusaria com 409.
    const status = describePlanStatus({
      subscription: paid({ expiresAt: daysFromNow(20) }),
      accountCreatedAt: contaVelha,
      emailVerified: true,
      now: NOW,
    });

    expect(status.endingSoon).toBe(false);
    expect(status.canRenew).toBe(false);
    expect(canOfferPurchase(status)).toBe(false);
  });

  it("avisa e abre a renovação dentro da janela", () => {
    const status = describePlanStatus({
      subscription: paid({ expiresAt: daysFromNow(3) }),
      accountCreatedAt: contaVelha,
      emailVerified: true,
      now: NOW,
    });

    expect(status.endingSoon).toBe(true);
    expect(status.canRenew).toBe(true);
    expect(canOfferPurchase(status)).toBe(true);
  });

  it("o teste não sobrepõe uma assinatura paga de conta nova", () => {
    // Quem assinou no primeiro mês tem plano pago, não teste. Mostrar "teste"
    // a quem pagou seria dizer que o dinheiro não valeu nada.
    const status = describePlanStatus({
      subscription: paid(),
      accountCreatedAt: contaNova,
      emailVerified: true,
      now: NOW,
    });

    expect(status.kind).toBe("PAID");
  });
});

describe("describePlanStatus — período de teste", () => {
  it("conta os dias restantes e a data do fim", () => {
    const status = describePlanStatus({
      subscription: null,
      accountCreatedAt: daysAgo(2),
      emailVerified: true,
      now: NOW,
    });

    expect(status.kind).toBe("TRIAL");
    expect(status.plan).toBe("PREMIUM");
    expect(status.daysRemaining).toBe(TRIAL_DAYS - 2);
    expect(status.trialTotalDays).toBe(TRIAL_DAYS);
    expect(planStatusLabel(status)).toBe("Premium — período de teste");
  });

  it("não tem ciclo: teste não é compra", () => {
    const status = describePlanStatus({
      subscription: null,
      accountCreatedAt: contaNova,
      emailVerified: true,
      now: NOW,
    });

    expect(status.cycle).toBeNull();
    expect(status.cycleLabel).toBeNull();
  });

  it("avisa quando o teste está acabando", () => {
    const status = describePlanStatus({
      subscription: null,
      accountCreatedAt: daysAgo(TRIAL_DAYS - TRIAL_ENDING_SOON_DAYS),
      emailVerified: true,
      now: NOW,
    });

    expect(status.endingSoon).toBe(true);
  });

  it("durante o teste a compra continua aberta, e não é renovação", () => {
    const status = describePlanStatus({
      subscription: null,
      accountCreatedAt: contaNova,
      emailVerified: true,
      now: NOW,
    });

    expect(canOfferPurchase(status)).toBe(true);
    expect(status.canRenew).toBe(false);
    expect(status.hadPaidPlan).toBe(false);
  });
});

describe("describePlanStatus — teste travado por e-mail não confirmado", () => {
  it("é um passo pendente, não um prazo acabando", () => {
    const status = describePlanStatus({
      subscription: null,
      accountCreatedAt: contaNova,
      emailVerified: false,
      now: NOW,
    });

    expect(status.kind).toBe("TRIAL_PENDING_EMAIL");
    expect(status.plan).toBe("FREE");
    // Tratar como urgência apressaria quem só precisa abrir um e-mail.
    expect(status.endingSoon).toBe(false);
  });
});

describe("describePlanStatus — gratuito", () => {
  it("não inventa prazo para quem não tem nenhum", () => {
    const status = describePlanStatus({
      subscription: null,
      accountCreatedAt: contaVelha,
      emailVerified: true,
      now: NOW,
    });

    expect(status.kind).toBe("FREE");
    expect(status.daysRemaining).toBeNull();
    expect(status.endsAt).toBeNull();
    expect(planStatusLabel(status)).toBe("Gratuito");
  });

  it("uma assinatura vencida volta ao gratuito, e lembra que já houve plano", () => {
    // O verbo da tela muda: para quem já pagou, "renovar"; para quem nunca
    // pagou, "assinar".
    const status = describePlanStatus({
      subscription: paid({ expiresAt: daysAgo(1) }),
      accountCreatedAt: contaVelha,
      emailVerified: true,
      now: NOW,
    });

    expect(status.kind).toBe("FREE");
    expect(status.plan).toBe("FREE");
    expect(status.hadPaidPlan).toBe(true);
    expect(canOfferPurchase(status)).toBe(true);
  });

  it("uma assinatura vencida não faz a conta voltar para o teste", () => {
    const status = describePlanStatus({
      subscription: paid({ expiresAt: daysAgo(1) }),
      accountCreatedAt: contaVelha,
      emailVerified: true,
      now: NOW,
    });

    expect(status.kind).not.toBe("TRIAL");
  });
});

describe("describePlanStatus — cobrança aberta", () => {
  it("sinaliza a cobrança pendente sem conceder nada", () => {
    const status = describePlanStatus({
      subscription: {
        userId: "uid",
        plan: "FREE",
        status: "PENDING",
        cycle: "MONTHLY",
        externalTxId: "cob_2",
        updatedAt: instant("2026-09-08T10:00:00.000Z"),
      },
      accountCreatedAt: contaVelha,
      emailVerified: true,
      now: NOW,
    });

    expect(status.pendingCharge).toBe(true);
    expect(status.plan).toBe("FREE");
  });
});
