"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Callout, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { FormError, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import {
  addDependent,
  changeMemberRole,
  removeMember,
} from "@/modules/household/application/manage-members";
import { canAddOne } from "@/modules/billing/domain/plan-limits";
import {
  INVITE_VALID_DAYS,
  cancelInvite,
  createInvite,
} from "@/modules/household/application/invites";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/modules/household/domain/household";
import { useMembers } from "@/modules/household/ui/use-members";
import { usePendingInvites } from "@/modules/household/ui/use-pending-invites";
import { useSession } from "@/modules/household/ui/session-provider";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { CreateMemberAccountDialog } from "@/modules/household/ui/create-member-account-dialog";
import { AuditFeedCard } from "@/modules/household/ui/audit-feed-card";
import {
  createFamilyAuditEvent,
  sortAuditEventsDescending,
  type FamilyAuditEvent,
} from "@/modules/household/domain/audit-log";
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
  const { active, loading, error: membersError } = useMembers();
  const { invites: pendingInvites, error: invitesError } = usePendingInvites();
  const finance = useFinance();
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [addingDependent, setAddingDependent] = useState(false);
  const [invitingByEmail, setInvitingByEmail] = useState(false);

  const auditEvents = useMemo(() => {
    if (!household) return [];
    const memberMap = new Map(active.map((m) => [m.uid, m.displayName]));
    const events: FamilyAuditEvent[] = [];

    for (const t of finance.transactions.slice(0, 20)) {
      const actorName = memberMap.get(t.createdBy) ?? "Membro da casa";
      events.push(
        createFamilyAuditEvent({
          id: `tx_${t.id}`,
          householdId: t.householdId,
          actorId: t.createdBy,
          actorName,
          actionType: t.kind === "EXPENSE" ? "EXPENSE_CREATED" : "INCOME_CREATED",
          entityName: t.description,
          amount: t.amount,
          timestamp: t.createdAt,
        }),
      );
    }

    for (const o of finance.obligations.filter((o) => o.status === "SETTLED").slice(0, 10)) {
      const actorName = memberMap.get(o.createdBy) ?? "Membro da casa";
      events.push(
        createFamilyAuditEvent({
          id: `ob_${o.id}`,
          householdId: o.householdId,
          actorId: o.createdBy,
          actorName,
          actionType: "BILL_PAID",
          entityName: o.description,
          amount: o.amount,
          timestamp: o.updatedAt,
        }),
      );
    }

    for (const m of active) {
      if (m.joinedAt) {
        events.push(
          createFamilyAuditEvent({
            id: `mb_${m.id}`,
            householdId: m.householdId,
            actorId: m.uid,
            actorName: m.displayName,
            actionType: "MEMBER_INVITED",
            entityName: m.displayName,
            timestamp: m.joinedAt,
          }),
        );
      }
    }

    return sortAuditEventsDescending(events);
  }, [household, finance.transactions, finance.obligations, active]);

  if (loading) return <Spinner label="Carregando membros" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Membros da Família</h1>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Compartilhe o planejamento da casa com seu cônjuge ou filhos
          </p>
        </div>
        {canAdminister ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setCreatingAccount(true)}>Adicionar membro</Button>
            <Button variant="secondary" onClick={() => setInvitingByEmail(true)}>
              Convidar por e-mail
            </Button>
            <Button variant="secondary" onClick={() => setAddingDependent(true)}>
              Adicionar pessoa sem acesso
            </Button>
          </div>
        ) : null}
      </div>

      {membersError || invitesError ? (
        <Callout tone="critical" title="Não foi possível carregar tudo">
          {membersError ?? invitesError}
        </Callout>
      ) : null}

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

      {canAdminister && pendingInvites.length > 0 ? (
        <Card>
          <CardTitle hint="Ainda não foram aceitos. Cancele se digitou o e-mail errado ou desistiu.">
            Convites pendentes
          </CardTitle>
          <ul className="divide-y divide-[color:var(--card-border)]">
            {pendingInvites.map((invite) => (
              <PendingInviteRow
                key={invite.id}
                email={invite.email}
                role={invite.role}
                expiresAt={invite.expiresAt}
                householdId={household?.id ?? ""}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      <AuditFeedCard events={auditEvents} />

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

      <CreateMemberAccountDialog open={creatingAccount} onClose={() => setCreatingAccount(false)} />
      <AddDependentDialog open={addingDependent} onClose={() => setAddingDependent(false)} />
      <InviteByEmailDialog open={invitingByEmail} onClose={() => setInvitingByEmail(false)} />
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
  const [error, setError] = useState<string | null>(null);

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
        {error ? (
          <p className="text-xs" style={{ color: "var(--tone-critical)" }}>
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {/* Um dependente não tem papel a escolher: mudar isso seria fazer um
            perfil sem acesso virar um com acesso, e as Security Rules recusam
            essa travessia nas duas direções. */}
        {editable && role !== "DEPENDENT" ? (
          <>
            <label className="text-sm">
              <span className="sr-only">Papel de {displayName}</span>
              <select
                value={role}
                disabled={busy}
                onChange={async (event) => {
                  setBusy(true);
                  setError(null);
                  const result = await changeMemberRole({
                    db: getDb(),
                    householdId,
                    uid: memberId,
                    role: event.target.value as Exclude<HouseholdRole, "OWNER">,
                  });
                  setBusy(false);
                  if (!result.ok) setError(result.error.message);
                }}
                className="min-h-11 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 text-sm"
              >
                {(["ADMIN", "MEMBER", "OPERATOR", "VIEWER", "DEPENDENT"] as const).map((option) => (
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
                    setError(null);
                    const result = await removeMember({ db: getDb(), householdId, uid: memberId });
                    setBusy(false);
                    if (!result.ok) {
                      setError(result.error.message);
                      return;
                    }
                    setConfirming(false);
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

function PendingInviteRow({
  email,
  role,
  expiresAt,
  householdId,
}: {
  email: string;
  role: HouseholdRole;
  expiresAt: Date;
  householdId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const expired = expiresAt.getTime() <= Date.now();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{email}</p>
        <p className="truncate text-xs" style={{ color: "var(--muted-fg)" }}>
          {ROLE_LABELS[role]} ·{" "}
          {expired ? "convite vencido" : `expira em ${expiresAt.toLocaleDateString("pt-BR")}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await cancelInvite({ db: getDb(), householdId, email });
                setBusy(false);
              }}
            >
              Confirmar
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Voltar
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Cancelar convite
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Convidar quem vai usar o aplicativo.
 *
 * O caminho antigo pedia que a outra pessoa criasse a conta, achasse o próprio
 * identificador de 28 caracteres e o mandasse de volta. Aqui o administrador
 * informa o e-mail, e o link resultante é a única coisa que viaja — numa
 * direção só.
 */
function InviteByEmailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household, user, effectivePlan } = useSession();
  const { active } = useMembers();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<HouseholdRole, "OWNER" | "DEPENDENT">>("MEMBER");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    setEmail("");
    setLink(null);
    setCopied(false);
    setError(null);
    onClose();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household || !user) return;

    const seats = active.filter((member) => member.role !== "DEPENDENT").length;
    const room = canAddOne("members", effectivePlan, seats);
    if (!room.allowed) {
      setError(room.message);
      return;
    }

    setSaving(true);
    const result = await createInvite({
      db: getDb(),
      householdId: household.id,
      actorUid: user.uid,
      email,
      role,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setLink(`${window.location.origin}/app/convite?grupo=${household.id}`);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Convidar por e-mail"
      description="A pessoa cria a conta com esse mesmo e-mail, abre o link e entra. Nada precisa voltar para você."
    >
      {link ? (
        <div className="space-y-4">
          <Callout tone="positive">
            Convite criado para <strong>{email}</strong>. Ele vale por {INVITE_VALID_DAYS} dias.
          </Callout>

          <div>
            <p className="text-2xs font-semibold tracking-wider uppercase">Link do convite</p>
            <p className="mt-1 rounded-lg border border-[color:var(--card-border)] p-3 text-sm break-all">
              {link}
            </p>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copiado" : "Copiar link"}
            </Button>
          </div>

          <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
            O aplicativo não envia e-mail — mande o link por onde preferir. Só quem entrar com{" "}
            <strong>{email}</strong>, e tiver confirmado esse endereço, consegue usá-lo.
          </p>

          <Button onClick={close} className="w-full">
            Pronto
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <FormError>{error}</FormError> : null}

          <TextField
            label="E-mail da pessoa"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@exemplo.com"
            hint="Precisa ser o mesmo e-mail com que ela vai criar a conta."
          />

          <SelectField
            label="O que ela vai poder fazer"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as Exclude<HouseholdRole, "OWNER" | "DEPENDENT">)
            }
            options={[
              { value: "MEMBER", label: "Membro — registra e edita informações" },
              { value: "ADMIN", label: "Administrador — também gerencia o grupo" },
              { value: "VIEWER", label: "Visualizador — só vê, não altera" },
            ]}
          />

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Criando…" : "Criar convite"}
            </Button>
            <Button type="button" variant="secondary" onClick={close}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * Uma pessoa da casa que não entra no aplicativo.
 *
 * Um campo só, porque é tudo o que existe para pedir: um dependente não tem
 * e-mail para convidar nem papel para escolher. Ele passa a aparecer em "de
 * quem é este gasto", e nada além disso.
 */
function AddDependentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household, user } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household || !user) return;

    setSaving(true);
    const result = await addDependent({
      db: getDb(),
      householdId: household.id,
      actorUid: user.uid,
      displayName,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setDisplayName("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar pessoa sem acesso"
      description="Para quem faz parte da casa mas não vai usar o aplicativo: filhos, pais, quem não precisa entrar."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <TextField
          label="Nome da pessoa"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Lucas"
          hint="Ela passa a aparecer quando você escolhe de quem é um gasto. Não recebe convite, não faz login e não vê nada."
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Adicionar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

