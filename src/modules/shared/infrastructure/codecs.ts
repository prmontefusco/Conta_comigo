import { z } from "zod";
import { isCalendarDate, isMonthKey } from "@/core/date/calendar-date";

/**
 * Validation at the Firestore boundary.
 *
 * Nothing enters the domain without passing through here. Security Rules stop
 * another household from reading the data; these schemas stop a malformed or
 * hand-edited document from becoming a wrong number on someone's dashboard.
 */

export const currencySchema = z.literal("BRL");

/**
 * Money on the wire.
 *
 * Stored as `{ amount, currency }` with an integer amount, matching the domain
 * exactly so there is no lossy conversion step (docs/FIRESTORE_MODEL.md).
 */
export const moneySchema = z.object({
  amount: z.number().int("Valores monetários são guardados em centavos inteiros.").safe(),
  currency: currencySchema,
});

export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, "Data inválida. Use o formato AAAA-MM-DD.")
  .transform((value) => value as import("@/core/date/calendar-date").CalendarDate);

export const monthKeySchema = z
  .string()
  .refine(isMonthKey, "Mês inválido. Use o formato AAAA-MM.")
  .transform((value) => value as import("@/core/date/calendar-date").MonthKey);

export const instantSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => value as import("@/core/date/calendar-date").Instant);

export const visibilitySchema = z.enum(["PERSONAL", "HOUSEHOLD"]);
export const expenseNatureSchema = z.enum(["FIXED", "VARIABLE", "OCCASIONAL"]);
export const confidenceSchema = z.enum(["CONFIRMED", "ESTIMATED"]);
export const flowDirectionSchema = z.enum(["INFLOW", "OUTFLOW"]);
export const householdRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

/** Ids are opaque strings; length is bounded so they cannot bloat a document. */
export const idSchema = z.string().min(1).max(250);

/** Free text a person typed. Trimmed and bounded, never empty. */
export const labelSchema = z.string().trim().min(1, "Informe um nome.").max(120);
export const descriptionSchema = z.string().trim().min(1, "Informe uma descrição.").max(200);
export const notesSchema = z.string().trim().max(2000).optional();

export const auditSchema = z.object({
  createdAt: instantSchema,
  updatedAt: instantSchema,
  createdBy: idSchema,
});

/**
 * Firestore rejects `undefined`. Optional domain fields are dropped rather
 * than written as null, which keeps documents small and queries predictable.
 */
export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    result[key] = entry;
  }
  return result as T;
}

/** Parses a document, attaching the document id and surfacing readable errors. */
export function parseDocument<Schema extends z.ZodType>(
  schema: Schema,
  id: string,
  data: unknown,
  collectionName: string,
): z.infer<Schema> {
  const result = schema.safeParse({ ...(data as Record<string, unknown>), id });
  if (!result.success) {
    throw new FirestoreDocumentError(collectionName, id, result.error);
  }
  return result.data;
}

export class FirestoreDocumentError extends Error {
  readonly collectionName: string;
  readonly documentId: string;
  readonly issues: z.ZodIssue[];

  constructor(collectionName: string, documentId: string, error: z.ZodError) {
    // The message deliberately carries field names and no financial values,
    // so it is safe to log (docs/SECURITY.md, "observability").
    const fields = error.issues.map((issue) => issue.path.join(".")).join(", ");
    super(`Documento inválido em ${collectionName}/${documentId}. Campos: ${fields || "(raiz)"}`);
    this.name = "FirestoreDocumentError";
    this.collectionName = collectionName;
    this.documentId = documentId;
    this.issues = error.issues;
  }
}
