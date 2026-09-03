"use client";

import { useState } from "react";
import { Badge, Button, Callout, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { FormError, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import {
  addMemberByUid,
  changeMemberRole,
  removeMember,
} from "@/modules/household/application/manage-members";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/modules/household/domain/household";
import { useMembers } from "@/modules/household/ui/use-members";
import { useSession } from "@/modules/household/ui/session-provider";
import type { HouseholdRole } from "@/modules/shared/domain/common";

/**
 * Who is in the household, and how someone else joins it.
 *
 * A couple organising money together is the ordinary case, not an advanced
 * one: the second person needs their own login, their own cards and their own
 * expenses, all inside the same numbers. This screen is where that starts.
 *
 * Roles are shown with what they actually permit, because "Admin" alone tells
 * nobody whether that person can see the balances.
 */
export default function MembersPage() {
  const { household, user, canAdminister } = useSession();
  const { active, loading } = useMembers();
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) return <Spinner label="Carregando membros" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Membros</h1>
        {canAdminister ? <Button onClick={() => setAdding(true)}>Adicionar pessoa</Button> : null}
      </div>

      <Card>
        <CardTitle hint={household?.name}>Quem tem acesso</CardTitle>
        <ul className="divide-y divide-[color:var(--card-border)]">
          {active.map((member) => (
            <MemberRow
              key={member.id}
              memberId={member.id}
              displayName={member.displayName}
              email={member.email}
              role={member.role}
              isMe={member.uid === user?.uid}
              canAdminister={canAdminister}
              householdId={household?.id ?? ""}
            />
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle hint="Passe este código para quem for entrar no seu grupo.">
          Seu identificador
        </CardTitle>
        <p className="tabular rounded-lg border border-[color:var(--card-border)] p-3 text-sm break-all">
          {user?.uid}
        </p>
        <Button
          variant="secondary"
          className="mt-2"
          onClick={async () => {
            if (!user?.uid) return;
            try {
              await navigator.clipboard.writeText(user.uid);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copiado" : "Copiar identificador"}
        </Button>
        <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
          Ele identifica sua conta e não dá acesso a nada sozinho. Quem administra o grupo precisa
          dele para incluir você.
        </p>
      </Card>

      <Card>
        <CardTitle>Como incluir seu marido, sua esposa ou um filho</CardTitle>
        <ol className="ml-4 list-decimal space-y-1.5 text-sm">
          <li>A pessoa cria a própria conta no Conta comigo, com o e-mail dela.</li>
          <li>
            Ela abre <strong>Mais &rarr; Membros</strong> e copia o código que aparece em &ldquo;Seu
            identificador&rdquo;.
          </li>
          <li>
            Você usa <strong>Adicionar pessoa</strong> aqui e cola esse código.
          </li>
        </ol>
        <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
          A partir daí vocês veem os mesmos números. Cada cartão, conta, dívida e gasto pode ser
          marcado como de uma pessoa ou do grupo, e as telas mostram os dois recortes.
        </p>
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

      <AddMemberDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function MemberRow({
  memberId,
  displayName,
  email,
  role,
  isMe,
  canAdminister,
  householdId,
}: {
  memberId: string;
  displayName: string;
  email?: string;
  role: HouseholdRole;
  isMe: boolean;
  canAdminister: boolean;
  householdId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // The owner's role is fixed, and nobody may change their own: both are
  // enforced by the rules, and offering the control anyway would only produce
  // a permission error.
  const editable = canAdminister && role !== "OWNER" && !isMe;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {displayName}
          {isMe ? <span style={{ color: "var(--muted-fg)" }}> (você)</span> : null}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--muted-fg)" }}>
          {email ?? "sem e-mail cadastrado"}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {editable ? (
          <>
            <label className="text-sm">
              <span className="sr-only">Papel de {displayName}</span>
              <select
                value={role}
                disabled={busy}
                onChange={async (event) => {
                  setBusy(true);
                  await changeMemberRole({
                    db: getDb(),
                    householdId,
                    uid: memberId,
                    role: event.target.value as Exclude<HouseholdRole, "OWNER">,
                  });
                  setBusy(false);
                }}
                className="min-h-11 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 text-sm"
              >
                {(["ADMIN", "MEMBER", "VIEWER"] as const).map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            {confirming ? (
              <>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await removeMember({ db: getDb(), householdId, uid: memberId });
                    setBusy(false);
                  }}
                >
                  Confirmar
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirming(true)}>
                Remover
              </Button>
            )}
          </>
        ) : (
          <Badge tone={role === "OWNER" ? "brand" : "neutral"}>{ROLE_LABELS[role]}</Badge>
        )}
      </div>
    </li>
  );
}

function AddMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household, user } = useSession();
  const [uid, setUid] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<HouseholdRole, "OWNER">>("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household || !user) return;

    setSaving(true);
    const result = await addMemberByUid({
      db: getDb(),
      householdId: household.id,
      actorUid: user.uid,
      uid,
      displayName,
      email: email || undefined,
      role,
    }).catch(() => null);
    setSaving(false);

    if (!result) {
      setError("Não foi possível adicionar agora. Tente novamente.");
      return;
    }
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setUid("");
    setDisplayName("");
    setEmail("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar pessoa ao grupo"
      description="Ela precisa ter criado a própria conta antes."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <Callout tone="info" title="Onde encontrar o identificador">
          A pessoa entra na conta dela, abre <strong>Mais &rarr; Membros</strong> e copia o código
          em &ldquo;Seu identificador&rdquo;.
        </Callout>

        <TextField
          label="Nome"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Maria"
        />

        <TextField
          label="Identificador da conta dela"
          required
          value={uid}
          onChange={(event) => setUid(event.target.value)}
          placeholder="Cole aqui o código"
          hint="Sem ele, não há como ligar o acesso à conta certa."
        />

        <TextField
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Opcional, só para você reconhecer"
        />

        <SelectField
          label="Papel"
          value={role}
          onChange={(event) => setRole(event.target.value as Exclude<HouseholdRole, "OWNER">)}
          options={[
            { value: "MEMBER", label: "Membro — registra e edita informações" },
            { value: "ADMIN", label: "Administrador — também gerencia o grupo" },
            { value: "VIEWER", label: "Visualizador — só vê, não altera" },
          ]}
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Adicionando…" : "Adicionar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
