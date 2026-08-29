import type { Page } from "@playwright/test";

/**
 * The fixtures the seed creates. Kept in one place so a change to
 * scripts/seed-data.ts breaks one file, not every test.
 */
export const SEED_PASSWORD = "conta1234";

export const USERS = {
  organised: { email: "ana@exemplo.test", household: "Família Silva" },
  tight: { email: "carla@exemplo.test", household: "Família Costa" },
  indebted: { email: "diego@exemplo.test", household: "Família Almeida" },
} as const;

/**
 * Fields are located by accessible name, not by label text.
 *
 * The visible label carries a required marker ("Senha*") that is
 * `aria-hidden`, so what a screen reader announces is "Senha". Asserting
 * against the accessible name tests the thing that actually matters.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/entrar");
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
  await page.locator('input[type="password"]').fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/app", { timeout: 30_000 });
}
