import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, logger, scrub } from "./logger";

/**
 * A log that leaks a balance is a privacy incident, not a bug report. These
 * tests are the guarantee that the scrubbing is structural rather than a
 * convention people have to remember.
 */

describe("scrub", () => {
  it("remove qualquer valor com a forma de dinheiro", () => {
    expect(scrub({ delta: { amount: 123456, currency: "BRL" } })).toEqual({
      delta: "[omitido]",
    });
  });

  it("remove chaves sensíveis mesmo quando o valor parece inofensivo", () => {
    expect(
      scrub({
        operation: "settleObligation",
        amount: 100,
        email: "alguem@exemplo.test",
        token: "abc",
        description: "Aluguel de janeiro",
      }),
    ).toEqual({
      operation: "settleObligation",
      amount: "[omitido]",
      email: "[omitido]",
      token: "[omitido]",
      description: "[omitido]",
    });
  });

  it("não é sensível a maiúsculas na chave", () => {
    expect(scrub({ CreditLimit: 5000, IdToken: "x" })).toEqual({
      CreditLimit: "[omitido]",
      IdToken: "[omitido]",
    });
  });

  it("desce em objetos aninhados", () => {
    expect(
      scrub({ context: { account: { openingBalance: 900, name: "Conta corrente" } } }),
    ).toEqual({
      context: { account: { openingBalance: "[omitido]", name: "Conta corrente" } },
    });
  });

  it("preserva o que é útil para depurar", () => {
    expect(
      scrub({
        operation: "listObligations",
        path: "households/h1/obligations",
        code: "permission-denied",
      }),
    ).toEqual({
      operation: "listObligations",
      path: "households/h1/obligations",
      code: "permission-denied",
    });
  });

  it("corta strings longas em vez de despejar um documento inteiro", () => {
    const result = scrub({ note: "x".repeat(500) }) as { note: string };
    expect(result.note.length).toBeLessThan(220);
    expect(result.note.endsWith("…")).toBe(true);
  });

  it("limita o tamanho dos arrays", () => {
    expect((scrub({ items: Array(50).fill(1) }) as { items: number[] }).items).toHaveLength(20);
  });

  it("para de descer em objetos muito aninhados", () => {
    // O que importa é haver um limite, não onde exatamente ele cai: um contexto
    // de log não deveria ter cinco níveis, e um objeto cíclico ou gigante não
    // pode travar quem estiver depurando.
    expect(scrub({ a: { b: { c: { d: { e: { f: 1 } } } } } })).toEqual({
      a: { b: { c: { d: { e: "[omitido]" } } } },
    });
  });

  it("não quebra com null, undefined ou funções", () => {
    expect(scrub(null)).toBeNull();
    expect(scrub(undefined)).toBeUndefined();
    expect(scrub({ fn: () => 1 })).toEqual({ fn: "[omitido]" });
  });
});

describe("describeError", () => {
  it("extrai código e mensagem de um erro do Firebase", () => {
    expect(
      describeError({
        code: "permission-denied",
        name: "FirebaseError",
        message: "Missing permissions",
      }),
    ).toEqual({
      code: "permission-denied",
      name: "FirebaseError",
      message: "Missing permissions",
    });
  });

  it("reduz o que não reconhece ao tipo", () => {
    expect(describeError("algo")).toEqual({ type: "string" });
    expect(describeError(42)).toEqual({ type: "number" });
  });
});

/**
 * O transporte.
 *
 * Em produção o log precisa sair como uma linha de JSON com `severity`: é isso
 * que o Cloud Logging transforma numa entrada consultável, e é sobre a consulta
 * que se cria o alerta de taxa de erro. Texto solto não é contável.
 */
describe("transporte", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function asProduction() {
    vi.stubEnv("NODE_ENV", "production");
  }

  it("escreve uma linha de JSON com severity no servidor em produção", () => {
    asProduction();
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    logger.error("Falha ao cobrar.", { operation: "checkout", code: "PROVIDER_DOWN" });

    expect(write).toHaveBeenCalledTimes(1);
    const linha = write.mock.calls[0]?.[0] as string;

    // Uma linha, um evento: várias linhas virariam várias entradas soltas.
    expect(linha.endsWith("\n")).toBe(true);
    expect(linha.trimEnd().includes("\n")).toBe(false);

    expect(JSON.parse(linha)).toEqual({
      severity: "ERROR",
      message: "Falha ao cobrar.",
      service: "conta-comigo",
      context: { operation: "checkout", code: "PROVIDER_DOWN" },
    });
  });

  it("continua limpando o contexto ao estruturar", () => {
    asProduction();
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    logger.error("Falhou.", { saldo: { amount: 999, currency: "BRL" }, email: "a@b.test" });

    const entrada = JSON.parse(write.mock.calls[0]?.[0] as string);
    // Estruturar o log não pode afrouxar o que ele carrega.
    expect(JSON.stringify(entrada)).not.toContain("999");
    expect(JSON.stringify(entrada)).not.toContain("a@b.test");
  });

  it("não escreve em process.stdout no navegador", () => {
    asProduction();
    // Em produção o bundle do cliente também roda este logger. `process.stdout`
    // não existe ali: escrever nele derrubaria a tela.
    vi.stubGlobal("window", {});
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("Falhou no cliente.");

    expect(write).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it("silencia debug em produção", () => {
    asProduction();
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    logger.debug("ruído");

    expect(write).not.toHaveBeenCalled();
  });

  it("mantém a saída legível fora de produção", () => {
    const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.info("Subiu.");

    expect(write).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalled();
  });
});
