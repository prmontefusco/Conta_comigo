import { doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { instant } from "@/core/date/calendar-date";
import { randomId } from "@/core/id/id";
import { getDb } from "@/lib/firebase/client";
import { DEFAULT_CATEGORIES } from "@/modules/categories/domain/category";
import {
  DEFAULT_HOUSEHOLD_SETTINGS,
  type OnboardingStep,
} from "@/modules/household/domain/household";

/**
 * Account and household bootstrap.
 *
 * The household is created in two steps rather than one batch, on purpose. A
 * batched write is evaluated by the Security Rules against the state *before*
 * the batch, so a rule protecting the members collection cannot see the
 * household document being created alongside it. Writing the household first
 * lets the member rule verify ownership properly, and closes the hole where
 * anyone could insert themselves as OWNER of an existing household
 * (docs/SECURITY.md, "household bootstrap").
 *
 * If the second step fails, the result is a household with no members. Nobody
 * can read it, it costs nothing, and the next attempt simply starts over.
 */

export async function ensureUserProfile(
  uid: string,
  displayName: string,
  email: string,
): Promise<void> {
  const ref = doc(getDb(), "users", uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  const now = instant();
  await setDoc(ref, {
    uid,
    displayName,
    email,
    plan: "FREE",
    onboardingCompletedSteps: [],
    acceptedTermsAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  });
}

export interface CreateHouseholdResult {
  readonly householdId: string;
}

export async function createHousehold(
  uid: string,
  displayName: string,
  householdName: string,
  email?: string,
): Promise<CreateHouseholdResult> {
  const db = getDb();
  const householdId = randomId();
  const now = instant();

  // Step 1: the household. The rules require ownerUid to be the caller and the
  // member list to contain only them.
  await setDoc(doc(db, "households", householdId), {
    name: householdName,
    ownerUid: uid,
    memberUids: [uid],
    settings: DEFAULT_HOUSEHOLD_SETTINGS,
    archived: false,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  });

  // Step 2: the membership that actually grants access.
  await setDoc(doc(db, `households/${householdId}/members/${uid}`), {
    uid,
    householdId,
    displayName,
    ...(email ? { email } : {}),
    role: "OWNER",
    status: "ACTIVE",
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
  });

  await seedDefaultCategories(householdId, uid);

  await updateDoc(doc(db, "users", uid), {
    defaultHouseholdId: householdId,
    updatedAt: instant(),
  });

  await markOnboardingStep(uid, "CREATE_HOUSEHOLD");

  return { householdId };
}

/**
 * Writes the starter categories.
 *
 * Ids are derived from the slug so a household never ends up with two
 * "Alimentação" categories if this runs twice.
 */
export async function seedDefaultCategories(householdId: string, uid: string): Promise<void> {
  const db = getDb();
  const now = instant();
  const batch = writeBatch(db);

  DEFAULT_CATEGORIES.forEach((seed, index) => {
    batch.set(doc(db, `households/${householdId}/categories/${seed.slug}`), {
      householdId,
      name: seed.name,
      kind: seed.kind,
      icon: seed.icon,
      defaultExpenseNature: seed.defaultExpenseNature,
      isSystem: true,
      archived: false,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    });
  });

  await batch.commit();
}

export async function markOnboardingStep(uid: string, step: OnboardingStep): Promise<void> {
  const ref = doc(getDb(), "users", uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;

  const current = (snapshot.data().onboardingCompletedSteps ?? []) as OnboardingStep[];
  if (current.includes(step)) return;

  await updateDoc(ref, {
    onboardingCompletedSteps: [...current, step],
    updatedAt: instant(),
  });
}
