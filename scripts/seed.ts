/**
 * Seeds the local emulators with development fixtures.
 *
 * Refuses to run against anything but a `demo-` project, so it can never write
 * to real data. Idempotent: it wipes the seeded households first, so running it
 * twice leaves the same result as running it once.
 *
 *   npm run seed
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-conta-comigo";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

if (!PROJECT_ID.startsWith("demo-")) {
  console.error(
    `\n[seed] Recusando executar contra o projeto "${PROJECT_ID}".\n` +
      `       O seed só roda em projetos demo-* com os emuladores ligados.\n` +
      `       Veja docs/LOCAL_DEVELOPMENT.md.\n`,
  );
  process.exit(1);
}

// Point the Admin SDK at the emulators before it is imported.
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.GCLOUD_PROJECT = PROJECT_ID;

// Imports are hoisted, but none of them *reads* the emulator variables at
// load time: the Admin SDK looks them up when initializeApp/getFirestore run,
// which happens below, after the assignments above.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { instant } from "../src/core/date/calendar-date";
import { DEFAULT_HOUSEHOLD_SETTINGS } from "../src/modules/household/domain/household";
import {
  categoriesFor,
  realisedHistory,
  SEED_HOUSEHOLDS,
  seedAnchors,
  SEED_TIMEZONE,
} from "./seed-data";

const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

const NOW = instant();
const anchors = seedAnchors();

async function main() {
  console.info(`[seed] Projeto: ${PROJECT_ID}`);
  console.info(`[seed] Firestore: ${FIRESTORE_HOST} | Auth: ${AUTH_HOST}`);
  console.info(`[seed] "Hoje" no fuso ${SEED_TIMEZONE}: ${anchors.today}\n`);

  await clearSeededData();

  for (const household of SEED_HOUSEHOLDS) {
    await seedHousehold(household);
  }

  printSummary();
}

async function clearSeededData() {
  for (const household of SEED_HOUSEHOLDS) {
    const ref = db.doc(`households/${household.id}`);
    await db.recursiveDelete(ref);

    for (const user of household.users) {
      await db.doc(`users/${user.uid}`).delete();
      await auth.deleteUser(user.uid).catch(() => undefined);
    }
  }
  console.info("[seed] Dados anteriores removidos.\n");
}

async function seedHousehold(household: (typeof SEED_HOUSEHOLDS)[number]) {
  const content = household.build(anchors);
  const owner = household.users.find((user) => user.role === "OWNER");
  if (!owner) throw new Error(`Cenário ${household.id} não tem OWNER.`);

  const audit = { createdAt: NOW, updatedAt: NOW, createdBy: owner.uid };

  /* --- Auth users --------------------------------------------------- */

  for (const user of household.users) {
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    });

    await db.doc(`users/${user.uid}`).set({
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      plan: "FREE",
      defaultHouseholdId: household.id,
      onboardingCompletedSteps: [
        "CREATE_HOUSEHOLD",
        "ADD_MAIN_INCOME",
        "ADD_ACCOUNTS",
        "ADD_RECURRING_BILLS",
        "ADD_CARDS",
        "ADD_DEBTS",
      ],
      acceptedTermsAt: NOW,
      ...audit,
      createdBy: user.uid,
    });
  }

  /* --- Household and members ---------------------------------------- */

  await db.doc(`households/${household.id}`).set({
    name: household.name,
    ownerUid: owner.uid,
    memberUids: household.users.map((user) => user.uid),
    settings: { ...DEFAULT_HOUSEHOLD_SETTINGS, timezone: SEED_TIMEZONE },
    archived: false,
    ...audit,
  });

  for (const user of household.users) {
    await db.doc(`households/${household.id}/members/${user.uid}`).set({
      uid: user.uid,
      householdId: household.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: "ACTIVE",
      joinedAt: NOW,
      ...audit,
    });
  }

  /* --- Financial documents ------------------------------------------ */

  await writeCollection(household.id, "categories", categoriesFor(household.id), audit);
  await writeCollection(household.id, "accounts", content.accounts, audit);
  await writeCollection(household.id, "creditCards", content.creditCards, audit);
  await writeCollection(household.id, "cardPurchases", content.cardPurchases, audit);
  await writeCollection(household.id, "recurringRules", content.recurringRules, audit);
  await writeCollection(household.id, "obligations", content.obligations, audit);

  // Realised movement for the past months, so the reports have something to
  // compare. Generated from the household's own recurring rules, which keeps
  // the history consistent with the projection ahead of it.
  const history = realisedHistory(
    household.id,
    content,
    anchors,
    household.monthsOfHistory,
    household.historyAccountId,
    owner.uid,
  );
  await writeCollection(household.id, "transactions", [...content.transactions, ...history], audit);
  await writeCollection(household.id, "debts", content.debts, audit);
  await writeCollection(household.id, "reserves", content.reserves, audit);
  await writeCollection(household.id, "goals", content.goals, audit);
  await writeCollection(household.id, "budgets", content.budgets, audit);

  const counts = [
    ["contas", content.accounts.length],
    ["cartões", content.creditCards.length],
    ["compras", content.cardPurchases.length],
    ["recorrências", content.recurringRules.length],
    ["obrigações", content.obligations.length],
    ["meses de histórico", household.monthsOfHistory],
    ["dívidas", content.debts.length],
    ["reservas", content.reserves.length],
  ] as const;

  console.info(`[seed] ${household.name} (${household.id})`);
  console.info(`       ${household.summary}`);
  console.info(`       ${counts.map(([label, count]) => `${count} ${label}`).join(", ")}\n`);
}

async function writeCollection(
  householdId: string,
  collectionName: string,
  documents: readonly Record<string, unknown>[],
  audit: Record<string, unknown>,
) {
  if (documents.length === 0) return;

  // Firestore caps a batch at 500 writes. The generated history grows with the
  // number of rules and months, so this chunks rather than assuming it fits.
  const CHUNK = 400;

  for (let start = 0; start < documents.length; start += CHUNK) {
    const batch = db.batch();

    for (const document of documents.slice(start, start + CHUNK)) {
      const { id, ...data } = document as { id?: string } & Record<string, unknown>;
      const ref = id
        ? db.doc(`households/${householdId}/${collectionName}/${id}`)
        : db.collection(`households/${householdId}/${collectionName}`).doc();
      batch.set(ref, { ...audit, ...data });
    }

    await batch.commit();
  }
}

function printSummary() {
  console.info("─".repeat(72));
  console.info("Usuários de teste (senha: conta1234)\n");
  for (const household of SEED_HOUSEHOLDS) {
    console.info(`  ${household.name}`);
    for (const user of household.users) {
      console.info(`    ${user.email.padEnd(28)} ${user.role}`);
    }
    console.info("");
  }
  console.info("Aplicação:      http://127.0.0.1:5002");
  console.info("Emulator UI:    http://127.0.0.1:4000");
  console.info("─".repeat(72));
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("[seed] Falhou:", error);
    process.exit(1);
  });
