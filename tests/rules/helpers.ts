import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";

/**
 * Harness for the Security Rules suite.
 *
 * Runs against the Firestore emulator on a `demo-` project, so these tests can
 * never touch real data. `npm run test:rules` starts the emulator for you.
 */

export const PROJECT_ID = "demo-conta-comigo-rules";

export const HOUSEHOLD_A = "household-a";
export const HOUSEHOLD_B = "household-b";

export const OWNER_A = "uid-owner-a";
export const ADMIN_A = "uid-admin-a";
export const MEMBER_A = "uid-member-a";
export const VIEWER_A = "uid-viewer-a";
export const OWNER_B = "uid-owner-b";
export const OUTSIDER = "uid-outsider";

export async function createTestEnvironment(): Promise<RulesTestEnvironment> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const [hostname, port] = host.split(":");

  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: hostname ?? "127.0.0.1",
      port: Number(port ?? 8080),
    },
  });
}

export const NOW = "2026-08-28T12:00:00.000Z";

export function auditFor(uid: string) {
  return { createdAt: NOW, updatedAt: NOW, createdBy: uid };
}

export const brl = (amount: number) => ({ amount, currency: "BRL" });

/**
 * Seeds two households with a full cast of roles, bypassing the rules.
 *
 * Using `withSecurityRulesDisabled` for setup keeps each test about the rule
 * it is exercising rather than about how the fixture was built.
 */
export async function seedHouseholds(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await db.doc(`households/${HOUSEHOLD_A}`).set({
      name: "Família A",
      ownerUid: OWNER_A,
      memberUids: [OWNER_A, ADMIN_A, MEMBER_A, VIEWER_A],
      settings: { timezone: "America/Sao_Paulo", currency: "BRL", locale: "pt-BR" },
      archived: false,
      ...auditFor(OWNER_A),
    });

    const rolesA: Array<[string, string]> = [
      [OWNER_A, "OWNER"],
      [ADMIN_A, "ADMIN"],
      [MEMBER_A, "MEMBER"],
      [VIEWER_A, "VIEWER"],
    ];

    for (const [uid, role] of rolesA) {
      await db.doc(`households/${HOUSEHOLD_A}/members/${uid}`).set({
        uid,
        householdId: HOUSEHOLD_A,
        displayName: uid,
        role,
        status: "ACTIVE",
        ...auditFor(OWNER_A),
      });
    }

    await db.doc(`households/${HOUSEHOLD_B}`).set({
      name: "Família B",
      ownerUid: OWNER_B,
      memberUids: [OWNER_B],
      settings: { timezone: "America/Sao_Paulo", currency: "BRL", locale: "pt-BR" },
      archived: false,
      ...auditFor(OWNER_B),
    });

    await db.doc(`households/${HOUSEHOLD_B}/members/${OWNER_B}`).set({
      uid: OWNER_B,
      householdId: HOUSEHOLD_B,
      displayName: OWNER_B,
      role: "OWNER",
      status: "ACTIVE",
      ...auditFor(OWNER_B),
    });

    // One document of each kind in household A, so isolation tests have
    // something real to try to reach.
    await db.doc(`households/${HOUSEHOLD_A}/accounts/account-a`).set({
      householdId: HOUSEHOLD_A,
      name: "Conta corrente",
      type: "CHECKING",
      openingBalance: brl(150000),
      openingBalanceDate: "2026-01-01",
      visibility: "HOUSEHOLD",
      includeInTotals: true,
      archived: false,
      ...auditFor(OWNER_A),
    });

    await db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).set({
      householdId: HOUSEHOLD_A,
      kind: "EXPENSE",
      amount: brl(9990),
      transactionDate: "2026-08-10",
      competenceDate: "2026-08-10",
      description: "Supermercado",
      visibility: "HOUSEHOLD",
      accountId: "account-a",
      categoryId: "category-a",
      ...auditFor(OWNER_A),
    });

    await db.doc(`households/${HOUSEHOLD_A}/obligations/obligation-a`).set({
      householdId: HOUSEHOLD_A,
      direction: "OUTFLOW",
      origin: "MANUAL",
      description: "Energia",
      amount: brl(30000),
      dueDate: "2026-09-10",
      competenceDate: "2026-09-01",
      expenseNature: "FIXED",
      confidence: "CONFIRMED",
      visibility: "HOUSEHOLD",
      status: "SCHEDULED",
      settledAmount: brl(0),
      settlementTransactionIds: [],
      ...auditFor(OWNER_A),
    });

    await db.doc(`users/${OWNER_A}`).set({
      uid: OWNER_A,
      displayName: "Owner A",
      email: "owner-a@example.test",
      plan: "FREE",
      onboardingCompletedSteps: [],
      ...auditFor(OWNER_A),
    });
  });
}

export function as(testEnv: RulesTestEnvironment, uid: string): RulesTestContext {
  return testEnv.authenticatedContext(uid);
}

export function anonymous(testEnv: RulesTestEnvironment): RulesTestContext {
  return testEnv.unauthenticatedContext();
}

/** A valid new transaction payload, so tests vary only what they care about. */
export function transactionPayload(
  uid: string,
  householdId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    householdId,
    kind: "EXPENSE",
    amount: brl(5000),
    transactionDate: "2026-08-28",
    competenceDate: "2026-08-28",
    description: "Padaria",
    visibility: "HOUSEHOLD",
    accountId: "account-a",
    categoryId: "category-a",
    ...auditFor(uid),
    ...overrides,
  };
}
