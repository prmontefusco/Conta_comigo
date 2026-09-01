import { expect, test } from "@playwright/test";

/**
 * Consultoria com IA.
 *
 * Esta rota chama um modelo cobrado por token. Sem autenticação ela é uma fatura
 * aberta ao público: qualquer pessoa com o endereço gasta a chave do projeto num
 * laço, sem conta e sem teto. Foi exatamente assim que ela nasceu, e é por isso
 * que os testes abaixo existem.
 *
 * Eles afirmam a barreira, não a resposta: nenhum deles precisa de chave
 * configurada, porque a recusa acontece antes de qualquer chamada ao provedor.
 */

const CONTEXT = {
  score: 40,
  statusLabel: "Atenção",
  totalCashFormatted: "R$ 100,00",
  monthlyIncomeFormatted: "R$ 3.000,00",
  monthlyExpensesFormatted: "R$ 2.900,00",
  monthlyNetFormatted: "R$ 100,00",
  debtCommitmentRatio: 40,
  totalDebtFormatted: "R$ 9.000,00",
  overdueBillsCount: 1,
  overdueBillsTotalFormatted: "R$ 300,00",
  emergencyFundMonths: 0,
  monthsToDebtFree: 30,
  debtFreeDateFormatted: "01/03/2029",
};

test.describe("rota de consultoria com IA", () => {
  test("recusa quem não está autenticado", async ({ request }) => {
    const response = await request.post("/api/ai/diagnostico", {
      data: { message: "Como saio das dívidas?", context: CONTEXT },
    });

    expect(response.status()).toBe(401);
  });

  test("recusa um token inventado", async ({ request }) => {
    const response = await request.post("/api/ai/diagnostico", {
      headers: { authorization: "Bearer nao-e-um-token" },
      data: { message: "Como saio das dívidas?", context: CONTEXT },
    });

    expect(response.status()).toBe(401);
  });

  test("recusa antes de olhar o corpo, por maior que ele seja", async ({ request }) => {
    // O teto de tamanho protege o custo por chamada; a autenticação protege o
    // fato de haver chamada. Um corpo enorme sem token não pode chegar ao Zod
    // nem ao provedor.
    const response = await request.post("/api/ai/diagnostico", {
      data: { message: "a".repeat(100_000), context: CONTEXT },
    });

    expect(response.status()).toBe(401);
  });

  test("não responde a GET", async ({ request }) => {
    // Um GET que respondesse seria alcançável por link, prefetch e crawler.
    const response = await request.get("/api/ai/diagnostico");

    expect(response.status()).toBe(405);
  });
});
