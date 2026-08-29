/**
 * Identifier generation is a port, not a global.
 *
 * The domain creates entities (an installment plan produces N obligations) and
 * needs ids while staying free of Firestore. Injecting the generator also lets
 * tests assert on stable, readable ids.
 */

export type IdGenerator = () => string;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Firestore-style 20 character id.
 *
 * Uses the platform CSPRNG when available so ids are unguessable; document ids
 * are visible in Security Rules requests and in URLs.
 */
export const randomId: IdGenerator = () => {
  const bytes = new Uint8Array(20);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let id = "";
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length];
  }
  return id;
};

/** Deterministic generator for tests: `test-1`, `test-2`, ... */
export function sequentialIdGenerator(prefix = "id"): IdGenerator {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

/**
 * Stable id derived from its parts.
 *
 * Used where a document must be idempotent: a card statement is uniquely
 * `${cardId}_${monthKey}`, so re-running a projection can never create a
 * duplicate statement.
 */
export function deterministicId(...parts: readonly string[]): string {
  return parts
    .map((part) => part.replace(/[^A-Za-z0-9_-]/g, "-"))
    .join("_")
    .slice(0, 250);
}
