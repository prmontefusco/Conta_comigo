"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { FormError, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getDb } from "@/lib/firebase/client";
import { addMemberByUid } from "../application/manage-members";
import { canAddOne } from "@/modules/billing/domain/plan-limits";
import { useMembers } from "./use-members";
import { useSession } from "./session-provider";
import type { HouseholdRole } from "@/modules/shared/domain/common";

export type RelationshipType = "SPOUSE" | "CHILD" | "PARENT" | "OTHER";

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  SPOUSE: "Cônjuge (Marido / Esposa)",
  CHILD: "Filho(a)",
  PARENT: "Pai / Mãe",
  OTHER: "Outro membro da família",
};

export function InviteFamilyModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { household, user, effectivePlan } = useSession();
  const { active } = useMembers();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<RelationshipType>("SPOUSE");
  const [role, setRole] = useState<Exclude<HouseholdRole, "OWNER">>("MEMBER");
  const [identifier, setIdentifier] = useState("");
  const [step, setStep] = useState<"FORM" | "SUCCESS">("FORM");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setRelationship("SPOUSE");
    setRole("MEMBER");
    setIdentifier("");
    setStep("FORM");
    setError(null);
    setCopied(false);
    setSaving(false);
  }

  // Sem tratamento afetuoso por padrão: o mesmo modal convida cônjuge, filho e
  // mãe, e "Oi, amor" para a própria mãe é constrangedor. E sem prometer que o
  // perfil "já está reservado" — nada é criado até o código chegar.
  const generatedInviteMessage =
    `Oi${name.trim() ? `, ${name.trim()}` : ""}! Criei nosso grupo no Conta comigo para a gente organizar as contas da casa juntos e acompanhar os mesmos números.\n\n` +
    `1. Acesse https://contacomigo.app/criar-conta e crie sua conta com o seu e-mail.\n` +
    `2. Depois de entrar, vá em Mais > Membros e copie o código que aparece em "Seu identificador".\n` +
    `3. Me mande esse código e eu incluo você no grupo como ${RELATIONSHIP_LABELS[relationship]}.`;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Informe o nome do familiar.");
      return;
    }

    // Se o usuário forneceu o identificador da outra pessoa, adiciona diretamente
    if (identifier.trim()) {
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
      const db = getDb();
      const result = await addMemberByUid({
        db,
        householdId: household.id,
        actorUid: user.uid,
        uid: identifier.trim(),
        displayName: `${name.trim()} (${RELATIONSHIP_LABELS[relationship].split(" ")[0]})`,
        role,
      });
      setSaving(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onSuccess?.();
      onClose();
      reset();
      return;
    }

    // Se não tem identificador ainda, avança para o passo de envio do convite pelo WhatsApp
    setStep("SUCCESS");
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Cadastrar Familiar (Cônjuge / Filhos)"
    >
      {step === "FORM" ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Adicione as pessoas da sua casa para que todos possam lançar despesas, cupons de mercado
            e acompanhar as metas da família diretamente pelo smartphone.
          </p>

          <FormError>{error}</FormError>

          <TextField
            label="Nome da pessoa"
            placeholder="Ex: Carlos, Ana, Lucas"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <SelectField
            label="Parentesco"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as RelationshipType)}
            options={[
              { value: "SPOUSE", label: RELATIONSHIP_LABELS.SPOUSE },
              { value: "CHILD", label: RELATIONSHIP_LABELS.CHILD },
              { value: "PARENT", label: RELATIONSHIP_LABELS.PARENT },
              { value: "OTHER", label: RELATIONSHIP_LABELS.OTHER },
            ]}
          />

          <SelectField
            label="O que essa pessoa poderá fazer?"
            value={role}
            onChange={(e) => setRole(e.target.value as Exclude<HouseholdRole, "OWNER">)}
            options={[
              { value: "MEMBER", label: "Pode lançar compras, contas e editar dados (Membro)" },
              { value: "VIEWER", label: "Apenas visualizar os números e metas (Sem editar)" },
              { value: "ADMIN", label: "Administrador completo (Pode convidar outros)" },
            ]}
          />

          <TextField
            label="Código do identificador (se a pessoa já tiver conta)"
            placeholder="Opcional se for enviar convite agora"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            hint="Se a pessoa já criou a conta, cole o código dela aqui para entrar na hora. Se ainda não criou, deixe em branco e envie o convite a seguir."
          />

          <div className="mt-4 flex justify-end gap-2 border-t border-[color:var(--card-border)] pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                reset();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Salvando..."
                : identifier.trim()
                  ? "Adicionar Agora"
                  : "Continuar para Convite →"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="animate-in fade-in space-y-4 duration-200">
          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-4 text-center">
            <span className="text-3xl">💬</span>
            <h4 className="mt-2 text-sm font-bold text-[color:var(--page-fg)]">
              Perfil preparado para {name}!
            </h4>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
              Envie a mensagem de convite para {name} acessar pelo celular:
            </p>
          </div>

          <pre className="overflow-x-auto rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3 text-xs whitespace-pre-wrap">
            {generatedInviteMessage}
          </pre>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const encoded = encodeURIComponent(generatedInviteMessage);
                window.open(`https://wa.me/?text=${encoded}`, "_blank");
              }}
              className="flex-1"
            >
              💬 Enviar Convite pelo WhatsApp
            </Button>

            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generatedInviteMessage);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>

          <p className="text-center text-xs" style={{ color: "var(--muted-fg)" }}>
            Assim que {name} te passar o código do perfil, basta clicar em &ldquo;Adicionar
            pessoa&rdquo; e colar aqui.
          </p>

          <div className="mt-4 flex justify-end border-t border-[color:var(--card-border)] pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                reset();
              }}
            >
              Concluir
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
