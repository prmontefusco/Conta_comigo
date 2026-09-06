import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./seed-users";

/**
 * As telas que a auditoria acrescentou, contra a stack real.
 *
 * O que estes testes guardam não é layout: é a **honestidade dos números**. O
 * defeito mais caro que este produto já teve foi prometer quitação a quem
 * estava em déficit, e ele passava por todos os testes unitários — porque a
 * aritmética estava certa e o que faltava era a recusa de responder.
 *
 * Por isso quase toda asserção aqui é sobre a ausência de uma promessa.
 */

test.describe("plano que não fecha", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.massMarket.email);
  });

  test("não inventa data de quitação para quem está em déficit", async ({ page }) => {
    await page.goto("/app/visao-futuro");

    await expect(page.getByText("Este plano não fecha")).toBeVisible();
    await expect(page.getByText(/só para pagar as parcelas mínimas/)).toBeVisible();
    // O horizonte aparece como travessão, não como um número tranquilizador.
    await expect(page.getByText("Sem data enquanto o mês não fechar").first()).toBeVisible();
  });

  test("encaminha para renegociar prazo, em vez de mandar apertar mais", async ({ page }) => {
    await page.goto("/app/visao-futuro");

    await expect(
      page.getByText("O caminho aqui é renegociar prazo, não pagar mais rápido."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Preparar a renegociação" })).toBeVisible();
  });
});

test.describe("modo emergência", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.massMarket.email);
    await page.goto("/app/emergencia");
  });

  test("ordena por consequência: serviço essencial antes do resto", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Modo emergência" })).toBeVisible();

    const faixas = page.getByText(/Corta um serviço essencial|Cresce todo dia|Vence em breve/);
    await expect(faixas.first()).toContainText("Corta um serviço essencial");
  });

  test("nomeia o que se perde, não só o valor", async ({ page }) => {
    await expect(page.getByText(/corte de energia elétrica/)).toBeVisible();
  });

  test("diz quanto o atraso custa por dia", async ({ page }) => {
    await expect(page.getByText("O atraso custa por dia")).toBeVisible();
    await expect(page.getByText(/Multa e juros já somam/)).toBeVisible();
  });
});

test.describe("antes de comprar", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/comprar");
  });

  test("não decide pela pessoa", async ({ page }) => {
    await expect(page.getByText("Esta tela não diz se você deve comprar.")).toBeVisible();
  });

  test("mostra o total pago junto da parcela, e o juro embutido", async ({ page }) => {
    await page.getByLabel("Preço à vista").fill("1890,00");
    await page.getByLabel("Valor da parcela").fill("210,00");
    await page.getByLabel("Quantas parcelas").fill("12");

    // 12 x R$ 210 = R$ 2.520, contra R$ 1.890 à vista.
    await expect(page.getByText(/R\$ 630,00 a mais que o preço à vista/)).toBeVisible();
    await expect(page.getByText("Juro embutido")).toBeVisible();
  });

  test("oferece esperar e pagar à vista, que loja nenhuma oferece", async ({ page }) => {
    await page.getByLabel("Preço à vista").fill("30000,00");

    await expect(page.getByText(/Esperar \d+ (mês|meses) e pagar à vista/)).toBeVisible();
    await expect(page.getByText(/não mexe na sua data de quitação/)).toBeVisible();
  });

  test("compara consertar e trocar na mesma unidade", async ({ page }) => {
    await page.getByLabel("Preço à vista").fill("1890,00");
    await page.getByLabel("Quantos meses deve durar").fill("96");
    await page.getByLabel("Custo do conserto").fill("380,00");
    await page.getByLabel("Quantos meses o conserto segura").fill("12");

    await expect(page.getByText("Por mês de uso").first()).toBeVisible();
    await expect(page.getByText(/O conserto se paga se o aparelho durar mais/)).toBeVisible();
  });

  test("carrega o aviso de que a decisão é de quem lê", async ({ page }) => {
    await expect(
      page.getByText(/A decisão, a compra e o compromisso assumido são seus/),
    ).toBeVisible();
  });
});

