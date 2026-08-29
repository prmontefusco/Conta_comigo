"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Badge, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { getDb } from "@/lib/firebase/client";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/modules/household/domain/household";
import { useSession } from "@/modules/household/ui/session-provider";
import { parseDocument } from "@/modules/shared/infrastructure/codecs";
import { membershipSchema, type MembershipDoc } from "@/modules/shared/infrastructure/schemas";

/**
 * Who is in the household and what each of them can do.
 *
 * Roles are shown with what they actually permit, because "Admin" alone tells
 * nobody whether that person can see the balances.
 */
export default function MembersPage() {
  const { household, user, role } = useSession();
  const [members, setMembers] = useState<MembershipDoc[] | null>(null);

  useEffect(() => {
    if (!household) return;
    const path = `households/${household.id}/members`;
    return onSnapshot(
      collection(getDb(), path),
      (snapshot) =>
        setMembers(
          snapshot.docs.map((document) =>
            parseDocument(membershipSchema, document.id, document.data(), path),
          ),
        ),
      () => setMembers([]),
    );
  }, [household]);

  if (!members) return <Spinner label="Carregando membros" />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Membros</h1>

      <Card>
        <CardTitle hint={household?.name}>Quem tem acesso</CardTitle>
        <ul className="divide-y divide-[color:var(--card-border)]">
          {members
            .filter((member) => member.status !== "REMOVED")
            .map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {member.displayName}
                    {member.uid === user?.uid ? (
                      <span style={{ color: "var(--muted-fg)" }}> (você)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--muted-fg)" }}>
                    {member.email ?? "sem e-mail cadastrado"}
                  </p>
                </div>
                <Badge tone={member.role === "OWNER" ? "brand" : "neutral"}>
                  {ROLE_LABELS[member.role]}
                </Badge>
              </li>
            ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>O que cada papel pode fazer</CardTitle>
        <dl className="space-y-3 text-sm">
          {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((key) => (
            <div key={key}>
              <dt className="font-medium">{ROLE_LABELS[key]}</dt>
              <dd style={{ color: "var(--muted-fg)" }}>{ROLE_DESCRIPTIONS[key]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardTitle>Convidar alguém</CardTitle>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          {role === "OWNER" || role === "ADMIN"
            ? "O envio de convites por e-mail ainda não está disponível. Por enquanto, cada pessoa cria a própria conta e você a adiciona pelo identificador dela."
            : "Apenas quem administra o grupo pode convidar novas pessoas."}
        </p>
      </Card>
    </div>
  );
}
