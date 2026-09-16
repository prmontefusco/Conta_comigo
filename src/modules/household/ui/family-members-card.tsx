"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { Badge, Button, Card, CardTitle } from "@/components/ui/primitives";
import { FormError, SelectField, TextField } from "@/components/ui/form";
import { instant } from "@/core/date/calendar-date";
import { randomId } from "@/core/id/id";
import { getDb } from "@/lib/firebase/client";
import type { FamilyMemberItem } from "@/modules/household/domain/household";
import { useSession } from "./session-provider";

/** Family composition belongs to the person's profile, not to login permissions. */
export function FamilyMembersCard() {
  const { user, profile, refreshProfile } = useSession();
  const members = profile?.familyMembers ?? [];
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Cônjuge / Companheiro(a)");
  const [birthDate, setBirthDate] = useState("");
  const [isDependent, setIsDependent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);

  async function save(next: FamilyMemberItem[]) {
    if (!user || !profile) return false;
    setBusy(true);
    setError(null);
    try {
      await updateDoc(doc(getDb(), "users", user.uid), {
        familyMembers: next,
        updatedAt: instant(),
      });
      await refreshProfile();
      return true;
    } catch {
      setError("Não foi possível salvar os familiares. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 120) {
      setError("Informe um nome de até 120 caracteres.");
      return;
    }
    const member: FamilyMemberItem = {
      id: randomId(),
      name: trimmedName,
      relationship,
      ...(birthDate ? { birthDate } : {}),
      isDependent,
    };
    if (await save([...members, member])) {
      setName("");
      setBirthDate("");
      setIsDependent(true);
    }
  }

  return (
    <Card>
      <CardTitle hint="Pessoas consideradas no seu planejamento financeiro">
        Familiares e dependentes
      </CardTitle>
      <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
        Cadastre quem compõe o seu orçamento. Dependentes ajudam a estimar as necessidades da
        família; este cadastro não dá acesso ao aplicativo nem cria uma conta para a pessoa.
      </p>

      {error ? (
        <div className="mt-3">
          <FormError>{error}</FormError>
        </div>
      ) : null}
      {members.length ? (
        <ul className="mt-4 divide-y divide-[color:var(--card-border)] rounded-xl border border-[color:var(--card-border)]">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
            >
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                  {member.relationship}
                  {member.birthDate ? ` · Nasc: ${member.birthDate}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={member.isDependent ? "positive" : "neutral"}>
                  {member.isDependent ? "Dependente financeiro" : "Familiar"}
                </Badge>
                {confirmingRemoval === member.id ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        if (await save(members.filter((item) => item.id !== member.id)))
                          setConfirmingRemoval(null);
                      }}
                    >
                      Confirmar remoção
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmingRemoval(null)}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmingRemoval(member.id)}
                  >
                    Remover
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className="mt-3 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3 text-xs"
          style={{ color: "var(--muted-fg)" }}
        >
          Nenhum familiar cadastrado ainda.
        </p>
      )}

      <form
        onSubmit={(event) => void add(event)}
        className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-4"
      >
        <h3 className="text-xs font-bold tracking-wider uppercase">Adicionar familiar</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <TextField
            label="Nome do familiar"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome completo"
          />
          <SelectField
            label="Grau de parentesco"
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            options={[
              { value: "Cônjuge / Companheiro(a)", label: "Cônjuge / Companheiro(a)" },
              { value: "Filho(a)", label: "Filho(a)" },
              { value: "Enteado(a)", label: "Enteado(a)" },
              { value: "Pai / Mãe", label: "Pai / Mãe" },
              { value: "Irmão(ã)", label: "Irmão(ã)" },
              { value: "Outro Dependente", label: "Outro Dependente" },
            ]}
          />
          <TextField
            label="Data de nascimento (opcional)"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={isDependent}
              onChange={(event) => setIsDependent(event.target.checked)}
              className="size-4"
            />
            Dependente financeiro direto
          </label>
          <Button type="submit" variant="secondary" disabled={busy || !profile}>
            {busy ? "Salvando…" : "Incluir familiar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
