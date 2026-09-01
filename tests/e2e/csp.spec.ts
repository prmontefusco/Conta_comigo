import { expect, test, type Page } from "@playwright/test";
import { signIn, USERS } from "./seed-users";

/**
 * Content Security Policy.
 *
 * A política sai como `Report-Only` (ver next.config.ts): o navegador relata o
 * que ela bloquearia, sem bloquear. Isto aqui é o que transforma esse relato em
 * informação — sem um teste lendo os relatórios, `Report-Only` é um cabeçalho
 * que ninguém consulta, e a CSP nunca sai da gaveta.
 *
 * Enquanto estes testes passarem, a política está pronta para virar obrigatória.
 * Quando um deles falhar, a saída diz exatamente qual diretiva e qual recurso —
 * que é a pergunta que se faz ao apertar uma CSP.
 *
 * Ressalva honesta: o ambiente local não carrega AdSense (docs/ADSENSE.md), e há
 * teste E2E garantindo justamente isso. Logo, as diretivas de anúncio **não**
 * são exercidas aqui. Elas só serão validadas contra tráfego real, e é por isso
 * que a política ainda não é obrigatória.
 */

interface Violation {
  readonly directive: string;
  readonly blocked: string;
}

/**
 * Coleta violações pelo evento `securitypolicyviolation`, que o navegador
 * dispara mesmo em modo de observação.
 *
 * Precisa ser registrado antes da navegação: um recurso bloqueado durante o
 * carregamento inicial dispara o evento antes de qualquer script de teste rodar.
 */
async function collectViolations(page: Page): Promise<Violation[]> {
  const violations: Violation[] = [];

  await page.exposeFunction("__reportCsp", (violation: Violation) => {
    violations.push(violation);
  });

  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const detail = event as SecurityPolicyViolationEvent;
      // `frame-ancestors` vem do cabeçalho obrigatório, não da política em
      // observação, e não é violável a partir da própria página.
      if (detail.violatedDirective === "frame-ancestors") return;
      const report = (window as unknown as Record<string, unknown>).__reportCsp;
      if (typeof report !== "function") return;
      (report as (v: Violation) => void)({
        directive: detail.violatedDirective,
        blocked: detail.blockedURI,
      });
    });
  });

  return violations;
}

/**
 * Duas violações são do ambiente local, não da configuração de produção.
 *
 * Elas são filtradas aqui, e não afrouxando a política, porque a política
 * servida precisa continuar sendo a de produção — é ela que se quer validar.
 *
 * 1. **`eval` em `script-src`.** O servidor de desenvolvimento do Next usa
 *    `eval` para HMR e source maps. Um build de produção não usa.
 * 2. **As origens dos emuladores** (`127.0.0.1:9099` e `:8080`). Em produção o
 *    Auth fala com `identitytoolkit.googleapis.com` e carrega seu iframe de
 *    `*.firebaseapp.com`, ambos liberados pela política. Porta diferente é
 *    origem diferente, então `'self'` não cobre o emulador.
 *
 *    O filtro é por **origem**, não por diretiva: o Auth emulado aparece em
 *    `connect-src` (as chamadas) e em `frame-src` (o iframe do handler), e
 *    provavelmente em outras conforme o SDK mude. O que torna essas violações
 *    ignoráveis é de onde vêm, não como se manifestam.
 *
 * **O que este teste não prova, por causa disso:** como o `eval` do modo de
 * desenvolvimento é ignorado, uma dependência que usasse `eval` em produção
 * passaria despercebida aqui. Validar isso exige rodar contra um build de
 * produção — está registrado em docs/PRODUCTION_READINESS.md como condição para
 * tornar a CSP obrigatória.
 */
const EMULATOR_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost):(9099|8080|4000|4400)\b/;

function isLocalEnvironmentArtefact(violation: Violation): boolean {
  if (violation.directive.startsWith("script-src") && violation.blocked === "eval") return true;

  return EMULATOR_ORIGIN.test(violation.blocked);
}

function describeViolations(violations: readonly Violation[]): string {
  return violations
    .filter((violation) => !isLocalEnvironmentArtefact(violation))
    .map((v) => `${v.directive} bloquearia ${v.blocked}`)
    .join("\n");
}

test.describe("site público", () => {
  for (const path of ["/", "/como-funciona", "/privacidade"]) {
    test(`${path} não viola a política`, async ({ page }) => {
      const violations = await collectViolations(page);

      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

      expect(describeViolations(violations)).toBe("");
    });
  }
});

test.describe("aplicação autenticada", () => {
  test("entrar e usar o painel não viola a política", async ({ page }) => {
    // O login exercita o Firebase Auth e o painel exercita o Firestore — os dois
    // terceiros que uma CSP mal escrita derruba primeiro.
    const violations = await collectViolations(page);

    await signIn(page, USERS.indebted.email);
    await expect(page.getByRole("heading", { name: "Resumo das suas finanças" })).toBeVisible();

    await page.goto("/app/projecao");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(describeViolations(violations)).toBe("");
  });
});

test.describe("cabeçalhos", () => {
  test("a política de observação é servida, e a obrigatória barra enquadramento", async ({
    request,
  }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["content-security-policy-report-only"]).toContain("default-src 'self'");
    // `frame-ancestors` precisa estar no cabeçalho que vale: em `Report-Only`
    // ele é ignorado, e o clickjacking passaria.
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
