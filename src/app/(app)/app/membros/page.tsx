"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Callout, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { FormError, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import {
  addDependent,
  addMemberByUid,
  changeMemberRole,
  removeMember,
} from "@/modules/household/application/manage-members";
import { canAddOne } from "@/modules/billing/domain/plan-limits";
import { INVITE_VALID_DAYS, createInvite } from "@/modules/household/application/invites";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/modules/household/domain/household";
import { useMembers } from "@/modules/household/ui/use-members";
import { useSession } from "@/modules/household/ui/session-provider";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { InviteFamilyModal } from "@/modules/household/ui/invite-family-modal";
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
  const { active, loading } = useMembers();
  const finance = useFinance();
  const [adding, setAdding] = useState(false);
  const [addingDependent, setAddingDependent] = useState(false);
  const [invitingByEmail, setInvitingByEmail] = useState(false);
  const [invitingFamily, setInvitingFamily] = useState(false);
  const [copied, setCopied] = useState(false);

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
            <Button onClick={() => setInvitingByEmail(true)}>Convidar por e-mail</Button>
            <Button variant="secondary" onClick={() => setInvitingFamily(true)}>
              👨‍👩‍👧‍👦 Cadastrar Familiar
            </Button>
            <Button variant="secondary" onClick={() => setAddingDependent(true)}>
              Adicionar pessoa sem acesso
            </Button>
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Adicionar por código
            </Button>
          </div>
        ) : null}
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

      <AuditFeedCard events={auditEvents} />

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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--card-border)] pb-3">
          <CardTitle hint="Convide seu cônjuge ou familiar para organizar as finanças juntos">
            👨‍👩‍👧‍👦 Compartilhamento Familiar
          </CardTitle>
          <span className="rounded-md bg-[color:var(--color-surface-sunken)] px-2 py-0.5 text-xs font-semibold text-[color:var(--color-brand-600)]">
            Acesso Conjunto
          </span>
        </div>

        <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
          Sair das dívidas e conquistar metas em família é muito mais rápido quando os dois
          acompanham os mesmos números. Envie um convite direto pelo WhatsApp com as orientações de
          entrada.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              const text = encodeURIComponent(
                `Oi! Criei nosso painel de planejamento e metas da família no Conta comigo.\n\n` +
                  `1. Acesse https://contacomigo.app/entrar e crie sua conta com seu e-mail.\n` +
                  `2. Depois, vá em Menu > Membros, copie o código do seu identificador e me mande por aqui.\n` +
                  `3. Eu vou te adicionar ao grupo da nossa casa para acompanharmos nossos gastos e metas juntos!`,
              );
              window.open(`https://wa.me/?text=${text}`, "_blank");
            }}
          >
            💬 Convidar pelo WhatsApp
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const text =
                `Oi! Criei nosso painel de planejamento e metas da família no Conta comigo.\n\n` +
                `1. Acesse https://contacomigo.app/entrar e crie sua conta com seu e-mail.\n` +
                `2. Depois, vá em Menu > Membros, copie o código do seu identificador e me mande por aqui.\n` +
                `3. Eu vou te adicionar ao grupo da nossa casa para acompanharmos nossos gastos e metas juntos!`;
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copiado!" : "Copiar texto do convite"}
          </Button>
        </div>

        <ol className="mt-5 ml-4 list-decimal space-y-1.5 border-t border-[color:var(--card-border)] pt-4 text-sm">
          <li>A outra pessoa cria a própria conta no Conta comigo com o e-mail dela.</li>
          <li>
            Ela abre <strong>Mais &rarr; Membros</strong> e copia o código que aparece em &ldquo;Seu
            identificador&rdquo;.
          </li>
          <li>
            Você clica em <strong>Adicionar por código</strong> acima e cola o código dela.
          </li>
        </ol>
        <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
          A partir daí vocês veem os mesmos números com total transparência. Cada cartão, conta,
          dívida e gasto pode ser atribuído a uma pessoa específica ou à casa toda.
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
      <AddDependentDialog open={addingDependent} onClose={() => setAddingDependent(false)} />
      <InviteByEmailDialog open={invitingByEmail} onClose={() => setInvitingByEmail(false)} />
      <InviteFamilyModal open={invitingFamily} onClose={() => setInvitingFamily(false)} />
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

function AddMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household, user, effectivePlan } = useSession();
  const { active } = useMembers();
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

    // Dependentes não ocupam assento: o limite do plano é sobre pessoas com
    // acesso, e cobrar por um filho de doze anos que nem entra no aplicativo
    // tornaria o plano gratuito inútil para uma família.
    const seats = active.filter((member) => member.role !== "DEPENDENT").length;
    const room = canAddOne("members", effectivePlan, seats);
    if (!room.allowed) {
      setError(room.message);
      return;
    }

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
            { value: "MEMBER", label: "Membro — registra e edita informações financeiras" },
            { value: "OPERATOR", label: "Operador — lança comprovantes/gastos (sem excluir registros ou alterar orçamentos)" },
            { value: "ADMIN", label: "Administrador — gerencia membros e configurações do grupo" },
            { value: "VIEWER", label: "Visualizador — consulta relatórios sem alterar dados" },
            { value: "DEPENDENT", label: "Dependente — visão restrita aos próprios lançamentos e mesada" },
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
