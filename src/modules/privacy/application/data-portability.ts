import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { instant } from "@/core/date/calendar-date";
import { err, ok, validationError, type Result } from "@/core/result/result";
import { HOUSEHOLD_SUBCOLLECTIONS } from "@/lib/firebase/paths";
import type { HouseholdId, UserId } from "@/modules/shared/domain/common";

/**
 * Data portability and account deletion.
 *
 * Both are rights under the LGPD, and both are implemented against the same
 * Security Rules everything else uses - there is no privileged path. What the
 * export contains is exactly what the person can already read; what deletion
 * removes is exactly what they are allowed to delete.
 *
 * See docs/SECURITY.md and /privacidade.
 */

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export interface ExportedHousehold {
  readonly household: Record<string, unknown>;
  readonly members: Record<string, unknown>[];
  readonly collections: Record<string, Record<string, unknown>[]>;
}

export interface ExportPayload {
  readonly format: "conta-comigo/export";
  readonly version: 1;
  readonly exportedAt: string;
  readonly profile: Record<string, unknown> | null;
  readonly households: ExportedHousehold[];
  readonly notes: readonly string[];
}

/**
 * Everything the person can read, as one JSON document.
 *
 * Money stays in the same shape the app stores it - integer centavos plus a
 * currency - rather than being formatted. An export is for reading back into
 * something, and a formatted "R$ 1.234,56" would have to be parsed again,
 * with all the ambiguity that brings.
 */
