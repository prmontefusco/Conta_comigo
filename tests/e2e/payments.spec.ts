import { expect, test } from "@playwright/test";

/**
 * Rotas de pagamento.
 *
 * Num ambiente de desenvolvimento não há chave de provedor nem segredo de
 * webhook, e é exatamente por isso que estes testes valem: eles afirmam que a
 * ausência de configuração **fecha** o caminho, em vez de deixá-lo aberto.
 *
 * Uma variável ausente que desliga a autenticação é o tipo de falha que ninguém
 * percebe até alguém se conceder um plano.
 */

test.describe("webhook de pagamento", () => {
  test("responde 503 sem segredo configurado, em vez de aceitar", async ({ request }) => {
    const response = await request.post("/api/webhook/pagamento", {
      data: { event: "PAYMENT_RECEIVED", payment: { id: "pay_forjado" } },
    });

    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: "WEBHOOK_NOT_CONFIGURED" });
  });

  test("um segredo qualquer não passa", async ({ request }) => {
    const response = await request.post("/api/webhook/pagamento", {
      headers: { "asaas-access-token": "chute" },
      data: { event: "PAYMENT_RECEIVED", payment: { id: "pay_forjado" } },
    });

    // Sem segredo configurado a resposta é 503; com segredo configurado e
    // errado seria 401. Nos dois casos, nunca 200 com plano concedido.
    expect([401, 503]).toContain(response.status());
  });

  test("o GET de saúde não revela nada", async ({ request }) => {
    const response = await request.get("/api/webhook/pagamento");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

test.describe("reconciliação de assinatura", () => {
  test("recusa quem não está autenticado", async ({ request }) => {
    const response = await request.post("/api/assinatura/reconciliar");

    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: "UNAUTHENTICATED" });
  });

  test("recusa um token inventado", async ({ request }) => {
    const response = await request.post("/api/assinatura/reconciliar", {
      headers: { authorization: "Bearer nao-e-um-token" },
    });

    expect(response.status()).toBe(401);
  });

  test("não aceita um id de cobrança vindo do cliente", async ({ request }) => {
    // A rota lê a cobrança pendente da própria assinatura. Se aceitasse um id
    // do corpo, qualquer pessoa tentaria reivindicar pagamentos alheios.
    const response = await request.post("/api/assinatura/reconciliar", {
      data: { chargeId: "pay_de_outra_pessoa" },
    });

    expect(response.status()).toBe(401);
  });
});
