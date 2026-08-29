import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ADMIN_A,
  anonymous,
  as,
  auditFor,
  brl,
  createTestEnvironment,
  HOUSEHOLD_A,
  HOUSEHOLD_B,
  MEMBER_A,
  OUTSIDER,
  OWNER_A,
  OWNER_B,
  seedHouseholds,
  transactionPayload,
  VIEWER_A,
} from "./helpers";

/**
 * The security cases the product brief requires (section 24).
 *
 * Financial data is as sensitive as it gets. These tests are the contract:
 * if one of them fails, the rules ship broken, no matter what the UI does.
 */

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await createTestEnvironment();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seed() {
  await seedHouseholds(testEnv);
}

describe("unauthenticated access", () => {
  it("cannot read a household", async () => {
    await seed();
    const db = anonymous(testEnv).firestore();
    await assertFails(db.doc(`households/${HOUSEHOLD_A}`).get());
  });

  it("cannot read any financial document", async () => {
    await seed();
    const db = anonymous(testEnv).firestore();
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/accounts/account-a`).get());
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).get());
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/obligations/obligation-a`).get());
  });

  it("cannot list a collection", async () => {
    await seed();
    const db = anonymous(testEnv).firestore();
    await assertFails(db.collection(`households/${HOUSEHOLD_A}/transactions`).get());
  });

  it("cannot write anything", async () => {
    await seed();
    const db = anonymous(testEnv).firestore();
    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/transactions`)
        .add(transactionPayload(OUTSIDER, HOUSEHOLD_A)),
    );
  });

  it("cannot create a household", async () => {
    const db = anonymous(testEnv).firestore();
    await assertFails(
      db.doc("households/new-one").set({
        name: "Tentativa",
        ownerUid: OUTSIDER,
        memberUids: [OUTSIDER],
        ...auditFor(OUTSIDER),
      }),
    );
  });
});

describe("authenticated user without a membership", () => {
  it("cannot read a household it does not belong to", async () => {
    await seed();
    const db = as(testEnv, OUTSIDER).firestore();
    await assertFails(db.doc(`households/${HOUSEHOLD_A}`).get());
  });

  it("cannot read its financial documents even knowing the ids", async () => {
    await seed();
    const db = as(testEnv, OUTSIDER).firestore();
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/accounts/account-a`).get());
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).get());
  });

  it("cannot write into it", async () => {
    await seed();
    const db = as(testEnv, OUTSIDER).firestore();
    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/transactions`)
        .add(transactionPayload(OUTSIDER, HOUSEHOLD_A)),
    );
  });

  it("cannot insert itself as a member", async () => {
    await seed();
    const db = as(testEnv, OUTSIDER).firestore();
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${OUTSIDER}`).set({
        uid: OUTSIDER,
        householdId: HOUSEHOLD_A,
        displayName: "Intruso",
        role: "OWNER",
        status: "ACTIVE",
        ...auditFor(OUTSIDER),
      }),
    );
  });

  it("cannot add itself to memberUids", async () => {
    await seed();
    const db = as(testEnv, OUTSIDER).firestore();
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}`).update({
        memberUids: [OWNER_A, ADMIN_A, MEMBER_A, VIEWER_A, OUTSIDER],
      }),
    );
  });
});

describe("household isolation", () => {
  it("household A can never reach household B", async () => {
    await seed();
    const db = as(testEnv, OWNER_A).firestore();

    await assertFails(db.doc(`households/${HOUSEHOLD_B}`).get());
    await assertFails(db.collection(`households/${HOUSEHOLD_B}/transactions`).get());
    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_B}/transactions`)
        .add(transactionPayload(OWNER_A, HOUSEHOLD_B)),
    );
  });

  it("household B can never reach household A", async () => {
    await seed();
    const db = as(testEnv, OWNER_B).firestore();

    await assertFails(db.doc(`households/${HOUSEHOLD_A}`).get());
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/accounts/account-a`).get());
  });

  it("a member of A can read A", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertSucceeds(db.doc(`households/${HOUSEHOLD_A}`).get());
    await assertSucceeds(db.doc(`households/${HOUSEHOLD_A}/accounts/account-a`).get());
    await assertSucceeds(db.collection(`households/${HOUSEHOLD_A}/transactions`).get());
  });

  it("listing households only returns the caller's own", async () => {
    await seed();
    const db = as(testEnv, OWNER_A).firestore();

    const mine = await assertSucceeds(
      db.collection("households").where("memberUids", "array-contains", OWNER_A).get(),
    );
    expect(mine.docs.map((doc) => doc.id)).toEqual([HOUSEHOLD_A]);

    // An unconstrained list must be refused rather than silently filtered.
    await assertFails(db.collection("households").get());
  });
});

describe("id manipulation", () => {
  it("refuses a document that claims to belong to another household", async () => {
    await seed();
    const db = as(testEnv, OWNER_A).firestore();

    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/transactions`)
        .add(transactionPayload(OWNER_A, HOUSEHOLD_B)),
    );
  });

  it("refuses to move an existing document to another household", async () => {
    await seed();
    const db = as(testEnv, OWNER_A).firestore();

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).update({
        householdId: HOUSEHOLD_B,
      }),
    );
  });

  it("refuses a document created in someone else's name", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/transactions`)
        .add(transactionPayload(OWNER_A, HOUSEHOLD_A)),
    );
  });

  it("refuses to rewrite creation metadata", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).update({ createdBy: ADMIN_A }),
    );
    await assertFails(
      db
        .doc(`households/${HOUSEHOLD_A}/transactions/tx-a`)
        .update({ createdAt: "2020-01-01T00:00:00.000Z" }),
    );
  });
});

describe("roles", () => {
  it("a VIEWER reads but cannot write", async () => {
    await seed();
    const db = as(testEnv, VIEWER_A).firestore();

    await assertSucceeds(db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).get());
    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/transactions`)
        .add(transactionPayload(VIEWER_A, HOUSEHOLD_A)),
    );
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).update({ description: "Editado" }),
    );
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).delete());
  });

  it("a MEMBER records movements", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertSucceeds(
      db
        .collection(`households/${HOUSEHOLD_A}/transactions`)
        .add(transactionPayload(MEMBER_A, HOUSEHOLD_A)),
    );
    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/transactions/tx-a`).update({
        description: "Supermercado do mês",
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("a MEMBER cannot change household settings", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();
    await assertFails(db.doc(`households/${HOUSEHOLD_A}`).update({ name: "Renomeada" }));
  });

  it("an ADMIN can change household settings", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}`).update({
        name: "Família A renomeada",
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("a MEMBER cannot delete an account, an ADMIN can", async () => {
    await seed();
    await assertFails(
      as(testEnv, MEMBER_A)
        .firestore()
        .doc(`households/${HOUSEHOLD_A}/accounts/account-a`)
        .delete(),
    );
    await assertSucceeds(
      as(testEnv, ADMIN_A).firestore().doc(`households/${HOUSEHOLD_A}/accounts/account-a`).delete(),
    );
  });

  it("only the OWNER can delete the household", async () => {
    await seed();
    await assertFails(as(testEnv, ADMIN_A).firestore().doc(`households/${HOUSEHOLD_A}`).delete());
    await assertSucceeds(
      as(testEnv, OWNER_A).firestore().doc(`households/${HOUSEHOLD_A}`).delete(),
    );
  });
});

