import { describe, expect, it } from "vitest";
import type { Instant } from "@/core/date/calendar-date";
import { buildPlanNotice, formatDays } from "./plan-notice";
import type { PlanStatus } from "./plan-status";

/**
 * O que estes testes guardam é, sobretudo, uma **ausência**.
 *
 * A tentação num produto pago é deixar a faixa do plano sempre visível. Aqui
 * ela competiria com "Atenção agora" na tela de quem tem conta vencida, e
 * viraria pressão comercial sobre alguém apertado. O aviso só aparece quando
 * há uma ação real a tomar — e é isso que os três primeiros casos protegem.
 */

const base: PlanStatus = {
  kind: "FREE",
  plan: "FREE",
  cycle: null,
  cycleLabel: null,
  daysRemaining: null,
  endsAt: null,
  endingSoon: false,
  canRenew: false,
  hadPaidPlan: false,
  pendingCharge: false,
  trialTotalDays: 30,
};

const status = (overrides: Partial<PlanStatus>): PlanStatus => ({ ...base, ...overrides });
const DATA = "1º de outubro de 2026";

describe("buildPlanNotice — silêncio por padrão", () => {
  it("não diz nada a quem está no gratuito e sem pendência", () => {
    expect(buildPlanNotice(status({}), null)).toBeNull();
  });

  it("não diz nada durante o teste enquanto ele não está acabando", () => {
    expect(
      buildPlanNotice(status({ kind: "TRIAL", plan: "PREMIUM", daysRemaining: 22 }), DATA),
    ).toBeNull();
  });

  it("não diz nada a quem pagou e está longe do vencimento", () => {
    expect(
      buildPlanNotice(
        status({
          kind: "PAID",
          plan: "PREMIUM",
          cycle: "YEARLY",
          cycleLabel: "Anual",
          daysRemaining: 300,
          endsAt: "2027-07-05T12:00:00.000Z" as Instant,
          hadPaidPlan: true,
        }),
        DATA,
      ),
    ).toBeNull();
  });
});

describe("buildPlanNotice — quando há o que fazer", () => {
  it("a cobrança em aberto vem antes de qualquer prazo", () => {
    const notice = buildPlanNotice(
      status({
        kind: "TRIAL",
        plan: "PREMIUM",
        daysRemaining: 2,
        endingSoon: true,
        pendingCharge: true,
      }),
      DATA,
    );

    expect(notice?.title).toMatch(/pagamento aguardando confirmação/i);
  });

  it("pede a confirmação de e-mail sem tratar como urgência", () => {
    const notice = buildPlanNotice(status({ kind: "TRIAL_PENDING_EMAIL" }), DATA);

    expect(notice?.tone).toBe("info");
    expect(notice?.title).toMatch(/Confirme seu e-mail/);
  });

  it("ao avisar o fim do teste, garante que nada é cobrado sozinho", () => {
    const notice = buildPlanNotice(
      status({ kind: "TRIAL", plan: "PREMIUM", daysRemaining: 3, endingSoon: true }),
      DATA,
    );

    expect(notice?.title).toBe("Seu período de teste termina em 3 dias");
    expect(notice?.body).toContain("nada é cobrado sozinho");
    expect(notice?.body).toContain(DATA);
  });

  it("nomeia o ciclo contratado ao avisar o fim do plano pago", () => {
    const notice = buildPlanNotice(
      status({
        kind: "PAID",
        plan: "PREMIUM",
        cycle: "MONTHLY",
        cycleLabel: "Mensal",
        daysRemaining: 1,
        endingSoon: true,
        canRenew: true,
        hadPaidPlan: true,
      }),
      DATA,
    );

    expect(notice?.title).toBe("Seu plano mensal termina em 1 dia");
    expect(notice?.action).toBe("Renovar");
  });

  it("continua legível sem a data, quando o fuso não pôde ser resolvido", () => {
    const notice = buildPlanNotice(
      status({ kind: "TRIAL", plan: "PREMIUM", daysRemaining: 2, endingSoon: true }),
      null,
    );

    expect(notice).not.toBeNull();
    expect(notice?.body).not.toContain("undefined");
    expect(notice?.body).not.toContain("null");
  });
});

describe("formatDays", () => {
  it("concorda o singular e o plural", () => {
    expect(formatDays(1)).toBe("1 dia");
    expect(formatDays(2)).toBe("2 dias");
    expect(formatDays(0)).toBe("0 dias");
  });
});
