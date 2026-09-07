import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ADMIN_A,
  anonymous,
  asEmail,
  as,
  auditFor,
  brl,
  createTestEnvironment,
  HOUSEHOLD_A,
  HOUSEHOLD_B,
  MEMBER_A,
  NOW,
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

  it("the owner can remove itself, which is what account deletion needs", async () => {
    // Without this, someone alone in their own household could never exercise
    // the LGPD right to erasure (docs/SECURITY.md).
    await seed();
    const db = as(testEnv, OWNER_A).firestore();
    await assertSucceeds(db.doc(`households/${HOUSEHOLD_A}/members/${OWNER_A}`).delete());
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

describe("assinaturas", () => {
  it("a pessoa lê a própria assinatura", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`subscriptions/${OWNER_A}`).set({
        userId: OWNER_A,
        plan: "PREMIUM",
        status: "ACTIVE",
        updatedAt: NOW,
      });
    });

    await assertSucceeds(as(testEnv, OWNER_A).firestore().doc(`subscriptions/${OWNER_A}`).get());
  });

  it("ninguém lê a assinatura de outra pessoa", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`subscriptions/${OWNER_A}`).set({
        userId: OWNER_A,
        plan: "PREMIUM",
        status: "ACTIVE",
        updatedAt: NOW,
      });
    });

    await assertFails(as(testEnv, MEMBER_A).firestore().doc(`subscriptions/${OWNER_A}`).get());
    await assertFails(anonymous(testEnv).firestore().doc(`subscriptions/${OWNER_A}`).get());
  });

  it("ninguém se concede um plano", async () => {
    // O caminho inteiro do dinheiro depende disto: quem paga não declara que
    // pagou. Só o Admin SDK grava aqui, e ele ignora estas regras.
    const db = as(testEnv, OWNER_A).firestore();

    await assertFails(
      db.doc(`subscriptions/${OWNER_A}`).set({
        userId: OWNER_A,
        plan: "PREMIUM",
        status: "ACTIVE",
        expiresAt: "2099-01-01T00:00:00.000Z",
        updatedAt: NOW,
      }),
    );
  });

  it("nem mesmo atualiza a própria assinatura existente", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`subscriptions/${OWNER_A}`).set({
        userId: OWNER_A,
        plan: "FREE",
        status: "NONE",
        updatedAt: NOW,
      });
    });

    const db = as(testEnv, OWNER_A).firestore();
    await assertFails(db.doc(`subscriptions/${OWNER_A}`).update({ plan: "PREMIUM" }));
    await assertFails(db.doc(`subscriptions/${OWNER_A}`).delete());
  });

  it("ninguém lista assinaturas", async () => {
    await assertFails(as(testEnv, OWNER_A).firestore().collection("subscriptions").get());
  });
});

/**
 * Histórico de decisões.
 *
 * É dado da família como qualquer outro: entra pela mesma porta e responde às
 * mesmas regras. O que estes testes guardam de específico é que uma casa não
 * lê a linha do tempo da outra, que quem só assiste não escreve nela, e que o
 * valor continua opcional — "adiar a troca da geladeira" não tem número, e
 * exigir um transformaria metade das decisões em registros impossíveis.
 */
