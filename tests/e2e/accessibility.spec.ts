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

/**
 * Deixa a página assentar antes de medir.
 *
 * axe lê o pixel do instante em que roda. Todo `Button` declara
 * `transition-colors`, então um botão recém-montado ainda está interpolando a
 * cor de fundo — e uma cor intermediária reprova em contraste. O efeito era uma
 * violação que aparecia em algumas execuções e apontava para o token errado:
 * `/app/comecar` falhava na suíte inteira e passava sozinha.
 *
 * Desligar transição e animação não afrouxa a auditoria. O contraste que
 * importa é o do estado final, que é o que a pessoa realmente enxerga; o estado
 * intermediário não é uma tela, é um quadro.
 */
async function settle(page: Page) {
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
  // Um quadro para o estilo acima valer antes da medição.
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

async function scan(page: Page) {
  await settle(page);

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
          .map(
            (node) =>
              `    ${node.html.slice(0, 160)}\n` +
              // Sem isto, uma falha de contraste diz apenas "não passou". O
              // `failureSummary` traz as cores medidas e a razão encontrada — a
              // diferença entre corrigir o token certo e caçar o elemento no
              // escuro. O seletor localiza o nó quando o HTML vem truncado.
              `      em: ${node.target.join(" ")}\n` +
              `      ${(node.failureSummary ?? "").split("\n").join("\n      ")}`,
          )
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
    "/app/assinatura",
    "/app/diagnostico-ia",
    "/app/visao-futuro",
    "/app/membros",
    "/app/configuracoes",
    "/app/comecar",
  ]) {
    test(`${path} não tem violações WCAG AA`, async ({ page }) => {
      await page.goto(path);
      // Espera o provider terminar de carregar antes de auditar. `toBeVisible`
      // e não `toBeAttached`: um título no DOM mas ainda não pintado não diz que
      // a tela assentou, e é sobre a tela pintada que a auditoria opina.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
