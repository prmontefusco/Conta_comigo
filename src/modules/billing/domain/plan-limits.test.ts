import { describe, expect, it } from "vitest";
import { FREE_LIMITS, PREMIUM_LIMITS, canAddOne, limitsFor } from "./plan-limits";

/**
 * Os limites do plano gratuito.
 *
 * Existem por dois motivos que puxam em direções opostas, e o teste guarda os
 * dois: sem anúncios a assinatura é a única receita, então o gratuito precisa
 * ter teto; e o público-alvo é quem está endividado, então o teto não pode
 * cair sobre o que ajuda alguém a sair da dívida.
 */
describe("limites por plano", () => {
  it("o gratuito é mais apertado que o Premium em tudo que é comodidade", () => {
    expect(FREE_LIMITS.members).toBeLessThan(PREMIUM_LIMITS.members);
    expect(FREE_LIMITS.creditCards).toBeLessThan(PREMIUM_LIMITS.creditCards);
    expect(FREE_LIMITS.forecastMonths).toBeLessThan(PREMIUM_LIMITS.forecastMonths);
    expect(FREE_LIMITS.documentReading).toBe(false);
    expect(FREE_LIMITS.aiAdvisor).toBe(false);
  });

  it("o gratuito ainda projeta meses suficientes para ver o mês seguinte chegar", () => {
    // Menos que isto e a tela deixa de responder "como fica o mês que vem",
    // que é a pergunta de quem está apertado.
    expect(FREE_LIMITS.forecastMonths).toBeGreaterThanOrEqual(3);
  });

  it("o gratuito comporta um casal, que é a casa mais comum", () => {
    expect(FREE_LIMITS.members).toBeGreaterThanOrEqual(2);
  });

  it("limitsFor devolve o conjunto certo para cada plano", () => {
    expect(limitsFor("FREE")).toEqual(FREE_LIMITS);
    expect(limitsFor("PREMIUM")).toEqual(PREMIUM_LIMITS);
  });
});

describe("canAddOne", () => {
  it("libera enquanto houver espaço", () => {
    const check = canAddOne("creditCards", "FREE", FREE_LIMITS.creditCards - 1);

    expect(check.allowed).toBe(true);
    expect(check.message).toBe("");
  });

  it("bloqueia no teto e diz qual é o teto e o que o Premium muda", () => {
    const check = canAddOne("members", "FREE", FREE_LIMITS.members);

    expect(check.allowed).toBe(false);
    expect(check.message).toContain(String(FREE_LIMITS.members));
    expect(check.message).toContain(String(PREMIUM_LIMITS.members));
  });

  it("no Premium a mensagem não oferece Premium a quem já tem", () => {
    const check = canAddOne("members", "PREMIUM", PREMIUM_LIMITS.members);

    expect(check.allowed).toBe(false);
    expect(check.message).not.toContain("O Premium vai até");
  });
});
