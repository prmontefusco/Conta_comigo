import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import {
  as,
  auditFor,
  brl,
  createTestEnvironment,
  HOUSEHOLD_A,
  MEMBER_A,
  OWNER_A,
  seedHouseholds,
  VIEWER_A,
} from "./helpers";

let testEnv: RulesTestEnvironment;
beforeAll(async () => {
  testEnv = await createTestEnvironment();
});
afterAll(async () => {
  await testEnv.cleanup();
});
afterEach(async () => {
  await testEnv.clearFirestore();
});

function invoicePayload(uid: string) {
  return {
    householdId: HOUSEHOLD_A,
    creditCardId: "card-a",
    referenceMonth: "2026-09",
    dueDate: "2026-09-18",
    totalAmount: brl(42265),
    paymentRevision: 0,
    forecastLines: [],
    installmentOffers: [],
    ...auditFor(uid),
  };
}

describe("imported invoice financing permissions", () => {
  it("requires the invoice and linked debt to be written together", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();
    const invoiceRef = db.doc(`households/${HOUSEHOLD_A}/cardInvoices/invoice-a`);
    const debtRef = db.doc(`households/${HOUSEHOLD_A}/debts/plan-a`);
    await assertSucceeds(invoiceRef.set(invoicePayload(MEMBER_A)));
    const debt = {
      householdId: HOUSEHOLD_A,
      kind: "CARD_RENEGOTIATION",
      description: "Acordo",
      principalContracted: brl(34265),
      amountDisbursed: brl(0),
      disbursementDate: "2026-09-15",
      amortisationSystem: "SIMPLE",
      installmentCount: 3,
      installmentAmount: brl(16400),
      firstDueDate: "2026-10-15",
      status: "ACTIVE",
      visibility: "HOUSEHOLD",
      sourceCardStatementId: "card-a_2026-09",
      sourceCardInvoiceId: "invoice-a",
      ...auditFor(MEMBER_A),
    };
    await assertFails(debtRef.set(debt));
    const batch = db.batch();
    batch.set(debtRef, debt);
    batch.update(invoiceRef, {
      financedDebtId: "plan-a",
      paymentRevision: 1,
      updatedAt: "2026-09-15T12:00:00.000Z",
    });
    await assertSucceeds(batch.commit());
  });
  it("a member can create an invoice, but a viewer cannot", async () => {
    await seedHouseholds(testEnv);
    const memberDb = as(testEnv, MEMBER_A).firestore();
    const viewerDb = as(testEnv, VIEWER_A).firestore();
    await assertSucceeds(
      memberDb
        .doc(`households/${HOUSEHOLD_A}/cardInvoices/invoice-a`)
        .set(invoicePayload(MEMBER_A)),
    );
    await assertFails(
      viewerDb
        .doc(`households/${HOUSEHOLD_A}/cardInvoices/invoice-b`)
        .set(invoicePayload(VIEWER_A)),
    );
  });

  it("a financed invoice cannot be deleted or unlinked", async () => {
    await seedHouseholds(testEnv);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc(`households/${HOUSEHOLD_A}/cardInvoices/invoice-a`)
        .set({ ...invoicePayload(OWNER_A), financedDebtId: "plan-a" });
    });
    const db = as(testEnv, OWNER_A).firestore();
    const ref = db.doc(`households/${HOUSEHOLD_A}/cardInvoices/invoice-a`);
    await assertFails(ref.delete());
    await assertFails(
      ref.update({ financedDebtId: "plan-b", updatedAt: "2026-09-15T12:00:00.000Z" }),
    );
  });

  it("a linked debt cannot be edited or deleted independently", async () => {
    await seedHouseholds(testEnv);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc(`households/${HOUSEHOLD_A}/debts/plan-a`)
        .set({
          householdId: HOUSEHOLD_A,
          kind: "CARD_RENEGOTIATION",
          description: "Acordo",
          principalContracted: brl(34265),
          amountDisbursed: brl(0),
          disbursementDate: "2026-09-15",
          amortisationSystem: "SIMPLE",
          installmentCount: 3,
          installmentAmount: brl(16400),
          firstDueDate: "2026-10-15",
          status: "ACTIVE",
          visibility: "HOUSEHOLD",
          sourceCardStatementId: "card-a_2026-09",
          ...auditFor(OWNER_A),
        });
    });
    const db = as(testEnv, OWNER_A).firestore();
    const ref = db.doc(`households/${HOUSEHOLD_A}/debts/plan-a`);
    await assertFails(ref.delete());
    await assertFails(
      ref.update({ installmentAmount: brl(20000), updatedAt: "2026-09-15T12:00:00.000Z" }),
    );
    await assertSucceeds(ref.update({ status: "SETTLED", updatedAt: "2026-09-15T12:00:00.000Z" }));
  });
});