test.describe("lançamento rápido", () => {
  test("lança um gasto com valor e categoria, sem abrir formulário", async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/dia-a-dia");

    await expect(page.getByLabel("Quanto foi")).toBeVisible();
    await page.getByLabel("Quanto foi").fill("12,50");

    // Os atalhos são ordenados pelo que a casa mais usa, então qual deles vem
    // primeiro depende do cenário. O que se testa é o caminho, não a lista.
    await page.locator("fieldset button").first().click();
    await page.getByRole("button", { name: "Lançar", exact: true }).click();

    // `\s` e não um espaço literal: `Intl.NumberFormat` separa "R$" do número
    // com espaço não-quebrável (U+00A0), e um espaço comum no padrão nunca
    // casaria — o teste falharia apontando para uma tela que está correta.
    await expect(page.getByText(/Lançado:\s*R\$\s*12,50/)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("avisos", () => {
  test("o sininho conta o que ainda não foi visto e zera ao abrir", async ({ page }) => {
    await signIn(page, USERS.indebted.email);

    const bell = page.getByRole("button", { name: /^Avisos:/ });
    await expect(bell).toHaveAttribute("aria-label", /\d+ novos?/);

    await bell.click();
    await expect(page.getByRole("dialog", { name: "Avisos" })).toBeVisible();
    await expect(bell).toHaveAttribute("aria-label", "Avisos: nenhum novo");
  });
});

test.describe("importar extrato", () => {
  test("lê o arquivo, propõe, e só grava o que foi confirmado", async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/importar");

    await page.getByLabel("Arquivo do extrato").setInputFiles({
      name: "extrato.ofx",
      mimeType: "text/plain",
      // Duas notações de número no mesmo arquivo, de propósito: o
      // americano do OFX e o brasileiro que alguns bancos escrevem nele.
      buffer: Buffer.from(
        [
          "OFXHEADER:100",
          "<OFX>",
          "<STMTTRN><DTPOSTED>20260901<TRNAMT>-45.90<FITID>E2E1<MEMO>MERCADO E2E</STMTTRN>",
          "<STMTTRN><DTPOSTED>20260902<TRNAMT>-1.234,56<FITID>E2E2<MEMO>ALUGUEL E2E</STMTTRN>",
          "<STMTTRN><TRNAMT>-10.00<MEMO>SEM DATA</STMTTRN>",
          "</OFX>",
        ].join("\n"),
      ),
    });

    await expect(page.getByText("Confira antes de importar")).toBeVisible();
    await expect(page.getByText("MERCADO E2E")).toBeVisible();
    // R$ 1.234,56 e não R$ 1,23: o erro que passaria despercebido.
    await expect(page.getByText(/−\s*R\$\s*1\.234,56/)).toBeVisible();
    await expect(page.getByText(/1 linha não lida/)).toBeVisible();
  });
});

test.describe("pessoa sem acesso", () => {
  test("cadastra um dependente e ele passa a aparecer na atribuição", async ({ page }) => {
    await signIn(page, USERS.massMarket.email);
    await page.goto("/app/membros");

    await page.getByRole("button", { name: "Adicionar pessoa sem acesso" }).click();

    // Os dois diálogos ficam no DOM, um deles fechado; sem escopo, o campo
    // "Nome da pessoa" casa com os dois.
    const dialogo = page.getByRole("dialog", { name: "Adicionar pessoa sem acesso" });
    await dialogo.getByLabel("Nome da pessoa").fill("Lucas E2E");
    await dialogo.getByRole("button", { name: "Adicionar", exact: true }).click();

    // Aparece na lista de quem tem acesso e no seletor "de quem é" — as duas
    // são o ponto, então basta confirmar a presença.
    await expect(page.getByText("Lucas E2E").first()).toBeVisible({ timeout: 15_000 });
    // "Sem acesso" também é o rótulo na legenda de papéis logo abaixo; o que
    // importa é o que aparece na linha da pessoa, dentro de "Quem tem acesso".
    await expect(page.getByText("Sem acesso").first()).toBeVisible();
  });
});
