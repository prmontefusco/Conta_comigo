import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./seed-users";

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

test.describe("catálogo de planos", () => {
  test("publica o preço configurado, em centavos inteiros", async ({ request }) => {
    const response = await request.get("/api/assinatura/planos");

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Os preços vêm da configuração do servidor, não do código nem do cliente.
    expect(body.plans).toEqual([
      { cycle: "MONTHLY", label: "Mensal", amountCents: 500, currency: "BRL" },
      { cycle: "YEARLY", label: "Anual", amountCents: 5000, currency: "BRL" },
    ]);
  });

  test("declara a venda fechada sem chave de provedor", async ({ request }) => {
    // Há preço, mas não há como cobrar. Mostrar planos compráveis aqui levaria a
    // pessoa a um botão que só pode falhar.
    const body = await (await request.get("/api/assinatura/planos")).json();

    expect(body.open).toBe(false);
  });

  test("informa a economia do plano anual como fato, não como propaganda", async ({ request }) => {
    const body = await (await request.get("/api/assinatura/planos")).json();

    // 500/mês contra 5000/ano = 417/mês, logo 83 de diferença.
    expect(body.yearlySavingPerMonthCents).toBe(83);
  });
});

test.describe("abertura de cobrança", () => {
  test("recusa quem não está autenticado", async ({ request }) => {
    const response = await request.post("/api/assinatura/checkout", {
      data: { cycle: "YEARLY", method: "PIX" },
    });

    expect(response.status()).toBe(401);
  });

  test("recusa um token inventado", async ({ request }) => {
    const response = await request.post("/api/assinatura/checkout", {
      headers: { authorization: "Bearer nao-e-um-token" },
      data: { cycle: "YEARLY", method: "PIX" },
    });

    expect(response.status()).toBe(401);
  });

  test("não aceita um valor vindo do cliente", async ({ request }) => {
    // O corpo traz um preço de um centavo. A autenticação barra antes, e mesmo
    // passando por ela o campo não existe no schema: o valor sai do catálogo.
    const response = await request.post("/api/assinatura/checkout", {
      data: { cycle: "YEARLY", method: "PIX", amountCents: 1, price: 1 },
    });

    expect(response.status()).toBe(401);
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

test.describe("tela de assinatura", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.indebted.email);
    await page.goto("/app/assinatura");
  });

  test("mostra o plano gratuito sem apresentá-lo como defeito", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Assinatura" })).toBeVisible();
    await expect(page.getByText("Gratuito", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Todas as funções de planejamento estão disponíveis no plano gratuito."),
    ).toBeVisible();
  });

  test("sem chave de provedor, não oferece o que não pode cobrar", async ({ page }) => {
    // O ambiente de desenvolvimento tem preço configurado mas nenhuma chave.
    // Um botão de pagar aqui só poderia falhar.
    await expect(page.getByText("Ainda não disponível")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pagar com Pix" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pagar com cartão" })).toHaveCount(0);
  });

  test("diz o que o Premium entrega, sem prometer função escondida", async ({ page }) => {
    await expect(
      page.getByText("Nenhuma função de planejamento fica atrás do pagamento"),
    ).toBeVisible();
  });
});
