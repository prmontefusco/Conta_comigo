import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getAuthClient, getDb } from "@/lib/firebase/client";
import { createHousehold, ensureUserProfile } from "@/modules/household/application/onboarding";

/**
 * Signing in with Google.
 *
 * Two things have to be true after this returns, and neither is done by
 * Firebase Auth: the person must have a profile document, and they must belong
 * to a household. Without both, they would land in an application that has
 * nowhere to put a single number.
 *
 * The email form asks for a group name; Google gives us no chance to ask. So a
 * first-time Google sign-in creates the household with a name derived from
 * theirs, which is renameable in Configurações. Asking one more question
 * before showing anything would undo the reason someone chose this button.
 */

export type GoogleSignInResult =
  /** Signed in and ready. `isNew` means a household was just created. */
  | { readonly status: "SIGNED_IN"; readonly isNew: boolean }
  /** The popup was blocked, so the browser is being sent to Google instead. */
  | { readonly status: "REDIRECTING" }
  /** The person closed the popup. Not an error, and not worth a message. */
  | { readonly status: "CANCELLED" };

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the chooser: on a shared machine, silently reusing the last
  // Google session is how someone ends up looking at the wrong finances.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const auth = getAuthClient();

  try {
    const credential = await signInWithPopup(auth, googleProvider());
    const isNew = await ensureAccountReady(credential.user);
    return { status: "SIGNED_IN", isNew };
  } catch (error) {
    const code = errorCode(error);

    // Closing the popup, or opening a second one, is a decision - not a fault.
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return { status: "CANCELLED" };
    }

    // Popups are blocked in more places than people expect: in-app browsers,
    // strict privacy settings, some corporate profiles. The redirect flow works
    // in all of them, so a blocked popup must not be a dead end.
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(auth, googleProvider());
      return { status: "REDIRECTING" };
    }

    throw error;
  }
}

/**
 * Finishes a redirect sign-in when the browser comes back.
 *
 * Returns null when this page load is not the return leg, which is the normal
 * case and must stay silent.
 */
export async function completeGoogleRedirect(): Promise<GoogleSignInResult | null> {
  const credential = await getRedirectResult(getAuthClient());
  if (!credential) return null;

  const isNew = await ensureAccountReady(credential.user);
  return { status: "SIGNED_IN", isNew };
}

/**
 * Makes sure the account has everything the app needs.
 *
 * Idempotent on purpose: it runs on every Google sign-in, not only the first,
 * because an interrupted first attempt would otherwise leave an account that
 * can authenticate and nothing else.
 *
 * Returns true when a household had to be created.
 */
export async function ensureAccountReady(user: User): Promise<boolean> {
  const displayName = readDisplayName(user);
  const email = user.email?.trim();

  // The profile requires a real address, and every downstream screen reads it
  // back through the schema. A Google account without one - possible, if rare -
  // must fail here with something a person can act on, not write a document
  // that breaks the next page load.
  if (!email) {
    throw Object.assign(new Error("Google account without an email address."), {
      code: "auth/missing-email",
    });
  }

  await ensureUserProfile(user.uid, displayName, email);

  const existing = await getDocs(
    query(
      collection(getDb(), "households"),
      where("memberUids", "array-contains", user.uid),
      limit(1),
    ),
  );
  if (!existing.empty) return false;

  await createHousehold(user.uid, displayName, defaultHouseholdName(displayName), email);
  return true;
}

/** A Google account can have no name; an empty one would break the schema. */
function readDisplayName(user: User): string {
  const fromProfile = user.displayName?.trim();
  if (fromProfile) return fromProfile.slice(0, 80);

  const localPart = user.email?.split("@")[0]?.trim();
  return localPart && localPart.length >= 2 ? localPart.slice(0, 80) : "Você";
}

/** Renameable in Configurações, so a good guess beats another question. */
function defaultHouseholdName(displayName: string): string {
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  return `Finanças de ${firstName}`.slice(0, 80);
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}
