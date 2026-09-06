import { expect, test } from "@playwright/test";

/**
 * The public site.
 *
 * Two things matter here: the pages exist and are readable, and no real
 * advertising is ever contacted from a developer machine.
 */

const PAGES = [
  ["/", "Saber onde você está"],
  ["/como-funciona", "Como funciona"],
  ["/organizar-financas", "Como organizar as finanças"],
  ["/planejamento-financeiro", "Planejamento financeiro"],
  ["/controle-de-contas", "Controle de contas a pagar"],
  ["/controle-de-cartao", "Controle de cartão de crédito"],
  ["/orcamento-familiar", "Orçamento familiar"],
  ["/educacao-financeira", "Educação financeira"],
  ["/privacidade", "Política de Privacidade"],
  ["/termos", "Termos de Uso"],
] as const;

test.describe("páginas públicas", () => {
  for (const [path, heading] of PAGES) {
    test(`${path} carrega e tem um h1`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    });
  }

  test("nenhuma página pública faz requisição a terceiros", async ({ page }) => {
    // Publicidade nunca carrega fora de produção, e a fonte é servida do
    // próprio domínio: o build não depende de rede e o navegador de quem usa
    // não conversa com o Google (docs/LOCAL_DEVELOPMENT.md, docs/ADSENSE.md).
    const external: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("http://127.0.0.1:") || url.startsWith("data:")) return;
      external.push(url);
    });

    for (const [path] of PAGES) {
      await page.goto(path);
    }

    expect(external).toEqual([]);
  });

  // `ads.txt` existia para declarar o publisher da rede de anúncios. A rota
  // saiu junto com a publicidade, e o teste que resta é que ela realmente não
  // está lá — voltar a servi-la seria voltar a ter anúncio.
  test("ads.txt não existe mais, porque não há publicidade", async ({ page }) => {
    const response = await page.goto("/ads.txt");
    expect(response?.status()).toBe(404);
  });

  test("robots bloqueia indexação do ambiente local", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    expect(await response!.text()).toContain("Disallow: /");
  });

  test("o aviso de que não é consultoria financeira está no rodapé", async ({ page }) => {
    await page.goto("/");
    // O rodapé diz "consultoria de investimentos"; o teste procurava
    // "recomendação". O texto está certo e o teste é que tinha envelhecido.
    await expect(page.getByText(/consultoria de investimentos/i)).toBeVisible();
    await expect(page.getByText(/não somos.*instituição bancária/i)).toBeVisible();
  });
});

test.describe("acessibilidade básica", () => {
  test("o link de pular para o conteúdo funciona pelo teclado", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: "Ir para o conteúdo" });
    await expect(skip).toBeFocused();
  });

  test("a landing page não rola horizontalmente no mobile", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
