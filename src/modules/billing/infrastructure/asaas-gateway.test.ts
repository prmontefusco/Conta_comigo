import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AsaasGateway,
  PaymentGatewayUnavailableError,
  PaymentProviderError,
} from "./asaas-gateway";

/**
 * Barreiras de ambiente do gateway.
 *
 * Estes testes não exercitam a API do Asaas — exercitam as duas condições em
 * que o gateway **se recusa a falar** com ela. Foram escritos depois de uma
 * verificação local disparar uma requisição real para `api.asaas.com`: sob
 * `npm run dev:local`, o emulador do App Hosting usa `apphosting.yaml` como
 * base, e o endereço de produção veio junto.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  // Nenhuma requisição deve sair daqui. Se sair, o teste falha em vez de vazar.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("O gateway tentou fazer uma requisição de rede.");
    }),
  );
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
});

const anyCharge = {
  userId: "u1",
  cycle: "MONTHLY" as const,
  amount: { amount: 500, currency: "BRL" as const },
};

describe("endereço da API", () => {
  it("recusa a API de produção fora de produção", async () => {
    process.env.ASAAS_API_KEY = "chave-qualquer";
    process.env.ASAAS_API_BASE_URL = "https://api.asaas.com/v3";

    await expect(new AsaasGateway().createPixCharge(anyCharge)).rejects.toBeInstanceOf(
      PaymentGatewayUnavailableError,
    );
  });

  it("recusa também quando o endereço não foi configurado", async () => {
    // Sem configuração, o padrão é produção — e o padrão não pode ser o perigoso.
    process.env.ASAAS_API_KEY = "chave-qualquer";
    delete process.env.ASAAS_API_BASE_URL;

    await expect(new AsaasGateway().createPixCharge(anyCharge)).rejects.toBeInstanceOf(
      PaymentGatewayUnavailableError,
    );
  });

  it("aceita o sandbox e é para lá que a requisição vai", async () => {
    process.env.ASAAS_API_KEY = "chave-qualquer";
    process.env.ASAAS_API_BASE_URL = "https://api-sandbox.asaas.com/v3";

    // Passa da barreira e tenta a rede — que este teste bloqueia de propósito.
    // A falha resultante é de comunicação, não de configuração.
    await expect(new AsaasGateway().createPixCharge(anyCharge)).rejects.toBeInstanceOf(
      PaymentProviderError,
    );

    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url.startsWith("https://api-sandbox.asaas.com/v3")).toBe(true);
  });
});

describe("chave ausente", () => {
  it("falha fechado, sem tentar cobrar", async () => {
    delete process.env.ASAAS_API_KEY;
    process.env.ASAAS_API_BASE_URL = "https://api-sandbox.asaas.com/v3";

    await expect(new AsaasGateway().createPixCharge(anyCharge)).rejects.toBeInstanceOf(
      PaymentGatewayUnavailableError,
    );

    // Falta de configuração precisa chegar à rota como 503, e não virar 502 pelo
    // catch-all: dizer que o provedor falhou seria culpar quem não tem culpa.
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
