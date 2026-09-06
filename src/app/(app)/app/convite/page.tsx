"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { Button, Callout, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { getAuthClient, getDb } from "@/lib/firebase/client";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/modules/household/domain/household";
import { acceptInvite, type AcceptInviteProblem } from "@/modules/household/application/invites";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * Aceitar um convite.
 *
 * O caminho antigo tinha três telas, dois aparelhos e um código de 28
 * caracteres voltando do convidado para quem convidou. Aqui a pessoa abre o
 * link, confere quem a chamou e com que papel, e entra.
 *
 * A confirmação de e-mail aparece nesta tela por necessidade, não por
 * burocracia: é ela que prova que o convite era mesmo para quem está
 * clicando, e as Security Rules recusam a entrada sem ela.
 */
export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile, status, refreshProfile } = useSession();

  const householdId = params.get("grupo") ?? "";

  const [groupName, setGroupName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AcceptInviteProblem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  if (status === "loading") return <Spinner label="Carregando" />;

  if (!householdId) {
    return (
      <Card>
        <CardTitle>Convite incompleto</CardTitle>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
          Este link não diz de qual grupo é o convite. Peça a quem convidou para enviar o link
          completo.
        </p>
      </Card>
    );
  }

  const emailVerified = user?.emailVerified ?? false;

  // Só quem tem convite válido consegue ler o household — a regra permite
  // exatamente para isto. Falhar é informação: significa que não há convite
  // para este e-mail, e a tela diz isso em vez de um erro genérico.
  if (householdId && groupName === null && emailVerified) {
    void (async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const snapshot = await getDoc(doc(getDb(), `households/${householdId}`));
        setGroupName(snapshot.exists() ? ((snapshot.data().name as string) ?? "") : "");
      } catch {
        setGroupName("");
      }
    })();
  }

  /**
   * Recarrega o usuário e força um token novo.
   *
   * Confirmar o e-mail não altera o token que já está no navegador — ele foi
   * emitido antes, com `email_verified: false`, e vale uma hora. O SDK passa a
   * dizer `emailVerified: true` depois de `reload()`, mas as Security Rules
   * leem o **token**, não o SDK: sem `getIdToken(true)` a tela mostra
   * "confirmado" e o Firestore recusa a escrita.
   *
   * É o tipo de descompasso que só aparece testando o caminho inteiro.
   */
  async function refreshVerification() {
    const current = getAuthClient().currentUser;
    if (!current) return;
    setBusy(true);
    try {
      await current.reload();
      await current.getIdToken(true);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    const current = getAuthClient().currentUser;
    if (!current) return;
    setBusy(true);
    try {
      await sendEmailVerification(current);
      setVerificationSent(true);
    } catch {
      setMessage("Não foi possível enviar agora. Tente de novo em alguns minutos.");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!user?.email) return;
    setProblem(null);
    setMessage(null);
    setBusy(true);

    try {
      // Token novo antes de escrever. Quem confirmou o e-mail há pouco pode
      // ainda estar com o token antigo em mãos, e é ele que a regra lê.
      await getAuthClient().currentUser?.getIdToken(true);

      // Relê o household para pegar a lista de membros no estado atual: a
      // regra exige exatamente ela com o novo uid no fim, então uma cópia
      // velha faria a escrita ser recusada.
      const { doc, getDoc } = await import("firebase/firestore");
      const snapshot = await getDoc(doc(getDb(), `households/${householdId}`));
      if (!snapshot.exists()) {
        setMessage("Este grupo não existe mais.");
        return;
      }

      const result = await acceptInvite({
        db: getDb(),
        householdId,
        uid: user.uid,
        email: user.email,
        emailVerified,
        displayName: profile?.displayName ?? user.displayName ?? "Novo membro",
        currentMemberUids: (snapshot.data().memberUids ?? []) as string[],
      });

      if (!result.ok) {
        setProblem(result.error.code);
        setMessage(result.error.message);
        return;
      }

      await refreshProfile();
      router.replace("/app");
    } catch (error) {
      console.error(error);
      setMessage("Não foi possível entrar no grupo agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Convite para um grupo</h1>
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          {groupName
            ? `Você foi convidado para o grupo ${groupName}.`
            : "Você foi convidado a acompanhar as finanças de uma casa junto com quem já está lá."}
        </p>
      </div>

      {message ? (
        <Callout tone={problem === "EMAIL_NOT_VERIFIED" ? "attention" : "critical"}>
          {message}
        </Callout>
      ) : null}

      <Card>
        <CardTitle hint="Confira antes de entrar.">O que você vai poder fazer</CardTitle>

        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="font-medium">Seu e-mail</dt>
            <dd style={{ color: "var(--muted-fg)" }}>
              {user?.email ?? "—"}
              {emailVerified ? " · confirmado" : " · ainda não confirmado"}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Papel</dt>
            <dd style={{ color: "var(--muted-fg)" }}>
              O convite define. Cada papel aparece assim: {ROLE_LABELS.MEMBER} —{" "}
              {ROLE_DESCRIPTIONS.MEMBER}
            </dd>
          </div>
        </dl>

        {!emailVerified ? (
          <div className="mt-4 rounded-xl border border-[color:var(--tone-attention)] p-3">
            <p className="text-sm font-semibold">Confirme seu e-mail primeiro</p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
              É o que prova que este convite era para você, e não para alguém que digitou o seu
              endereço. Enviamos um link de confirmação; depois de clicar nele, recarregue esta
              página.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void resendVerification()} disabled={busy}>
                {verificationSent ? "Enviado" : "Enviar link de confirmação"}
              </Button>
              <Button variant="ghost" onClick={() => void refreshVerification()} disabled={busy}>
                Já confirmei
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--card-border)] pt-4">
          <Button onClick={() => void accept()} disabled={busy || !emailVerified}>
            {busy ? "Entrando…" : "Entrar no grupo"}
          </Button>
          <Link href="/app">
            <Button variant="secondary">Agora não</Button>
          </Link>
        </div>
      </Card>

      <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
        Entrar num grupo dá acesso a tudo que estiver nele: contas, dívidas, lançamentos e metas. Só
        aceite convites de pessoas que você conhece.
      </p>
    </div>
  );
}