export async function exportUserData(
  db: Firestore,
  uid: UserId,
  householdIds: readonly HouseholdId[],
): Promise<ExportPayload> {
  const profileSnapshot = await getDoc(doc(db, "users", uid));

  const households: ExportedHousehold[] = [];

  for (const householdId of householdIds) {
    const householdSnapshot = await getDoc(doc(db, "households", householdId));
    if (!householdSnapshot.exists()) continue;

    const members = await getDocs(collection(db, `households/${householdId}/members`));

    const collections: Record<string, Record<string, unknown>[]> = {};
    for (const name of HOUSEHOLD_SUBCOLLECTIONS) {
      const snapshot = await getDocs(collection(db, `households/${householdId}/${name}`));
      collections[name] = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
    }

    households.push({
      household: { id: householdSnapshot.id, ...householdSnapshot.data() },
      members: members.docs.map((document) => ({ id: document.id, ...document.data() })),
      collections,
    });
  }

  return {
    format: "conta-comigo/export",
    version: 1,
    exportedAt: instant(),
    profile: profileSnapshot.exists()
      ? { id: profileSnapshot.id, ...profileSnapshot.data() }
      : null,
    households,
    notes: [
      "Valores monetários estão em centavos inteiros, com a moeda ao lado.",
      "Datas de calendário (vencimento, competência) estão no formato AAAA-MM-DD.",
      "Faturas de cartão e parcelas não aparecem: são calculadas a partir das compras.",
      "Saldos de conta não aparecem: são calculados a partir do saldo inicial e das movimentações.",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Deletion                                                           */
/* ------------------------------------------------------------------ */

export type DeletionPlanEntry =
  | { readonly kind: "DELETE_HOUSEHOLD"; readonly householdId: HouseholdId; readonly name: string }
  | { readonly kind: "LEAVE_HOUSEHOLD"; readonly householdId: HouseholdId; readonly name: string }
  | {
      readonly kind: "BLOCKED_OWNER";
      readonly householdId: HouseholdId;
      readonly name: string;
      readonly otherMembers: number;
    };

export interface DeletionPlan {
  readonly entries: readonly DeletionPlanEntry[];
  readonly blocked: boolean;
}

/**
 * What deleting the account would do to each household, before doing it.
 *
 * Shown to the person first. Deleting an account is irreversible and can take
 * other people's data with it, so it should never be a surprise.
 *
 * A household the person owns *and shares* blocks deletion: removing it would
 * destroy data belonging to others, and silently handing ownership to someone
 * who did not ask for it is not better. Transferring ownership is a decision,
 * and decisions belong to people.
 */
export function planAccountDeletion(
  uid: UserId,
  households: ReadonlyArray<{
    id: HouseholdId;
    name: string;
    ownerUid: string;
    memberUids: readonly string[];
  }>,
): DeletionPlan {
  const entries = households.map((household): DeletionPlanEntry => {
    const isOwner = household.ownerUid === uid;
    const others = household.memberUids.filter((member) => member !== uid).length;

    if (isOwner && others === 0) {
      return { kind: "DELETE_HOUSEHOLD", householdId: household.id, name: household.name };
    }
    if (isOwner) {
      return {
        kind: "BLOCKED_OWNER",
        householdId: household.id,
        name: household.name,
        otherMembers: others,
      };
    }
    return { kind: "LEAVE_HOUSEHOLD", householdId: household.id, name: household.name };
  });

  return { entries, blocked: entries.some((entry) => entry.kind === "BLOCKED_OWNER") };
}

/**
 * Deletes a household and everything under it.
 *
 * There is no recursive delete on the client, so every document is removed
 * explicitly, in batches.
 *
 * The order matters and is not the obvious one. Deleting the household
 * document requires being its owner, which the rules establish by reading the
 * caller's *member* document - so the members subcollection has to outlive the
 * household document, not the other way round. Nothing else reads the
 * household document, so removing it before the members is safe.
 */
export async function deleteHouseholdData(db: Firestore, householdId: HouseholdId): Promise<void> {
  for (const name of HOUSEHOLD_SUBCOLLECTIONS) {
    await deleteAllIn(db, `households/${householdId}/${name}`);
  }
  await deleteAllIn(db, `households/${householdId}/invites`);

  await deleteDoc(doc(db, "households", householdId));

  await deleteAllIn(db, `households/${householdId}/members`);
}

async function deleteAllIn(db: Firestore, path: string): Promise<void> {
  const snapshot = await getDocs(collection(db, path));
  if (snapshot.empty) return;

  const CHUNK = 400;
  for (let start = 0; start < snapshot.docs.length; start += CHUNK) {
    const batch = writeBatch(db);
    for (const document of snapshot.docs.slice(start, start + CHUNK)) {
      batch.delete(document.ref);
    }
    await batch.commit();
  }
}

export interface DeleteAccountInput {
  readonly db: Firestore;
  readonly uid: UserId;
  readonly plan: DeletionPlan;
}

/**
 * Carries out a deletion plan against Firestore.
 *
 * The Firebase Auth user is deleted separately by the caller, because that
 * requires a recent sign-in and may need the person to authenticate again.
 * Firestore data goes first: an auth account with no data is a harmless
 * leftover, while data with no owner would be unreachable and undeletable.
 */
export async function deleteAccountData(
  input: DeleteAccountInput,
): Promise<Result<{ deletedHouseholds: number; leftHouseholds: number }>> {
  if (input.plan.blocked) {
    return err(
      validationError(
        "Há grupos em que você é o responsável e que têm outras pessoas. " +
          "Transfira a responsabilidade ou remova os outros membros antes de excluir a conta.",
      ),
    );
  }

  let deletedHouseholds = 0;
  let leftHouseholds = 0;

  for (const entry of input.plan.entries) {
    if (entry.kind === "DELETE_HOUSEHOLD") {
      await deleteHouseholdData(input.db, entry.householdId);
      deletedHouseholds += 1;
    } else if (entry.kind === "LEAVE_HOUSEHOLD") {
      await deleteDoc(doc(input.db, `households/${entry.householdId}/members/${input.uid}`));
      leftHouseholds += 1;
    }
  }

  await deleteDoc(doc(input.db, "users", input.uid));

  return ok({ deletedHouseholds, leftHouseholds });
}
