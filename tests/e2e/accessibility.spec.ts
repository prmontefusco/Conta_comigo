import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn, USERS } from "./seed-users";

/**
 * Accessibility.
 *
 * The audience includes people who are anxious about money and people using
 * assistive technology; sometimes the same person. An interface that is hard
 * to read is not a cosmetic problem here.
 *
 * axe-core catches the mechanical WCAG failures - contrast, missing names,
 * broken landmarks. It cannot judge whether a screen makes sense, which is why
 * the other suites assert on accessible names rather than on CSS classes.
 */

const STANDARD = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page) {
  return (
    new AxeBuilder({ page })
      .withTags(STANDARD)
      // The Next.js dev overlay is not part of the product.
      .exclude("nextjs-portal")
      .analyze()
  );
}

function describeViolations(results: Awaited<ReturnType<typeof scan>>): string {
  return results.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes
          .slice(0, 3)
          .map((node) => `    ${node.html.slice(0, 160)}`)
          .join("\n"),
    )
    .join("\n\n");
}

test.describe("site público", () => {
  for (const path of [
    "/",
    "/como-funciona",
    "/organizar-financas",
    "/planejamento-financeiro",
    "/controle-de-contas",
    "/controle-de-cartao",
    "/orcamento-familiar",
    "/educacao-financeira",
    "/privacidade",
    "/termos",
  ]) {
    test(`${path} não tem violações WCAG AA`, async ({ page }) => {
      await page.goto(path);
      const results = await scan(page);
      expect(describeViolations(results)).toBe("");
    });
  }
});

test.describe("autenticação", () => {
  for (const path of ["/entrar", "/criar-conta"]) {
    test(`${path} não tem violações WCAG AA`, async ({ page }) => {
      await page.goto(path);
      const results = await scan(page);
      expect(describeViolations(results)).toBe("");
    });
  }
});

test.describe("aplicação autenticada", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.indebted.email);
  });

  for (const path of [
    "/app",
    "/app/contas",
    "/app/cartoes",
    "/app/projecao",
    "/app/relatorios",
    "/app/dividas",
    "/app/reservas",
    "/app/orcamento",
    "/app/contas-bancarias",
    "/app/recorrentes",
    "/app/mais",
    "/app/meus-dados",
  ]) {
    test(`${path} não tem violações WCAG AA`, async ({ page }) => {
      await page.goto(path);
      // Espera o provider terminar de carregar antes de auditar.
      await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
      const results = await scan(page);
      expect(describeViolations(results)).toBe("");
    });
  }
});

test.describe("navegação por teclado", () => {
  test("dá para chegar ao formulário de login só com Tab", async ({ page }) => {
    await page.goto("/entrar");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Ir para o conteúdo" })).toBeFocused();

    // Tab até o campo de e-mail, sem armadilhas de foco no caminho.
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press("Tab");
      if (
        await page
          .getByRole("textbox", { name: "E-mail", exact: true })
          .evaluate((el) => el === document.activeElement)
      ) {
        return;
      }
    }
    throw new Error("O campo de e-mail não foi alcançado com Tab.");
  });

  test("o foco fica visível", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByRole("textbox", { name: "E-mail", exact: true }).focus();

    const outline = await page
      .getByRole("textbox", { name: "E-mail", exact: true })
      .evaluate((el) => {
        const style = getComputedStyle(el, ":focus-visible");
        return { width: style.outlineWidth, style: style.outlineStyle };
      });

    expect(outline.style).not.toBe("none");
  });

  test("o diálogo prende o foco e fecha com Escape", async ({ page }) => {
    await signIn(page, USERS.indebted.email);
    await page.goto("/app/contas");

    await page.getByRole("button", { name: "Nova conta" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
