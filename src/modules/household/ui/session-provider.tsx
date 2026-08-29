"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { getAuthClient, getDb } from "@/lib/firebase/client";
import {
  resolveEffectivePlan,
  type Subscription,
  type UserPlan,
} from "@/modules/billing/domain/subscription";
import type { HouseholdRole } from "@/modules/shared/domain/common";
import {
  householdSchema,
  membershipSchema,
  userProfileSchema,
  type HouseholdDoc,
  type MembershipDoc,
  type UserProfileDoc,
} from "@/modules/shared/infrastructure/schemas";
import { parseDocument } from "@/modules/shared/infrastructure/codecs";

/**
 * Authentication and household selection.
 *
 * Kept apart from the financial data provider on purpose: knowing who someone
 * is and which household they are looking at is a different concern from
 * loading that household's money, and the login screen needs the first
 * without paying for the second.
 */

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionValue {
  readonly status: SessionStatus;
  readonly user: User | null;
  readonly profile: UserProfileDoc | null;
  readonly households: readonly HouseholdDoc[];
  readonly household: HouseholdDoc | null;
  readonly membership: MembershipDoc | null;
  readonly role: HouseholdRole | null;
  readonly canWrite: boolean;
  readonly canAdminister: boolean;
  readonly subscription: Subscription | null;
  /**
   * O plano que vale agora, já considerando a data de vencimento.
   *
   * Nunca leia `profile.plan` para decidir o que mostrar: ele é um espelho de
   * conveniência escrito pelo servidor e não sabe se o prazo acabou. Uma
   * assinatura vencida ficaria sem anúncios para sempre.
   */
  readonly effectivePlan: UserPlan;
  readonly isPremium: boolean;
  selectHousehold(householdId: string): void;
  logout(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const SELECTED_HOUSEHOLD_KEY = "conta-comigo:selected-household";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [households, setHouseholds] = useState<HouseholdDoc[]>([]);
  const [membership, setMembership] = useState<MembershipDoc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  /* --- Auth state ---------------------------------------------------- */

  useEffect(() => {
    return onAuthStateChanged(getAuthClient(), (nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
      if (!nextUser) {
        setProfile(null);
        setHouseholds([]);
        setMembership(null);
        setSelectedId(null);
        setSubscription(null);
      }
    });
  }, []);

  /* --- Profile ------------------------------------------------------- */

  const loadProfile = useCallback(async (uid: string) => {
    const snapshot = await getDoc(doc(getDb(), "users", uid));
    if (!snapshot.exists()) {
      setProfile(null);
      return;
    }
    setProfile(parseDocument(userProfileSchema, snapshot.id, snapshot.data(), "users"));
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadProfile(user.uid);
  }, [user, loadProfile]);

  /* --- Assinatura ----------------------------------------------------- */

  useEffect(() => {
    if (!user) return;

    // Legível só pela própria pessoa, e gravável por ninguém pelo cliente
    // (firestore.rules, docs/adr/0009-server-side-payments.md).
    return onSnapshot(
      doc(getDb(), "subscriptions", user.uid),
      (snapshot) => {
        setSubscription(snapshot.exists() ? (snapshot.data() as Subscription) : null);
      },
      () => setSubscription(null),
    );
  }, [user]);

  /* --- Households the user belongs to -------------------------------- */

  useEffect(() => {
    if (!user) return;

    // The query mirrors the Security Rule exactly: only households that list
    // this uid can come back, and the rules refuse any broader query.
    const q = query(
      collection(getDb(), "households"),
      where("memberUids", "array-contains", user.uid),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((document) =>
          parseDocument(householdSchema, document.id, document.data(), "households"),
        );
        setHouseholds(items);
      },
      (error) => {
        console.error("[conta-comigo] Falha ao carregar os grupos:", error.message);
        setHouseholds([]);
      },
    );
  }, [user]);

  /* --- Which household is being viewed -------------------------------- */

  useEffect(() => {
    if (households.length === 0) {
      setSelectedId(null);
      return;
    }
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(SELECTED_HOUSEHOLD_KEY) : null;

    const preferred =
      households.find((item) => item.id === selectedId) ??
      households.find((item) => item.id === stored) ??
      households.find((item) => item.id === profile?.defaultHouseholdId) ??
      households[0];

    if (preferred && preferred.id !== selectedId) setSelectedId(preferred.id);
  }, [households, profile?.defaultHouseholdId, selectedId]);

  /* --- The caller's membership in that household ---------------------- */

  useEffect(() => {
    if (!user || !selectedId) {
      setMembership(null);
      return;
    }
    return onSnapshot(
      doc(getDb(), `households/${selectedId}/members/${user.uid}`),
      (snapshot) => {
        setMembership(
          snapshot.exists()
            ? parseDocument(membershipSchema, snapshot.id, snapshot.data(), "members")
            : null,
        );
      },
      () => setMembership(null),
    );
  }, [user, selectedId]);

  const selectHousehold = useCallback((householdId: string) => {
    setSelectedId(householdId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_HOUSEHOLD_KEY, householdId);
    }
  }, []);

  const logout = useCallback(async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SELECTED_HOUSEHOLD_KEY);
    }
    await signOut(getAuthClient());
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.uid);
  }, [user, loadProfile]);

  const household = households.find((item) => item.id === selectedId) ?? null;
  const role = membership?.status === "ACTIVE" ? membership.role : null;
  const effectivePlan = resolveEffectivePlan(subscription);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      profile,
      households,
      household,
      membership,
      role,
      canWrite: role === "OWNER" || role === "ADMIN" || role === "MEMBER",
      canAdminister: role === "OWNER" || role === "ADMIN",
      subscription,
      effectivePlan,
      isPremium: effectivePlan === "PREMIUM",
      selectHousehold,
      logout,
      refreshProfile,
    }),
    [
      status,
      user,
      profile,
      households,
      household,
      membership,
      role,
      subscription,
      effectivePlan,
      selectHousehold,
      logout,
      refreshProfile,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession precisa estar dentro de <SessionProvider>.");
  }
  return value;
}

/** Loads the households a uid belongs to, outside React. Used during onboarding. */
export async function fetchHouseholdsFor(uid: string): Promise<HouseholdDoc[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), "households"), where("memberUids", "array-contains", uid)),
  );
  return snapshot.docs.map((document) =>
    parseDocument(householdSchema, document.id, document.data(), "households"),
  );
}
