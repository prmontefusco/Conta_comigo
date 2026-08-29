import type { HouseholdId, UserId } from "@/modules/shared/domain/common";

/**
 * Every Firestore path in one place.
 *
 * The shape is deliberate: with the sole exception of the user profile, every
 * financial document lives under `households/{householdId}/...`. That single
 * fact is what makes the Security Rules short enough to reason about, and what
 * guarantees a query can never accidentally span two households
 * (docs/FIRESTORE_MODEL.md).
 */

export const paths = {
  users: () => "users",
  user: (uid: UserId) => `users/${uid}`,

  // There is deliberately no mirror of memberships under the user. "My
  // households" is answered by querying `households` on `memberUids`, which
  // keeps a single source of truth for who belongs where
  // (docs/FIRESTORE_MODEL.md).
  households: () => "households",
  household: (id: HouseholdId) => `households/${id}`,

  members: (householdId: HouseholdId) => `households/${householdId}/members`,
  member: (householdId: HouseholdId, uid: UserId) => `households/${householdId}/members/${uid}`,

  invites: (householdId: HouseholdId) => `households/${householdId}/invites`,
  categories: (householdId: HouseholdId) => `households/${householdId}/categories`,
  accounts: (householdId: HouseholdId) => `households/${householdId}/accounts`,
  transactions: (householdId: HouseholdId) => `households/${householdId}/transactions`,
  obligations: (householdId: HouseholdId) => `households/${householdId}/obligations`,
  creditCards: (householdId: HouseholdId) => `households/${householdId}/creditCards`,
  cardPurchases: (householdId: HouseholdId) => `households/${householdId}/cardPurchases`,
  debts: (householdId: HouseholdId) => `households/${householdId}/debts`,
  recurringRules: (householdId: HouseholdId) => `households/${householdId}/recurringRules`,
  budgets: (householdId: HouseholdId) => `households/${householdId}/budgets`,
  reserves: (householdId: HouseholdId) => `households/${householdId}/reserves`,
  goals: (householdId: HouseholdId) => `households/${householdId}/goals`,
  vehicles: (householdId: HouseholdId) => `households/${householdId}/vehicles`,
} as const;

/** Sub-collection names, for rules and for tests that iterate over all of them. */
export const HOUSEHOLD_SUBCOLLECTIONS = [
  "categories",
  "accounts",
  "transactions",
  "obligations",
  "creditCards",
  "cardPurchases",
  "debts",
  "recurringRules",
  "budgets",
  "reserves",
  "goals",
  "vehicles",
] as const;

export type HouseholdSubcollection = (typeof HOUSEHOLD_SUBCOLLECTIONS)[number];
