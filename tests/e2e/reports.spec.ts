import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./seed-users";

/**
 * Reports.
 *
 * Each section is checked by the question it is titled with, because that
 * title is the contract: a section that stops answering its question should
 * stop existing.
 */

test.describe("relatórios", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.indebted.email);
    await page.goto("/app/relatorios");
  });

  test("cada bloco é titulado pela pergunta que responde", async ({ page }) => {
    for (const question of [
      "Quanto entrou e quanto saiu?",
      "Para onde meu dinheiro foi?",
      "Isso é sempre assim?",
      "Quanto do meu custo é obrigatório?",
      "O orçamento está funcionando?",
      "Estou reduzindo meu endividamento?",
    ]) {
      await expect(page.getByRole("heading", { name: question })).toBeVisible();
    }
  });

  test("todo gráfico tem uma alternativa em texto para leitores de tela", async ({ page }) => {
    // `count()` não espera nada, então é preciso garantir que a página já
    // renderizou antes de contar - senão o teste passa a medir o carregamento.
    await expect(page.locator("figure svg").first()).toBeAttached();

    const svgs = await page.locator("figure svg").count();
    const tables = await page.locator("figure table").count();

    // Os SVGs são decorativos; os números vivem numa tabela real.
    expect(svgs).toBeGreaterThan(0);
    expect(tables).toBe(svgs);

    for (const svg of await page.locator("figure svg").all()) {
      await expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("mostra a trajetória da dívida com data de término de cada uma", async ({ page }) => {
    const bloco = page.getByRole("region", { name: "Estou reduzindo meu endividamento?" });

    await expect(bloco.getByText("Devido hoje")).toBeVisible();
    await expect(bloco.getByText("Em 12 meses")).toBeVisible();
    await expect(bloco.getByText("Quando cada dívida termina")).toBeVisible();
  });

  test("separa despesas fixas das variáveis", async ({ page }) => {
    const bloco = page.getByRole("region", { name: "Quanto do meu custo é obrigatório?" });

    await expect(bloco.getByText("Fixas", { exact: true })).toBeVisible();
    await expect(bloco.getByText(/dos compromissos deste mês/)).toBeVisible();
  });

  test("filtra a evolução por categoria", async ({ page }) => {
    const bloco = page.getByRole("region", { name: "Isso é sempre assim?" });

    const select = bloco.getByLabel("Categoria");
    const alimentacao = await select
      .locator("option")
      .filter({ hasText: "Alimentação" })
      .first()
      .getAttribute("value");

    await select.selectOption(alimentacao);
    await expect(bloco.getByText("Média dos meses com movimento")).toBeVisible();
  });

  test("troca a janela de meses", async ({ page }) => {
    await page.getByLabel("Período").selectOption("12");
    await expect(page.getByRole("heading", { name: "Relatórios", level: 1 })).toBeVisible();
  });

  test("não carrega publicidade real localmente", async ({ page }) => {
    await expect(page.getByTestId("ad-placeholder-dashboard-inline")).toBeAttached();
  });
});

test.describe("relatórios em outro cenário", () => {
  test("funciona para uma família organizada", async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/relatorios");

    await expect(page.getByRole("heading", { name: "Relatórios", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quanto entrou e quanto saiu?" })).toBeVisible();
  });

  test("mostra o último mês com dados, não o mês corrente vazio", async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/relatorios");

    const bloco = page.getByRole("region", { name: "Para onde meu dinheiro foi?" });
    const mes = bloco.getByLabel("Mês");

    // O seed pára de gerar histórico no mês anterior, então o mês corrente
    // ainda não tem nada. O bloco deve cair para o último mês com movimento em
    // vez de exibir uma lista vazia.
    await expect(mes).not.toHaveValue(/em andamento/);
    await expect(bloco.getByText("Total do mês:")).toBeVisible();
  });
});
