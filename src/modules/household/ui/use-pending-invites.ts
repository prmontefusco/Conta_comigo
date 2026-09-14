"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { useSession } from "./session-provider";
import type { HouseholdRole } from "@/modules/shared/domain/common";

/**
 * Convites por e-mail que ainda não foram aceitos.
 *
 * Sem isto, um convite criado desaparecia da tela assim que o modal fechava —
 * quem administra não tinha como saber se ainda estava pendente, muito menos
 * cancelar um endereço digitado errado.
 */

export interface PendingInvite {
  readonly id: string;
  readonly email: string;
  readonly role: HouseholdRole;
  readonly expiresAt: Date;
}

export interface PendingInvitesState {
  readonly invites: readonly PendingInvite[];
  readonly loading: boolean;
  /**
   * Set quando a própria assinatura falhou (rede ou permissão) - distinto de
   * não haver nenhum convite pendente, que também deixa `invites` em `[]`.
   */
  readonly error: string | null;
}

export function usePendingInvites(): PendingInvitesState {
  const { household } = useSession();
  const [invites, setInvites] = useState<PendingInvite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const householdId = household?.id ?? null;

  useEffect(() => {
    if (!householdId) {
      setInvites([]);
      setError(null);
      return;
    }

    return onSnapshot(
      collection(getDb(), `households/${householdId}/invites`),
      (snapshot) => {
        const pending: PendingInvite[] = [];
        for (const document of snapshot.docs) {
          const data = document.data();
          if (data.status !== "PENDING") continue;
          const expiresAt = data.expiresAt?.toDate?.() ?? new Date(data.expiresAt);
          pending.push({
            id: document.id,
            email: typeof data.email === "string" ? data.email : document.id,
            role: data.role as HouseholdRole,
            expiresAt,
          });
        }
        pending.sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));
        setError(null);
        setInvites(pending);
      },
      // Uma falha aqui não pode travar o resto da tela de membros, mas
      // precisa ficar distinguível de "não há convite pendente".
      (subscriptionError) => {
        setError(
          subscriptionError.code === "permission-denied"
            ? "Você não tem acesso aos convites deste grupo."
            : "Não foi possível carregar os convites agora.",
        );
        setInvites([]);
      },
    );
  }, [householdId]);

  return useMemo(
    () => ({ invites: invites ?? [], loading: invites === null, error }),
    [invites, error],
  );
}
