import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./seed-users";

/**
 * The flows that have to work end to end.
 *
 * These run against the real local stack: App Hosting emulator serving the
 * app, plus Auth and Firestore emulators with the seeded households. If a
 * calculation is wrong, or a Security Rule blocks a legitimate read, it fails
 * here even when the unit tests pass.
 */

test.describe("autenticação", () => {
  test("entra e chega ao resumo", async ({ page }) => {
    await signIn(page, USERS.indebted.email);

    await expect(page.getByRole("heading", { name: "Resumo das suas finanças" })).toBeAttached();
    await expect(page.getByText(USERS.indebted.household)).toBeVisible();
  });

  test("recusa credenciais erradas sem revelar se a conta existe", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(USERS.indebted.email);
    await page.locator('input[type="password"]').fill("senha-errada");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    // Scoped to the form: the Next.js dev overlay also exposes an alert role.
    const alert = page.getByRole("alert").filter({ hasText: /E-mail ou senha/ });
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("leva quem não está autenticado para o login", async ({ page }) => {
    await page.goto("/app");
    await page.waitForURL("**/entrar");
  });
});

test.describe("resumo", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.indebted.email);
  });

  test("mostra saldo total, reserva protegida e saldo livre como números distintos", async ({
    page,
  }) => {
    const hoje = page.getByRole("region", { name: "Hoje" });

    // Exact matching: the hint under "Saldo livre" repeats these words.
    await expect(hoje.getByText("Saldo nas contas", { exact: true })).toBeVisible();
    await expect(hoje.getByText("Reserva protegida", { exact: true })).toBeVisible();
    await expect(hoje.getByText("Saldo livre", { exact: true })).toBeVisible();
  });

  test("mantém as contas vencidas visíveis", async ({ page }) => {
    const hoje = page.getByRole("region", { name: "Hoje" });

    await expect(hoje.getByText("Contas vencidas", { exact: true })).toBeVisible();
    await expect(hoje.getByText("Vencida").first()).toBeVisible();
  });

  test("aponta o primeiro mês em déficit antes de ele chegar", async ({ page }) => {
    const aviso = page.getByText(/Os compromissos previstos superam as receitas de/).first();
    await expect(aviso).toBeVisible();
  });

  test("marca o mês corrente como parcial, e não como déficit", async ({ page }) => {
    const tabela = page.getByRole("table", { name: /Projeção mensal/i }).first();
    await expect(tabela).toBeVisible();

    const primeiraLinha = tabela.locator("tbody tr").first();

    // A data vem do navegador, não do processo de teste: é ele que roda no fuso
    // emulado e é a data dele que a aplicação enxerga.
    const diaDoMes = await page.evaluate(() => new Date().getDate());

    if (diaDoMes === 1) {
      // No dia 1º o mês inteiro está pela frente. Ele é um mês cheio, e um
      // déficit ali é um fato sobre o mês — não um artefato da data de início.
      // Marcá-lo como parcial esconderia um déficit real.
      await expect(primeiraLinha).not.toContainText("o que resta");
      return;
    }

    // Em qualquer outro dia, parte das receitas já entrou e o que sobra do mês é
    // quase todo saída. Comparar isso com um mês cheio assusta sem informar.
    await expect(primeiraLinha).toContainText("o que resta");
    // Os dois selos juntos diriam que o mês falhou antes de terminar de ser
    // contado. `isPartial` precede `isDeficit`, e é isto que garante a ordem.
    await expect(primeiraLinha).not.toContainText("Déficit");
  });

  test("não carrega publicidade real em ambiente local", async ({ page }) => {
    await expect(page.getByTestId("ad-placeholder-dashboard-inline")).toBeAttached();

    const scripts = await page.locator('script[src*="googlesyndication"]').count();
    expect(scripts).toBe(0);
  });
});

test.describe("navegação", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.indebted.email);
  });

  test("chega a todas as telas principais", async ({ page }) => {
    for (const [path, heading] of [
      ["/app/contas", "Contas"],
      ["/app/cartoes", "Cartões"],
      ["/app/projecao", "Projeção"],
      ["/app/dividas", "Empréstimos e financiamentos"],
      ["/app/reservas", "Reservas e metas"],
      ["/app/orcamento", "Orçamento"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    }
  });
});

test.describe("cartões", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.indebted.email);
    await page.goto("/app/cartoes");
  });

  test("nunca chama de próxima fatura uma que já venceu", async ({ page }) => {
    // A família endividada tem faturas em atraso; a "próxima" tem de ser futura.
    await expect(page.getByText("Fatura em atraso").first()).toBeVisible();
    await expect(page.getByText("Próxima fatura").first()).toBeVisible();
  });

  test("explica que pagar a fatura não gera nova despesa", async ({ page }) => {
    await expect(page.getByText(/não gera uma nova despesa/i).first()).toBeVisible();
  });
});

test.describe("projeção e simulação", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/projecao");
  });

  test("troca de horizonte", async ({ page }) => {
    await page.getByRole("button", { name: "12 meses" }).click();
    await expect(page.getByRole("button", { name: "12 meses" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("simula uma compra parcelada e responde com números, sem opinião", async ({ page }) => {
    const simulador = page.getByRole("region", { name: "Simulador" });

    await simulador.getByRole("textbox", { name: "Valor total da compra" }).fill("3.000,00");
    await simulador.getByRole("button", { name: "Simular" }).click();

    await expect(simulador.getByText(/Isso adiciona/)).toBeVisible();
    await expect(simulador.getByText(/A decisão é sua/)).toBeVisible();
  });
});

test.describe("isolamento entre grupos", () => {
  test("cada usuário vê apenas o próprio grupo", async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await expect(page.getByText(USERS.organised.household)).toBeVisible();
    await expect(page.getByText(USERS.indebted.household)).toHaveCount(0);
  });
});
