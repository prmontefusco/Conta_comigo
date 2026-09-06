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

    // Os preços vêm da configuração do servidor, não do código nem do cliente
    // (ADR 0010). Por isso este teste verifica a **forma** e não os valores:
    // um teste que fixa "500" quebra no dia em que alguém reajusta o preço,
    // que é uma decisão de negócio e não uma regressão. Foi o que aconteceu —
    // ele ficou vermelho apontando para um preço que já não era o vigente.
    expect(body.plans).toHaveLength(2);
    expect(body.plans[0]).toMatchObject({ cycle: "MONTHLY", label: "Mensal", currency: "BRL" });
    expect(body.plans[1]).toMatchObject({ cycle: "YEARLY", label: "Anual", currency: "BRL" });

    for (const plan of body.plans) {
      expect(Number.isInteger(plan.amountCents)).toBe(true);
      expect(plan.amountCents).toBeGreaterThan(0);
    }

    // O anual precisa custar mais que um mês e menos que doze; fora disso
    // alguém trocou os campos de lugar.
    const [monthly, yearly] = body.plans;
    expect(yearly.amountCents).toBeGreaterThan(monthly.amountCents);
    expect(yearly.amountCents).toBeLessThan(monthly.amountCents * 12);
  });

  test("declara a venda fechada sem chave de provedor", async ({ request }) => {
    // Há preço, mas não há como cobrar. Mostrar planos compráveis aqui levaria a
    // pessoa a um botão que só pode falhar.
    const body = await (await request.get("/api/assinatura/planos")).json();

    expect(body.open).toBe(false);
  });

  test("informa a economia do plano anual como fato, não como propaganda", async ({ request }) => {
    const body = await (await request.get("/api/assinatura/planos")).json();

    // A economia é derivada dos preços configurados, então o que se verifica é
    // a relação: mensal menos (anual ÷ 12), em centavos inteiros.
    const [monthly, yearly] = body.plans;
    const expected = monthly.amountCents - Math.round(yearly.amountCents / 12);

    expect(body.yearlySavingPerMonthCents).toBe(expected);
    expect(Number.isInteger(body.yearlySavingPerMonthCents)).toBe(true);
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

  // Toda conta nova entra no teste de 30 dias, e as contas semeadas são
  // criadas agora — então a tela mostra "Premium (teste)", não "Gratuito".
  // O teste antigo assumia que não existia período de teste, o que era
  // verdade quando o site já o anunciava e o código não o implementava.
  test("mostra o período de teste com os dias que faltam", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Assinatura" })).toBeVisible();
    await expect(page.getByText("Premium (teste)", { exact: true })).toBeVisible();
    await expect(page.getByText(/dias restantes/)).toBeVisible();
  });

  test("diz que a conta continua funcionando quando o teste acabar", async ({ page }) => {
    await expect(
      page.getByText(/passa para o plano gratuito e continua funcionando/),
    ).toBeVisible();
  });

  test("sem chave de provedor, não oferece o que não pode cobrar", async ({ page }) => {
    // O ambiente de desenvolvimento tem preço configurado mas nenhuma chave.
    // Um botão de pagar aqui só poderia falhar.
    await expect(page.getByText("Ainda não disponível")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pagar com Pix" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pagar com cartão" })).toHaveCount(0);
  });

  test("explica que o pagamento é avulso e não renova sozinho", async ({ page }) => {
    // A tela prometia "cancele com 1 clique" e não havia o que cancelar: a
    // cobrança no provedor é avulsa. O texto agora diz isso, e o teste guarda.
    await expect(page.getByText(/não existe cobrança recorrente/)).toBeVisible();
    await expect(page.getByText(/não há renovação automática/)).toBeVisible();
  });
});