describe("privilege escalation", () => {
  it("a MEMBER cannot promote itself", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${MEMBER_A}`).update({ role: "ADMIN" }),
    );
  });

  it("an ADMIN cannot promote itself to OWNER", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${ADMIN_A}`).update({ role: "OWNER" }),
    );
  });

  it("an ADMIN cannot demote the OWNER", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${OWNER_A}`).update({ role: "MEMBER" }),
    );
  });

  it("an ADMIN cannot remove the OWNER", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/members/${OWNER_A}`).delete());
  });

  it("an ADMIN can change another member's role", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/members/${MEMBER_A}`).update({
        role: "VIEWER",
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("a member can remove itself", async () => {
    await seed();
    const db = as(testEnv, VIEWER_A).firestore();
    await assertSucceeds(db.doc(`households/${HOUSEHOLD_A}/members/${VIEWER_A}`).delete());
  });

  it("an admin cannot add a member who is not in memberUids", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${OUTSIDER}`).set({
        uid: OUTSIDER,
        householdId: HOUSEHOLD_A,
        displayName: "Novo",
        role: "MEMBER",
        status: "ACTIVE",
        ...auditFor(ADMIN_A),
      }),
    );
  });

  it("an admin can add a member after listing them on the household", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();

    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}`).update({
        memberUids: [OWNER_A, ADMIN_A, MEMBER_A, VIEWER_A, OUTSIDER],
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/members/${OUTSIDER}`).set({
        uid: OUTSIDER,
        householdId: HOUSEHOLD_A,
        displayName: "Novo",
        role: "MEMBER",
        status: "ACTIVE",
        ...auditFor(ADMIN_A),
      }),
    );
  });

  it("a revoked membership loses access immediately", async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc(`households/${HOUSEHOLD_A}/members/${MEMBER_A}`)
        .update({ status: "REMOVED" });
    });

    const db = as(testEnv, MEMBER_A).firestore();
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/accounts/account-a`).get());
  });
});

describe("household bootstrap", () => {
  it("lets a signed-in user create their own household and claim ownership", async () => {
    const db = as(testEnv, OUTSIDER).firestore();

    await assertSucceeds(
      db.doc("households/brand-new").set({
        name: "Minhas finanças",
        ownerUid: OUTSIDER,
        memberUids: [OUTSIDER],
        settings: { timezone: "America/Sao_Paulo", currency: "BRL", locale: "pt-BR" },
        archived: false,
        ...auditFor(OUTSIDER),
      }),
    );

    await assertSucceeds(
      db.doc(`households/brand-new/members/${OUTSIDER}`).set({
        uid: OUTSIDER,
        householdId: "brand-new",
        displayName: "Eu",
        role: "OWNER",
        status: "ACTIVE",
        ...auditFor(OUTSIDER),
      }),
    );
  });

  it("refuses a household created in someone else's name", async () => {
    const db = as(testEnv, OUTSIDER).firestore();
    await assertFails(
      db.doc("households/not-mine").set({
        name: "Alheia",
        ownerUid: OWNER_A,
        memberUids: [OWNER_A],
        ...auditFor(OUTSIDER),
      }),
    );
  });

  it("refuses a household that starts with extra members", async () => {
    const db = as(testEnv, OUTSIDER).firestore();
    await assertFails(
      db.doc("households/too-many").set({
        name: "Grupo",
        ownerUid: OUTSIDER,
        memberUids: [OUTSIDER, OWNER_A],
        ...auditFor(OUTSIDER),
      }),
    );
  });
});

describe("user profiles", () => {
  it("a user reads and updates only their own profile", async () => {
    await seed();
    await assertSucceeds(as(testEnv, OWNER_A).firestore().doc(`users/${OWNER_A}`).get());
    await assertFails(as(testEnv, OUTSIDER).firestore().doc(`users/${OWNER_A}`).get());
    await assertFails(
      as(testEnv, OUTSIDER).firestore().doc(`users/${OWNER_A}`).update({ displayName: "Hackeado" }),
    );
  });

  it("nobody can list all users", async () => {
    await seed();
    await assertFails(as(testEnv, OWNER_A).firestore().collection("users").get());
  });

  it("a user cannot upgrade their own plan", async () => {
    await seed();
    await assertFails(
      as(testEnv, OWNER_A).firestore().doc(`users/${OWNER_A}`).update({ plan: "PREMIUM" }),
    );
  });
});

describe("data shape", () => {
  it("refuses a non-integer money amount", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db.collection(`households/${HOUSEHOLD_A}/transactions`).add(
        transactionPayload(MEMBER_A, HOUSEHOLD_A, {
          amount: { amount: 99.9, currency: "BRL" },
        }),
      ),
    );
  });

  it("refuses a negative transaction amount, since direction comes from kind", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/transactions`)
        .add(transactionPayload(MEMBER_A, HOUSEHOLD_A, { amount: brl(-5000) })),
    );
  });

  it("refuses an impossible card closing day", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db.collection(`households/${HOUSEHOLD_A}/creditCards`).add({
        householdId: HOUSEHOLD_A,
        name: "Cartão",
        creditLimit: brl(500000),
        closingDay: 45,
        dueDay: 5,
        visibility: "HOUSEHOLD",
        archived: false,
        ...auditFor(MEMBER_A),
      }),
    );
  });

  it("refuses an absurd number of installments", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db.collection(`households/${HOUSEHOLD_A}/cardPurchases`).add({
        householdId: HOUSEHOLD_A,
        creditCardId: "card-a",
        description: "Compra",
        totalAmount: brl(100000),
        purchaseDate: "2026-08-10",
        competenceDate: "2026-08-10",
        categoryId: "category-a",
        installmentCount: 5000,
        visibility: "HOUSEHOLD",
        ...auditFor(MEMBER_A),
      }),
    );
  });

  it("accepts a well-formed card", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertSucceeds(
      db.collection(`households/${HOUSEHOLD_A}/creditCards`).add({
        householdId: HOUSEHOLD_A,
        name: "Cartão",
        creditLimit: brl(500000),
        closingDay: 25,
        dueDay: 5,
        visibility: "HOUSEHOLD",
        archived: false,
        ...auditFor(MEMBER_A),
      }),
    );
  });
});

describe("undeclared collections", () => {
  it("denies anything not explicitly allowed", async () => {
    await seed();
    const db = as(testEnv, OWNER_A).firestore();

    await assertFails(db.doc(`households/${HOUSEHOLD_A}/secrets/whatever`).set({ a: 1 }));
    await assertFails(db.doc("randomCollection/doc").set({ a: 1 }));
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/secrets/whatever`).get());
  });
});
