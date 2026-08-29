"use client";

import { useState } from "react";
import { deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { Badge, Button, Callout, Card, CardTitle } from "@/components/ui/primitives";
import { FormError, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getAuthClient, getDb } from "@/lib/firebase/client";
import { authErrorMessage } from "@/modules/auth/ui/auth-errors";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  deleteAccountData,
  exportUserData,
  planAccountDeletion,
  type DeletionPlan,
} from "@/modules/privacy/application/data-portability";

/**
 * The person's own data: taking it, and removing it.
 *
 * Both rights are exercised here without asking anyone for permission and
 * without a support ticket. A right that requires an e-mail to a support inbox
 * is not really available (docs/SECURITY.md, "LGPD").
 */
export default function MyDataPage() {
  const { user, profile, households, logout } = useSession();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const plan: DeletionPlan = user
    ? planAccountDeletion(
        user.uid,
        households.map((household) => ({
          id: household.id,
          name: household.name,
          ownerUid: household.ownerUid,
          memberUids: household.memberUids,
        })),
      )
    : { entries: [], blocked: false };

  async function onExport() {
    if (!user) return;
    setExporting(true);
    setExportError(null);

    try {
      const payload = await exportUserData(
        getDb(),
        user.uid,
        households.map((household) => household.id),
      );

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `conta-comigo-${payload.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setExportError("Não foi possível gerar a exportação agora. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Meus dados</h1>

      <Card aria-labelledby="exportar-title">
        <CardTitle
          id="exportar-title"
          hint="Um arquivo JSON com tudo o que você pode ver hoje no aplicativo."
        >
          Levar meus dados
        </CardTitle>

        {exportError ? <FormError>{exportError}</FormError> : null}

        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Inclui seu perfil, seus grupos, contas, movimentações, obrigações, cartões, compras,
          dívidas, reservas, metas, orçamentos e regras de recorrência. Valores vêm em centavos
          inteiros, como são guardados, para poderem ser lidos por outro sistema sem ambiguidade.
        </p>

        <Button className="mt-4" onClick={() => void onExport()} disabled={exporting}>
          {exporting ? "Preparando…" : "Baixar meus dados"}
        </Button>
      </Card>

      <Card aria-labelledby="excluir-title">
        <CardTitle id="excluir-title" hint="Esta ação não pode ser desfeita.">
          Excluir minha conta
        </CardTitle>

        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Antes de excluir, vale baixar seus dados: depois não há como recuperá-los.
        </p>

        {plan.entries.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {plan.entries.map((entry) => (
              <li
                key={entry.householdId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--card-border)] pb-2 text-sm last:border-0"
              >
                <span className="font-medium">{entry.name}</span>
                {entry.kind === "DELETE_HOUSEHOLD" ? (
                  <Badge tone="critical">Será excluído com todos os dados</Badge>
                ) : entry.kind === "LEAVE_HOUSEHOLD" ? (
                  <Badge tone="neutral">Você sai; o grupo continua</Badge>
                ) : (
                  <Badge tone="attention">
                    Bloqueado: você é o responsável e há mais {entry.otherMembers}{" "}
                    {entry.otherMembers === 1 ? "pessoa" : "pessoas"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {plan.blocked ? (
          <Callout tone="attention" title="Há algo a resolver primeiro">
            Você é o responsável por um grupo que tem outras pessoas. Excluir sua conta apagaria
            dados que não são só seus. Transfira a responsabilidade ou remova os outros membros
            antes de continuar.
          </Callout>
        ) : (
          <Button variant="danger" className="mt-5" onClick={() => setConfirming(true)}>
            Excluir minha conta
          </Button>
        )}
      </Card>

      <Card>
        <CardTitle>O que fazemos com seus dados</CardTitle>
        <ul className="list-disc space-y-1.5 pl-5 text-sm" style={{ color: "var(--muted-fg)" }}>
          <li>Nenhuma informação financeira sua é enviada a redes de publicidade.</li>
          <li>Ninguém fora dos seus grupos tem acesso aos seus dados.</li>
          <li>Não vendemos dados pessoais.</li>
          <li>
            Detalhes na{" "}
            <a href="/privacidade" className="underline underline-offset-2">
              Política de Privacidade
            </a>
            .
          </li>
        </ul>
      </Card>

      <ConfirmDeletionDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        plan={plan}
        email={profile?.email ?? user?.email ?? ""}
        onDone={() => void logout()}
      />
    </div>
  );
}

/**
 * Deleting an account needs the password again.
 *
 * Firebase requires a recent sign-in for `deleteUser`, and asking for it also
 * makes the action deliberate: nobody deletes their finances by mis-clicking.
 */
function ConfirmDeletionDialog({
  open,
  onClose,
  plan,
  email,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  plan: DeletionPlan;
  email: string;
  onDone: () => void;
}) {
  const { user } = useSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const CONFIRM_WORD = "EXCLUIR";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!user) return;
    if (confirmation.trim().toUpperCase() !== CONFIRM_WORD) {
      setError(`Digite ${CONFIRM_WORD} para confirmar.`);
      return;
    }
    if (!password) {
      setError("Informe sua senha.");
      return;
    }

    setWorking(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password));

      const result = await deleteAccountData({ db: getDb(), uid: user.uid, plan });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      await deleteUser(getAuthClient().currentUser!);
      onDone();
    } catch (deleteError) {
      setError(authErrorMessage(deleteError));
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Excluir minha conta"
      description="Seus dados serão apagados e não há como recuperá-los."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <Callout tone="critical">
          {plan.entries.filter((entry) => entry.kind === "DELETE_HOUSEHOLD").length > 0
            ? "Os grupos em que você está sozinho serão apagados com todos os dados financeiros."
            : "Sua conta e seu perfil serão apagados."}
        </Callout>

        <TextField
          label="Sua senha"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Pedimos de novo por segurança."
        />

        <TextField
          label={`Digite ${CONFIRM_WORD} para confirmar`}
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="danger" className="flex-1" disabled={working}>
            {working ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
