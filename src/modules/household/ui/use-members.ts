"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { parseDocument } from "@/modules/shared/infrastructure/codecs";
import { membershipSchema, type MembershipDoc } from "@/modules/shared/infrastructure/schemas";
import { useSession } from "./session-provider";

/**
 * The people in the household.
 *
 * Every screen that asks "de quem é isto?" needs the same list, and the answer
 * has to be a real membership: a name typed free-hand would drift the moment
 * someone corrects their profile, and could never be used to filter what a
 * person is responsible for.
 */

export interface MembersState {
  readonly members: readonly MembershipDoc[];
  /** Everyone who currently has access, in a stable order for selects. */
  readonly active: readonly MembershipDoc[];
  readonly loading: boolean;
  /** A member's name, or a neutral label. Never a raw id. */
  nameOf(memberId: string | undefined): string;
}

export function useMembers(): MembersState {
  const { household } = useSession();
  const [members, setMembers] = useState<MembershipDoc[] | null>(null);

  const householdId = household?.id ?? null;

  useEffect(() => {
    if (!householdId) {
      setMembers([]);
      return;
    }

    const path = `households/${householdId}/members`;
    return onSnapshot(
      collection(getDb(), path),
      (snapshot) =>
        setMembers(
          snapshot.docs.map((document) =>
            parseDocument(membershipSchema, document.id, document.data(), path),
          ),
        ),
      // A failure here must not blank out the form that asked for the list.
      () => setMembers([]),
    );
  }, [householdId]);

  return useMemo(() => {
    const all = members ?? [];
    const active = all
      .filter((member) => member.status !== "REMOVED")
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
    const index = new Map(all.map((member) => [member.id, member]));

    return {
      members: all,
      active,
      loading: members === null,
      nameOf(memberId) {
        if (!memberId) return "Do grupo";
        return index.get(memberId)?.displayName ?? "Pessoa removida";
      },
    };
  }, [members]);
}
