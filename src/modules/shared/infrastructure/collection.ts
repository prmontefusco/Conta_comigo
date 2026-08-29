import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  type Firestore,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import type { z } from "zod";
import { instant } from "@/core/date/calendar-date";
import type { HouseholdId, UserId } from "@/modules/shared/domain/common";
import { parseDocument, stripUndefined } from "./codecs";

/**
 * A typed, household-scoped Firestore collection.
 *
 * Every module gets one of these instead of writing its own CRUD. The point is
 * not to save keystrokes: it is that the household path, the schema validation
 * and the audit fields are applied in exactly one place, so no module can
 * accidentally skip them.
 */

export interface CollectionContext {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
}

export interface HouseholdCollection<T extends { id: string }> {
  list(...constraints: QueryConstraint[]): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(data: Omit<T, "id" | "createdAt" | "updatedAt" | "createdBy">): Promise<T>;
  /** Creates with a caller-chosen id. Used where the id must be deterministic. */
  createWithId(
    id: string,
    data: Omit<T, "id" | "createdAt" | "updatedAt" | "createdBy">,
  ): Promise<T>;
  update(id: string, patch: Partial<Omit<T, "id" | "householdId">>): Promise<void>;
  remove(id: string): Promise<void>;
  watch(onChange: (items: T[]) => void, onError?: (error: Error) => void): Unsubscribe;
}

export function householdCollection<Schema extends z.ZodType<{ id: string }>>(
  context: CollectionContext,
  collectionName: string,
  schema: Schema,
): HouseholdCollection<z.infer<Schema>> {
  type T = z.infer<Schema>;
  const path = `households/${context.householdId}/${collectionName}`;
  const ref = () => collection(context.db, path);

  const parseAll = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }): T[] =>
    snapshot.docs.map((document) => parseDocument(schema, document.id, document.data(), path));

  return {
    async list(...constraints: QueryConstraint[]): Promise<T[]> {
      const snapshot = await getDocs(constraints.length ? query(ref(), ...constraints) : ref());
      return parseAll(snapshot);
    },

    async get(id: string): Promise<T | null> {
      const snapshot = await getDoc(doc(context.db, path, id));
      if (!snapshot.exists()) return null;
      return parseDocument(schema, snapshot.id, snapshot.data(), path);
    },

    async create(data): Promise<T> {
      const payload = withAudit(data, context.uid);
      const created = await addDoc(ref(), payload);
      return parseDocument(schema, created.id, payload, path);
    },

    async createWithId(id, data): Promise<T> {
      const payload = withAudit(data, context.uid);
      await setDoc(doc(context.db, path, id), payload);
      return parseDocument(schema, id, payload, path);
    },

    async update(id, patch): Promise<void> {
      // `householdId`, `createdAt` and `createdBy` are rejected by the rules on
      // update; stripping them here turns a permission error into a no-op.
      const { ...rest } = patch as Record<string, unknown>;
      delete rest.householdId;
      delete rest.createdAt;
      delete rest.createdBy;
      delete rest.id;

      await updateDoc(doc(context.db, path, id), {
        ...stripUndefined(rest),
        updatedAt: instant(),
      });
    },

    async remove(id): Promise<void> {
      await deleteDoc(doc(context.db, path, id));
    },

    watch(onChange, onError): Unsubscribe {
      return onSnapshot(
        ref(),
        (snapshot) => onChange(parseAll(snapshot)),
        (error) => onError?.(error),
      );
    },
  };
}

function withAudit(data: Record<string, unknown>, uid: UserId): Record<string, unknown> {
  const now = instant();
  return stripUndefined({
    ...data,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  });
}
