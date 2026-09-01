import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

/**
 * O limitador existe para conter custo: a consultoria de IA chama um modelo
 * cobrado por token. Cada caso aqui é uma forma de o teto vazar.
 */

const LIMIT = 3;
const WINDOW = 60_000;
const T0 = 1_000_000;

beforeEach(() => {
  resetRateLimits();
});

describe("checkRateLimit", () => {
  it("libera até o limite e recusa a chamada seguinte", () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      expect(checkRateLimit("uid-1", LIMIT, WINDOW, T0).allowed).toBe(true);
    }

    expect(checkRateLimit("uid-1", LIMIT, WINDOW, T0).allowed).toBe(false);
  });

  it("conta cada chave separadamente", () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      checkRateLimit("uid-1", LIMIT, WINDOW, T0);
    }

    // Uma pessoa esgotar a cota não pode calar as outras.
    expect(checkRateLimit("uid-2", LIMIT, WINDOW, T0).allowed).toBe(true);
  });

  it("abre de novo quando a janela vira", () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      checkRateLimit("uid-1", LIMIT, WINDOW, T0);
    }
    expect(checkRateLimit("uid-1", LIMIT, WINDOW, T0).allowed).toBe(false);

    expect(checkRateLimit("uid-1", LIMIT, WINDOW, T0 + WINDOW).allowed).toBe(true);
  });

  it("não estende a janela a cada tentativa recusada", () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      checkRateLimit("uid-1", LIMIT, WINDOW, T0);
    }

    // Bater na porta perto do fim da janela não pode empurrar a reabertura para
    // frente: quem insiste ficaria preso para sempre.
    checkRateLimit("uid-1", LIMIT, WINDOW, T0 + WINDOW - 1);

    expect(checkRateLimit("uid-1", LIMIT, WINDOW, T0 + WINDOW).allowed).toBe(true);
  });

  it("informa quantos segundos faltam, arredondando para cima", () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      checkRateLimit("uid-1", LIMIT, WINDOW, T0);
    }

    const result = checkRateLimit("uid-1", LIMIT, WINDOW, T0 + 30_000);

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(30);
  });

  it("nunca devolve zero segundo de espera numa recusa", () => {
    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      checkRateLimit("uid-1", LIMIT, WINDOW, T0);
    }

    // `Retry-After: 0` convida o cliente a tentar imediatamente, e a tentativa
    // seria recusada de novo.
    const result = checkRateLimit("uid-1", LIMIT, WINDOW, T0 + WINDOW - 1);

    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
