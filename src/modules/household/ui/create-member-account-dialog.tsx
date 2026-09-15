"use client";

import { useState } from "react";
import { Button, Callout } from "@/components/ui/primitives";
import { FormError, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getAuthClient } from "@/lib/firebase/client";
import { canAddOne } from "@/modules/billing/domain/plan-limits";
import { createMemberAccount, type CreatedMemberAccount } from "../application/create-member-account";
import { useMembers } from "./use-members";
import { useSession } from "./session-provider";
import type { HouseholdRole } from "@/modules/shared/domain/common";

/**
 * Adicionar alguém ao grupo sem que ela precise criar a própria conta.
 *
 * O caminho mais comum numa casa é o cônjuge ou o filho: alguém que o
 * administrador já conhece e para quem faz sentido só entregar um login
 * pronto, em vez de pedir "crie sua conta, depois volte aqui e copie um
 * código". A senha é gerada aqui, mostrada uma única vez, e nunca gravada —
 * se ela se perder, a única saída é trocar a senha da conta depois.
 */
export function CreateMemberAccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { household, user, effectivePlan } = useSession();
  const { active } = useMembers();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<HouseholdRole, "OWNER" | "DEPENDENT">>("MEMBER");
  const [result, setResult] = useState<CreatedMemberAccount | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setRole("MEMBER");
    setResult(null);
    setCopied(false);
    setError(null);
    setSaving(false);
  }

  function close() {
    reset();
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

    const idToken = await getAuthClient().currentUser?.getIdToken();
    if (!idToken) {
      setError("Sua sessão expirou. Entre novamente.");
      return;
    }

    setSaving(true);
    const outcome = await createMemberAccount({
      idToken,
      householdId: household.id,
      name,
      email,
      role,
    });
    setSaving(false);

    if (!outcome.ok) {
      setError(outcome.error.message);
      return;
    }

    setResult(outcome.value);
  }

  const credentialsText = result
    ? `Oi${name.trim() ? `, ${name.trim()}` : ""}! Já criei seu acesso no Conta comigo, nosso painel de finanças da família.\n\n` +
      `Acesse https://contacomigo.app/entrar com:\n` +
      `E-mail: ${result.email}\n` +
      `Senha: ${result.password}\n\n` +
      `No primeiro acesso, será pedido para trocar essa senha por uma de sua escolha.`
    : "";

  return (
    <Modal
      open={open}
      onClose={close}
      title="Adicionar membro"
      description="Você cria o acesso; a pessoa só entra com o que você mandar. Sem cadastro, sem código para copiar."
    >
      {result ? (
        <div className="space-y-4">
          <Callout tone="positive">
            Conta criada para <strong>{name}</strong>. Repasse os dados abaixo — eles não ficam
            salvos em nenhum outro lugar.
          </Callout>

          <div>
            <p className="text-2xs font-semibold tracking-wider uppercase">Mensagem pronta</p>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-[color:var(--card-border)] p-3 text-xs whitespace-pre-wrap">
              {credentialsText}
            </pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                window.open(`https://wa.me/?text=${encodeURIComponent(credentialsText)}`, "_blank");
              }}
            >
              💬 Enviar pelo WhatsApp
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(credentialsText);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copiado" : "Copiar mensagem"}
            </Button>
          </div>

          <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
            A senha só aparece aqui, agora. Se não copiar a tempo, será preciso trocar a senha da
            conta depois.
          </p>

          <Button onClick={close} className="w-full">
            Pronto
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <FormError>{error}</FormError> : null}

          <TextField
            label="Nome da pessoa"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Maria"
          />

          <TextField
            label="E-mail dela"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@exemplo.com"
            hint="Só para o login dela — não precisa ser o e-mail que ela mais usa."
          />

          <SelectField
            label="O que ela vai poder fazer"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as Exclude<HouseholdRole, "OWNER" | "DEPENDENT">)
            }
            options={[
              { value: "MEMBER", label: "Membro — registra e edita informações" },
              { value: "OPERATOR", label: "Operador — lança gastos do dia a dia, sem excluir nada" },
              { value: "ADMIN", label: "Administrador — também gerencia o grupo" },
              { value: "VIEWER", label: "Visualizador — só vê, não altera" },
            ]}
          />

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Criando…" : "Criar acesso"}
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
