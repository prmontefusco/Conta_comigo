import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import {
  as,
  brl,
  createTestEnvironment,
  HOUSEHOLD_A,
  HOUSEHOLD_B,
  MEMBER_A,
  NOW,
  obligationPayload,
  OWNER_A,
  seedHouseholds,
  transactionPayload,
  VIEWER_A,
} from "./helpers";

/**
 * As regras da coleção de obrigações.
 *
 * `firestore.rules` abre dizendo que nenhuma funcionalidade está pronta antes
 * de a regra dela ter teste. A coleção `obligations` era citada uma única vez
 * na suíte — numa leitura negativa — e nunca teve teste de escrita, apesar de
 * ser onde vive todo compromisso futuro da casa.
 *
 * Dois casos aqui não são sobre permissão, e sim sobre **como o Firestore
 * avalia um lote**. Estão neste arquivo porque foram escritos como dedução,
 * medidos contra o emulador e um deles saiu ao contrário do esperado — que é
 * exatamente o tipo de premissa que não se deve carregar para dentro do código:
 *
 * - `set` seguido de `update` no mesmo documento novo, no mesmo lote, é
 *   **permitido**: as regras enxergam o documento criado no próprio lote. A
 *   materialização usa um `set` único por decisão de domínio, não por
 *   imposição das regras;
 * - `set` sobre um documento que já existe é `update` para as regras, e o
 *   `createdAt` novo bate em `immutableAudit()`. É isso que torna a confirmação
 *   de um recebimento idempotente sem precisar de transação.
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

const obligations = (householdId: string) => `households/${householdId}/obligations`;

describe("criar uma obrigação", () => {
  it("um membro cria uma obrigação a receber", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertSucceeds(
      db.doc(`${obligations(HOUSEHOLD_A)}/nova`).set(obligationPayload(MEMBER_A, HOUSEHOLD_A)),
    );
  });

  it("um observador não cria", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, VIEWER_A).firestore();

    await assertFails(
      db.doc(`${obligations(HOUSEHOLD_A)}/nova`).set(obligationPayload(VIEWER_A, HOUSEHOLD_A)),
    );
  });

  it("recusa direção que não existe", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .doc(`${obligations(HOUSEHOLD_A)}/nova`)
        .set(obligationPayload(MEMBER_A, HOUSEHOLD_A, { direction: "SIDEWAYS" })),
    );
  });

  it("recusa valor negativo", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .doc(`${obligations(HOUSEHOLD_A)}/nova`)
        .set(obligationPayload(MEMBER_A, HOUSEHOLD_A, { amount: brl(-1) })),
    );
  });

  it("recusa dinheiro que não é inteiro em centavos", async () => {
    // Meio centavo não existe. Aceitar float aqui é como o dinheiro começa a
    // não fechar (docs/DOMAIN.md).
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .doc(`${obligations(HOUSEHOLD_A)}/nova`)
        .set(
          obligationPayload(MEMBER_A, HOUSEHOLD_A, { amount: { amount: 10.5, currency: "BRL" } }),
        ),
    );
  });

  it("recusa uma obrigação que se declara de outro household", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .doc(`${obligations(HOUSEHOLD_A)}/nova`)
        .set(obligationPayload(MEMBER_A, HOUSEHOLD_B, { householdId: HOUSEHOLD_B })),
    );
  });

  it("recusa criar em household de que não se é membro", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db.doc(`${obligations(HOUSEHOLD_B)}/nova`).set(obligationPayload(MEMBER_A, HOUSEHOLD_B)),
    );
  });

  it("recusa autoria falsificada", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .doc(`${obligations(HOUSEHOLD_A)}/nova`)
        .set(obligationPayload(OWNER_A, HOUSEHOLD_A, { createdBy: OWNER_A })),
    );
  });
});

describe("confirmar um recebimento", () => {
  it("grava obrigação e transação no mesmo lote", async () => {
    // É o formato da materialização: dois `set` de documentos novos, atômicos.
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    const batch = db.batch();
    batch.set(
      db.doc(`${obligations(HOUSEHOLD_A)}/rule-1:2026-09-05`),
      obligationPayload(MEMBER_A, HOUSEHOLD_A, {
        origin: "RECURRING_RULE",
        source: { recurringRuleId: "rule-1", occurrenceKey: "rule-1:2026-09-05" },
        amount: brl(185000),
        status: "SETTLED",
        settledAmount: brl(185000),
        settlementTransactionIds: ["tx-1"],
        settledAt: NOW,
      }),
    );
    batch.set(
      db.doc(`households/${HOUSEHOLD_A}/transactions/tx-1`),
      transactionPayload(MEMBER_A, HOUSEHOLD_A, {
        kind: "INCOME",
        amount: brl(185000),
        settlesObligationId: "rule-1:2026-09-05",
      }),
    );

    await assertSucceeds(batch.commit());
  });

  it("criar e liquidar o mesmo documento no mesmo lote é permitido", async () => {
    // Verificado contra o emulador, e não por dedução: as regras enxergam o
    // documento criado no próprio lote, então o `update` seguinte encontra
    // `resource` e passa em `immutableAudit()`.
    //
    // Ou seja, as regras não obrigam a materialização a ser um `set` único.
    // A aplicação escolhe o `set` único mesmo assim, porque criar a obrigação
    // com o valor previsto para logo em seguida liquidá-la com o valor real
    // deixaria o resto — R$ 150 de um salário que veio menor — visível por um
    // instante e, se o lote falhasse, para sempre.
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    const ref = db.doc(`${obligations(HOUSEHOLD_A)}/rule-1:2026-09-05`);
    const batch = db.batch();
    batch.set(ref, obligationPayload(MEMBER_A, HOUSEHOLD_A));
    batch.update(ref, { status: "SETTLED", settledAmount: brl(185000), updatedAt: NOW });

    await assertSucceeds(batch.commit());
  });

  it("confirmar duas vezes a mesma ocorrência é negado", async () => {
    // Id determinístico derivado da chave da ocorrência: a segunda escrita cai
    // sobre um documento existente, e o `createdAt` novo — `withAudit` usa o
    // instante da chamada — bate em `immutableAudit()`. A idempotência vem das
    // regras, não de uma trava na tela.
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();
    const ref = db.doc(`${obligations(HOUSEHOLD_A)}/rule-1:2026-09-05`);

    await assertSucceeds(ref.set(obligationPayload(MEMBER_A, HOUSEHOLD_A)));
    await assertFails(
      ref.set(
        obligationPayload(MEMBER_A, HOUSEHOLD_A, {
          createdAt: "2026-09-05T09:00:00.000Z",
          updatedAt: "2026-09-05T09:00:00.000Z",
        }),
      ),
    );
  });

  it("a liquidação de uma obrigação existente é permitida", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertSucceeds(
      db.doc(`${obligations(HOUSEHOLD_A)}/obligation-a`).update({
        settledAmount: brl(30000),
        status: "SETTLED",
        settlementTransactionIds: ["tx-nova"],
        settledAt: NOW,
        updatedAt: NOW,
      }),
    );
  });

  it("recusa reescrever a autoria ao liquidar", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db.doc(`${obligations(HOUSEHOLD_A)}/obligation-a`).update({
        settledAmount: brl(30000),
        status: "SETTLED",
        createdBy: MEMBER_A,
        updatedAt: NOW,
      }),
    );
  });

  it("recusa liquidar uma obrigação de outro household", async () => {
    await seedHouseholds(testEnv);
    const db = as(testEnv, MEMBER_A).firestore();

    await assertFails(
      db
        .doc(`${obligations(HOUSEHOLD_B)}/obligation-b`)
        .update({ status: "SETTLED", updatedAt: NOW }),
    );
  });
});