describe("decisions", () => {
  const decisionPayload = (uid: string, overrides: Record<string, unknown> = {}) => ({
    householdId: HOUSEHOLD_A,
    kind: "RENEGOTIATE_DEBT",
    description: "Ligar para a financeira e propor 12 parcelas",
    decidedOn: "2026-08-28",
    status: "PLANNED",
    visibility: "HOUSEHOLD",
    ...auditFor(uid),
    ...overrides,
  });

  async function seedDecision() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc(`households/${HOUSEHOLD_A}/decisions/decision-a`)
        .set(decisionPayload(OWNER_A));
    });
  }

  it("a MEMBER registra e edita uma decisão", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertSucceeds(
      db.collection(`households/${HOUSEHOLD_A}/decisions`).add(decisionPayload(MEMBER_A)),
    );

    await seedDecision();
    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/decisions/decision-a`).update({
        status: "DONE",
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("aceita decisão com valor, e também sem", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertSucceeds(
      db
        .collection(`households/${HOUSEHOLD_A}/decisions`)
        .add(decisionPayload(MEMBER_A, { amount: brl(18000) })),
    );
    await assertSucceeds(
      db.collection(`households/${HOUSEHOLD_A}/decisions`).add(decisionPayload(MEMBER_A)),
    );
  });

  it("recusa um valor que não seja em centavos inteiros", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/decisions`)
        .add(decisionPayload(MEMBER_A, { amount: { amount: 180.5, currency: "BRL" } })),
    );
  });

  it("recusa uma situação fora das duas previstas", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/decisions`)
        .add(decisionPayload(MEMBER_A, { status: "EM_ANDAMENTO" })),
    );
  });

  it("um VIEWER lê a linha do tempo e não escreve nela", async () => {
    await seed();
    await seedDecision();
    const db = as(testEnv, VIEWER_A).firestore();

    await assertSucceeds(db.doc(`households/${HOUSEHOLD_A}/decisions/decision-a`).get());
    await assertFails(
      db.collection(`households/${HOUSEHOLD_A}/decisions`).add(decisionPayload(VIEWER_A)),
    );
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/decisions/decision-a`).update({ status: "DONE" }),
    );
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/decisions/decision-a`).delete());
  });

  it("uma casa não lê nem escreve a decisão da outra", async () => {
    await seed();
    await seedDecision();
    const db = as(testEnv, OWNER_B).firestore();

    await assertFails(db.doc(`households/${HOUSEHOLD_A}/decisions/decision-a`).get());
    await assertFails(db.collection(`households/${HOUSEHOLD_A}/decisions`).get());
    await assertFails(
      db.collection(`households/${HOUSEHOLD_A}/decisions`).add(decisionPayload(OWNER_B)),
    );
  });

  it("uma decisão não pode declarar outra casa", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .collection(`households/${HOUSEHOLD_A}/decisions`)
        .add(decisionPayload(MEMBER_A, { householdId: HOUSEHOLD_B })),
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

/**
 * Perfis sem acesso.
 *
 * Um dependente concede nada por **construção**, não por verificação: as
 * regras só reconhecem um membro quando o id do documento é o uid de quem
 * chama, e um id `dep_…` nunca pode ser um uid do Firebase Auth. Estes testes
 * guardam exatamente essa fronteira — inclusive a tentativa de usá-la para
 * enfiar o próprio grupo na lista de um estranho.
 */
describe("dependent profiles", () => {
  const dependentDoc = (name = "Lucas") => ({
    uid: "",
    householdId: HOUSEHOLD_A,
    displayName: name,
    role: "DEPENDENT",
    status: "ACTIVE",
    ...auditFor(ADMIN_A),
  });

  it("an admin can create a profile with no access, without touching memberUids", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    const id = "dep_lucas01";

    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/members/${id}`).set({
        ...dependentDoc(),
        uid: id,
      }),
    );
  });

  it("refuses a real uid dressed as a dependent, which is how a household would appear in a stranger's list", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${OUTSIDER}`).set({
        ...dependentDoc("Vítima"),
        uid: OUTSIDER,
      }),
    );
  });

  it("refuses an id that only looks prefixed", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();

    for (const id of ["dependente01", "DEP_lucas", "dep-lucas", "dep_"]) {
      await assertFails(
        db.doc(`households/${HOUSEHOLD_A}/members/${id}`).set({
          ...dependentDoc(),
          uid: id,
        }),
      );
    }
  });

  it("refuses a dep_ id carrying a role that grants access", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    const id = "dep_sneaky01";

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${id}`).set({
        ...dependentDoc(),
        uid: id,
        role: "ADMIN",
      }),
    );
  });

  it("a plain MEMBER cannot create a dependent", async () => {
    await seed();
    const db = as(testEnv, MEMBER_A).firestore();
    const id = "dep_lucas02";

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${id}`).set({
        ...dependentDoc(),
        uid: id,
      }),
    );
  });

  it("nobody outside the household can create one", async () => {
    await seed();
    const db = as(testEnv, OUTSIDER).firestore();
    const id = "dep_lucas03";

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${id}`).set({
        ...dependentDoc(),
        uid: id,
      }),
    );
  });

  it("a dependent cannot be promoted into a profile that has access", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    const id = "dep_lucas04";

    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/members/${id}`).set({
        ...dependentDoc(),
        uid: id,
      }),
    );

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${id}`).update({
        role: "MEMBER",
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("a real member cannot be demoted into a dependent", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${MEMBER_A}`).update({
        role: "DEPENDENT",
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("an admin can rename a dependent and remove it", async () => {
    await seed();
    const db = as(testEnv, ADMIN_A).firestore();
    const id = "dep_lucas05";

    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/members/${id}`).set({
        ...dependentDoc(),
        uid: id,
      }),
    );
    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/members/${id}`).update({
        displayName: "Lucas Souza",
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
    await assertSucceeds(db.doc(`households/${HOUSEHOLD_A}/members/${id}`).delete());
  });

  it("a dependent document grants no read access to the household", async () => {
    await seed();
    const admin = as(testEnv, ADMIN_A).firestore();
    const id = "dep_lucas06";

    await assertSucceeds(
      admin.doc(`households/${HOUSEHOLD_A}/members/${id}`).set({
        ...dependentDoc(),
        uid: id,
      }),
    );

    // O outsider continua fora, com ou sem dependentes no grupo.
    const outsider = as(testEnv, OUTSIDER).firestore();
    await assertFails(outsider.doc(`households/${HOUSEHOLD_A}`).get());
    await assertFails(outsider.doc(`households/${HOUSEHOLD_A}/members/${id}`).get());
  });
});

/**
 * A contagem do limitador é do servidor, e de mais ninguém.
 *
 * Legível, ela diria quantas chamadas ainda cabem antes do bloqueio.
 * Gravável, não seria um limite.
 */
describe("rateLimits", () => {
  it("ninguém lê nem escreve, nem mesmo autenticado", async () => {
    await seed();
    const db = as(testEnv, OWNER_A).firestore();

    await assertFails(db.doc("rateLimits/ai_uid-owner-a__1000").get());
    await assertFails(db.doc("rateLimits/ai_uid-owner-a__1000").set({ count: 0 }));
    await assertFails(db.collection("rateLimits").get());
  });

  it("nem o anônimo", async () => {
    await seed();
    const db = anonymous(testEnv).firestore();

    await assertFails(db.doc("rateLimits/qualquer").get());
    await assertFails(db.doc("rateLimits/qualquer").set({ count: 0 }));
  });
});

/**
 * Aceitar convite sem passar por servidor.
 *
 * O convidado precisa se acrescentar a `memberUids` — a lista que concede
 * acesso — e criar a própria participação. Duas escritas que, mal desenhadas,
 * seriam a permissão de entrar em qualquer grupo.
 *
 * O que as torna seguras é o id do convite **ser** o e-mail em minúsculas, e a
 * regra exigir `email_verified`. Sem a confirmação, bastaria criar uma conta
 * com o e-mail de outra pessoa. Estes testes existem sobretudo para as
 * tentativas que precisam falhar.
 */
describe("convite por e-mail", () => {
  const CONVIDADO = "uid-convidado";
  const EMAIL = "convidado@exemplo.test";

  async function criarConvite(overrides: Record<string, unknown> = {}) {
    const db = as(testEnv, ADMIN_A).firestore();
    await db.doc(`households/${HOUSEHOLD_A}/invites/${EMAIL}`).set({
      householdId: HOUSEHOLD_A,
      email: EMAIL,
      role: "MEMBER",
      status: "PENDING",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      ...auditFor(ADMIN_A),
      ...overrides,
    });
  }

  async function entrar(db: ReturnType<ReturnType<typeof as>["firestore"]>) {
    await db.doc(`households/${HOUSEHOLD_A}`).update({
      memberUids: [OWNER_A, ADMIN_A, MEMBER_A, VIEWER_A, CONVIDADO],
      updatedAt: "2026-08-29T10:00:00.000Z",
    });
  }

  it("o administrador cria o convite com o e-mail como id", async () => {
    await seed();
    await assertSucceeds(
      as(testEnv, ADMIN_A)
        .firestore()
        .doc(`households/${HOUSEHOLD_A}/invites/${EMAIL}`)
        .set({
          householdId: HOUSEHOLD_A,
          email: EMAIL,
          role: "MEMBER",
          status: "PENDING",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
          ...auditFor(ADMIN_A),
        }),
    );
  });

  it("recusa convite cujo id não é o e-mail: a regra não o encontraria", async () => {
    await seed();
    await assertFails(
      as(testEnv, ADMIN_A)
        .firestore()
        .doc(`households/${HOUSEHOLD_A}/invites/codigo-aleatorio`)
        .set({
          householdId: HOUSEHOLD_A,
          email: EMAIL,
          role: "MEMBER",
          status: "PENDING",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
          ...auditFor(ADMIN_A),
        }),
    );
  });

  it("um membro comum não convida ninguém", async () => {
    await seed();
    await assertFails(
      as(testEnv, MEMBER_A)
        .firestore()
        .doc(`households/${HOUSEHOLD_A}/invites/${EMAIL}`)
        .set({
          householdId: HOUSEHOLD_A,
          email: EMAIL,
          role: "MEMBER",
          status: "PENDING",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
          ...auditFor(MEMBER_A),
        }),
    );
  });

  it("o convidado entra: acrescenta o próprio uid e cria a participação", async () => {
    await seed();
    await criarConvite();

    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();

    await assertSucceeds(entrar(db));
    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/members/${CONVIDADO}`).set({
        uid: CONVIDADO,
        householdId: HOUSEHOLD_A,
        displayName: "Convidado",
        role: "MEMBER",
        status: "ACTIVE",
        ...auditFor(CONVIDADO),
      }),
    );
  });

  it("sem e-mail confirmado, não entra", async () => {
    // O ataque que isto fecha: criar uma conta com o e-mail de outra pessoa,
    // sem nunca provar que o acessa, e cair no grupo dela.
    await seed();
    await criarConvite();

    const db = asEmail(testEnv, CONVIDADO, EMAIL, false).firestore();
    await assertFails(entrar(db));
  });

  it("sem convite, não entra", async () => {
    await seed();
    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();
    await assertFails(entrar(db));
  });

  it("com convite expirado, não entra", async () => {
    await seed();
    await criarConvite({ expiresAt: new Date("2020-01-01T00:00:00.000Z") });

    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();
    await assertFails(entrar(db));
  });

  it("convite de outro e-mail não serve", async () => {
    await seed();
    await criarConvite();

    const db = asEmail(testEnv, OUTSIDER, "outro@exemplo.test").firestore();
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}`).update({
        memberUids: [OWNER_A, ADMIN_A, MEMBER_A, VIEWER_A, OUTSIDER],
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("o convidado só pode se acrescentar, não reescrever a lista", async () => {
    await seed();
    await criarConvite();
    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();

    // Remover os outros de tabela: a igualdade exata da regra recusa.
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}`).update({
        memberUids: [CONVIDADO],
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
    // Levar um cúmplice junto também não.
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}`).update({
        memberUids: [OWNER_A, ADMIN_A, MEMBER_A, VIEWER_A, CONVIDADO, OUTSIDER],
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("o convidado não muda o nome nem o dono do grupo de carona", async () => {
    await seed();
    await criarConvite();
    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();

    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}`).update({
        memberUids: [OWNER_A, ADMIN_A, MEMBER_A, VIEWER_A, CONVIDADO],
        name: "Grupo sequestrado",
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}`).update({
        memberUids: [OWNER_A, ADMIN_A, MEMBER_A, VIEWER_A, CONVIDADO],
        ownerUid: CONVIDADO,
        updatedAt: "2026-08-29T10:00:00.000Z",
      }),
    );
  });

  it("o convidado não escolhe o próprio papel", async () => {
    await seed();
    await criarConvite();
    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();
    await entrar(db);

    // O convite diz MEMBER; entrar como ADMIN é recusado.
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/members/${CONVIDADO}`).set({
        uid: CONVIDADO,
        householdId: HOUSEHOLD_A,
        displayName: "Convidado",
        role: "ADMIN",
        status: "ACTIVE",
        ...auditFor(CONVIDADO),
      }),
    );
  });

  it("o convidado marca o próprio convite como aceito, e só isso", async () => {
    await seed();
    await criarConvite();
    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();

    await assertSucceeds(
      db.doc(`households/${HOUSEHOLD_A}/invites/${EMAIL}`).update({ status: "ACCEPTED" }),
    );
    // Elevar o papel do próprio convite, não.
    await assertFails(
      db.doc(`households/${HOUSEHOLD_A}/invites/${EMAIL}`).update({ role: "ADMIN" }),
    );
  });

  it("o convite aceito não serve para entrar de novo", async () => {
    await seed();
    await criarConvite();

    // Aceito pelo caminho real: a regra de criação exige PENDING, então um
    // convite já aceito só existe depois de alguém aceitá-lo.
    await as(testEnv, ADMIN_A)
      .firestore()
      .doc(`households/${HOUSEHOLD_A}/invites/${EMAIL}`)
      .update({ status: "ACCEPTED" });

    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();
    await assertFails(entrar(db));
  });

  it("o convidado lê o household antes de entrar, porque precisa da lista", async () => {
    // Sem isto o convite era impossível de aceitar: montar `memberUids` com o
    // próprio uid no fim exige conhecer a lista, e conhecê-la exigia já ser
    // membro.
    await seed();
    await criarConvite();

    const comConvite = asEmail(testEnv, CONVIDADO, EMAIL).firestore();
    await assertSucceeds(comConvite.doc(`households/${HOUSEHOLD_A}`).get());

    const semConvite = asEmail(testEnv, OUTSIDER, "outro@exemplo.test").firestore();
    await assertFails(semConvite.doc(`households/${HOUSEHOLD_A}`).get());
  });

  it("o convidado lê o próprio convite antes de ser membro, e não o dos outros", async () => {
    await seed();
    await criarConvite();
    const db = asEmail(testEnv, CONVIDADO, EMAIL).firestore();

    await assertSucceeds(db.doc(`households/${HOUSEHOLD_A}/invites/${EMAIL}`).get());
    await assertFails(db.doc(`households/${HOUSEHOLD_A}/invites/outro@exemplo.test`).get());
  });
});
