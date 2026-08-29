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

  test("nenhuma página pública carrega scripts de anúncio localmente", async ({ page }) => {
    const adRequests: string[] = [];
    page.on("request", (request) => {
      if (/googlesyndication|doubleclick|googleadservices/.test(request.url())) {
        adRequests.push(request.url());
      }
    });

    for (const [path] of PAGES) {
      await page.goto(path);
    }

    expect(adRequests).toEqual([]);
  });

  test("ads.txt não expõe publisher id fora de produção", async ({ page }) => {
    const response = await page.goto("/ads.txt");
    expect(response?.status()).toBe(200);
    expect(await response!.text()).toContain("Sem publicidade configurada");
  });

  test("robots bloqueia indexação do ambiente local", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    expect(await response!.text()).toContain("Disallow: /");
  });

  test("o aviso de que não é consultoria financeira está no rodapé", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/não fazemos recomendação de investimentos/i)).toBeVisible();
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
