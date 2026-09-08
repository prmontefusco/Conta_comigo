"use client";

import { useEffect, useState } from "react";
import { deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { Badge, Button, Callout, Card, CardTitle } from "@/components/ui/primitives";
import { FormError, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { getAuthClient, getDb } from "@/lib/firebase/client";
import { instant } from "@/core/date/calendar-date";
import { randomId } from "@/core/id/id";
import { authErrorMessage } from "@/modules/auth/ui/auth-errors";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  deleteAccountData,
  exportUserData,
  planAccountDeletion,
  type DeletionPlan,
} from "@/modules/privacy/application/data-portability";
import type { FamilyMemberItem, FinancialGoal } from "@/modules/household/domain/household";

function formatCpf(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatCep(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export default function MyDataPage() {
  const { user, profile, households, logout, refreshProfile } = useSession();

  // Dados Pessoais
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [cpf, setCpf] = useState(profile?.cpf ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? "");
  const [occupation, setOccupation] = useState(profile?.occupation ?? "");

  // Endereço
  const [cep, setCep] = useState(profile?.address?.cep ?? "");
  const [street, setStreet] = useState(profile?.address?.street ?? "");
  const [number, setNumber] = useState(profile?.address?.number ?? "");
  const [complement, setComplement] = useState(profile?.address?.complement ?? "");
  const [neighborhood, setNeighborhood] = useState(profile?.address?.neighborhood ?? "");
  const [city, setCity] = useState(profile?.address?.city ?? "");
  const [state, setState] = useState(profile?.address?.state ?? "");
  const [searchingCep, setSearchingCep] = useState(false);

  // Composição Familiar
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberItem[]>(
    profile?.familyMembers ? [...profile.familyMembers] : [],
  );
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRelationship, setNewMemberRelationship] = useState("Cônjuge / Companheiro(a)");
  const [newMemberBirthDate, setNewMemberBirthDate] = useState("");
  const [newMemberIsDependent, setNewMemberIsDependent] = useState(true);

  // Objetivo do Aplicativo
  const [financialGoal, setFinancialGoal] = useState<FinancialGoal>(
    profile?.financialGoal ?? "ORGANIZATION",
  );

  // Estados de Salvar
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Estados de Exportação e Exclusão
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Sincroniza estados quando o perfil é carregado
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setCpf(profile.cpf ?? "");
      setPhone(profile.phone ?? "");
      setBirthDate(profile.birthDate ?? "");
      setOccupation(profile.occupation ?? "");
      setCep(profile.address?.cep ?? "");
      setStreet(profile.address?.street ?? "");
      setNumber(profile.address?.number ?? "");
      setComplement(profile.address?.complement ?? "");
      setNeighborhood(profile.address?.neighborhood ?? "");
      setCity(profile.address?.city ?? "");
      setState(profile.address?.state ?? "");
      if (profile.familyMembers) {
        setFamilyMembers([...profile.familyMembers]);
      }
      if (profile.financialGoal) {
        setFinancialGoal(profile.financialGoal);
      }
    }
  }, [profile]);

  async function handleCepLookup(rawCep: string) {
    const cleanCep = rawCep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
        }
      }
    } catch (e) {
      console.error("Erro ao buscar CEP:", e);
    } finally {
      setSearchingCep(false);
    }
  }

  function handleAddFamilyMember() {
    if (!newMemberName.trim()) return;
    const member: FamilyMemberItem = {
      id: randomId(),
      name: newMemberName.trim(),
      relationship: newMemberRelationship,
      birthDate: newMemberBirthDate.trim() || undefined,
      isDependent: newMemberIsDependent,
    };
    setFamilyMembers((prev) => [...prev, member]);
    setNewMemberName("");
    setNewMemberBirthDate("");
    setNewMemberIsDependent(true);
  }

  function handleRemoveFamilyMember(id: string) {
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const db = getDb();
      await updateDoc(doc(db, "users", user.uid), {
        displayName: displayName.trim() || profile?.displayName || "Usuário",
        cpf: cpf.trim(),
        phone: phone.trim(),
        birthDate: birthDate.trim(),
        occupation: occupation.trim(),
        address: {
          cep: cep.trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim(),
        },
        familyMembers,
        financialGoal,
        updatedAt: instant(),
      });
      await refreshProfile();
      setSaveSuccess(true);
    } catch (err) {
      console.error("Erro ao salvar dados cadastrais:", err);
      setSaveError("Não foi possível salvar suas informações agora. Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  }

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Meus Dados & Perfil Familiar</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
          Mantenha seus dados cadastrais, endereço e grupo familiar atualizados. Estas informações
          são usadas para qualificação no Dossiê de Superendividamento, Mínimo Existencial e futuros
          relatórios contábeis.
        </p>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {saveError ? <FormError>{saveError}</FormError> : null}
        {saveSuccess ? (
          <p
            role="status"
            className="rounded-lg border-l-4 border-[color:var(--color-positive-600)] bg-[color:var(--color-positive-100)] p-3 text-sm text-[color:var(--color-ink-900)]"
          >
            ✓ Dados cadastrais salvos com sucesso!
          </p>
        ) : null}

        {/* 1. DADOS PESSOAIS */}
        <Card>
          <CardTitle hint="Informações básicas do titular da conta">1. Dados Pessoais</CardTitle>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Nome Completo"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome completo"
            />

            <TextField
              label="CPF"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              hint="Necessário para emissão formal de relatórios e acordos"
            />

            <TextField
              label="Telefone / WhatsApp"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
            />

            <TextField
              label="Data de Nascimento"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />

            <div className="sm:col-span-2">
              <TextField
                label="Ocupação / Profissão"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Ex.: Servidor Público, Autônomo, Aposentado, CLT"
              />
            </div>
          </div>
        </Card>

        {/* 2. ENDEREÇO RESIDENCIAL */}
        <Card>
          <CardTitle hint="Endereço da residência familiar para comprovação de mínimo existencial e domicílio">
            2. Endereço Residencial
          </CardTitle>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <TextField
                label="CEP"
                value={cep}
                onChange={(e) => {
                  const val = formatCep(e.target.value);
                  setCep(val);
                  if (val.replace(/\D/g, "").length === 8) {
                    void handleCepLookup(val);
                  }
                }}
                placeholder="00000-000"
                hint={searchingCep ? "Buscando endereço…" : "Preencha para autocompletar"}
              />
            </div>

            <div className="sm:col-span-4">
              <TextField
                label="Logradouro (Rua / Avenida)"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Ex.: Rua das Flores"
              />
            </div>

            <div className="sm:col-span-2">
              <TextField
                label="Número"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex.: 123"
              />
            </div>

            <div className="sm:col-span-4">
              <TextField
                label="Complemento"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Apto 42, Bloco B (opcional)"
              />
            </div>

            <div className="sm:col-span-2">
              <TextField
                label="Bairro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex.: Centro"
              />
            </div>

            <div className="sm:col-span-3">
              <TextField
                label="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex.: São Paulo"
              />
            </div>

            <div className="sm:col-span-1">
              <TextField
                label="UF"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
              />
            </div>
          </div>
        </Card>

        {/* 3. COMPOSIÇÃO FAMILIAR & DEPENDENTES */}
        <Card>
          <CardTitle hint="Pessoas que compõem sua família e dependem financeiramente do mesmo orçamento">
            3. Membros Familiares & Dependentes
          </CardTitle>

          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            O número e os dados dos dependentes são essenciais para o cálculo do{" "}
            <strong>Mínimo Existencial Legal</strong> (Decreto nº 11.567/2023) e para demonstrar que
            o salário da família não pode ser confiscado por parcelas de empréstimos.
          </p>

          {familyMembers.length > 0 ? (
            <div className="mt-4 divide-y divide-[color:var(--card-border)] rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)]">
              {familyMembers.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-[color:var(--page-fg)]">{member.name}</p>
                    <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                      {member.relationship} {member.birthDate ? `· Nasc: ${member.birthDate}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.isDependent ? (
                      <Badge tone="positive">Dependente Financeiro</Badge>
                    ) : (
                      <Badge tone="neutral">Membro Familiar</Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFamilyMember(member.id)}
                      className="cursor-pointer text-xs font-semibold text-[color:var(--tone-critical)] hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3 text-xs text-[color:var(--muted-fg)]">
              Nenhum familiar cadastrado ainda. Adicione cônjuges, filhos ou pais dependentes abaixo.
            </p>
          )}

          {/* Adicionar Novo Familiar */}
          <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--page-fg)]">
              + Adicionar Membro da Família
            </h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <TextField
                  label="Nome do familiar"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Nome completo do familiar"
                />
              </div>

              <div className="sm:col-span-4">
                <SelectField
                  label="Grau de Parentesco"
                  value={newMemberRelationship}
                  onChange={(e) => setNewMemberRelationship(e.target.value)}
                  options={[
                    { value: "Cônjuge / Companheiro(a)", label: "Cônjuge / Companheiro(a)" },
                    { value: "Filho(a)", label: "Filho(a)" },
                    { value: "Enteado(a)", label: "Enteado(a)" },
                    { value: "Pai / Mãe", label: "Pai / Mãe" },
                    { value: "Irmão(ã)", label: "Irmão(ã)" },
                    { value: "Outro Dependente", label: "Outro Dependente" },
                  ]}
                />
              </div>

              <div className="sm:col-span-3">
                <TextField
                  label="Data Nasc. (opcional)"
                  type="date"
                  value={newMemberBirthDate}
                  onChange={(e) => setNewMemberBirthDate(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMemberIsDependent}
                  onChange={(e) => setNewMemberIsDependent(e.target.checked)}
                  className="size-4 rounded border-[color:var(--card-border)] text-[color:var(--color-brand-600)]"
                />
                Dependente financeiro direto (custos pagos pelo titular)
              </label>

              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                onClick={handleAddFamilyMember}
              >
                + Incluir no Grupo Familiar
              </Button>
            </div>
          </div>
        </Card>

        {/* 4. OBJETIVO DO APLICATIVO */}
        <Card>
          <CardTitle hint="Define quais módulos e assistentes têm maior destaque para você">
            4. Objetivo Principal de Uso
          </CardTitle>

          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            Você pode escolher em que o Conta Comigo deve focar para ajudar sua família neste momento:
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label
              className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition ${
                financialGoal === "ORGANIZATION"
                  ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-50)]/40 dark:bg-[color:var(--color-brand-950)]/20 shadow-xs"
                  : "border-[color:var(--card-border)] bg-[color:var(--card-bg)] hover:bg-[color:var(--color-ink-50)]"
              }`}
            >
              <div>
                <input
                  type="radio"
                  name="goal"
                  value="ORGANIZATION"
                  checked={financialGoal === "ORGANIZATION"}
                  onChange={() => setFinancialGoal("ORGANIZATION")}
                  className="sr-only"
                />
                <span className="text-2xl">📊</span>
                <p className="mt-2 text-sm font-bold text-[color:var(--page-fg)]">
                  Organização & Gestão Familiar
                </p>
                <p className="mt-1 text-2xs" style={{ color: "var(--muted-fg)" }}>
                  Acompanhar contas do mês, cartões e projetar se vai sobrar dinheiro nos próximos meses.
                </p>
              </div>
              <span className="mt-3 text-2xs font-semibold text-[color:var(--color-brand-700)]">
                {financialGoal === "ORGANIZATION" ? "✓ Selecionado" : "Selecionar"}
              </span>
            </label>

            <label
              className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition ${
                financialGoal === "SUPERENDIVIDAMENTO"
                  ? "border-[color:var(--color-critical-600)] bg-[color:var(--color-critical-50)]/40 dark:bg-[color:var(--color-critical-950)]/20 shadow-xs"
                  : "border-[color:var(--card-border)] bg-[color:var(--card-bg)] hover:bg-[color:var(--color-ink-50)]"
              }`}
            >
              <div>
                <input
                  type="radio"
                  name="goal"
                  value="SUPERENDIVIDAMENTO"
                  checked={financialGoal === "SUPERENDIVIDAMENTO"}
                  onChange={() => setFinancialGoal("SUPERENDIVIDAMENTO")}
                  className="sr-only"
                />
                <span className="text-2xl">⚖️</span>
                <p className="mt-2 text-sm font-bold text-[color:var(--page-fg)]">
                  Recuperação & Superendividamento
                </p>
                <p className="mt-1 text-2xs" style={{ color: "var(--muted-fg)" }}>
                  Repactuar dívidas onerosas pela Lei 14.181/2021, proteger o mínimo existencial e gerar dossiê.
                </p>
              </div>
              <span className="mt-3 text-2xs font-semibold text-[color:var(--color-critical-700)]">
                {financialGoal === "SUPERENDIVIDAMENTO" ? "✓ Selecionado" : "Selecionar"}
              </span>
            </label>

            <label
              className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition ${
                financialGoal === "INVESTMENT"
                  ? "border-[color:var(--color-positive-600)] bg-[color:var(--color-positive-50)]/40 dark:bg-[color:var(--color-positive-950)]/20 shadow-xs"
                  : "border-[color:var(--card-border)] bg-[color:var(--card-bg)] hover:bg-[color:var(--color-ink-50)]"
              }`}
            >
              <div>
                <input
                  type="radio"
                  name="goal"
                  value="INVESTMENT"
                  checked={financialGoal === "INVESTMENT"}
                  onChange={() => setFinancialGoal("INVESTMENT")}
                  className="sr-only"
                />
                <span className="text-2xl">🛡️</span>
                <p className="mt-2 text-sm font-bold text-[color:var(--page-fg)]">
                  Reserva & Independência
                </p>
                <p className="mt-1 text-2xs" style={{ color: "var(--muted-fg)" }}>
                  Construir colchão de segurança de 6 meses e maximizar sobra mensal para o futuro.
                </p>
              </div>
              <span className="mt-3 text-2xs font-semibold text-[color:var(--color-positive-700)]">
                {financialGoal === "INVESTMENT" ? "✓ Selecionado" : "Selecionar"}
              </span>
            </label>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={savingProfile} className="min-w-44 font-semibold">
            {savingProfile ? "Salvando…" : "Salvar Dados Cadastrais"}
          </Button>
        </div>
      </form>

      {/* 5. PORTABILIDADE & EXCLUSÃO (LGPD) */}
      <Card aria-labelledby="exportar-title">
        <CardTitle
          id="exportar-title"
          hint="Um arquivo JSON com tudo o que você pode ver hoje no aplicativo."
        >
          Levar meus dados (Portabilidade LGPD)
        </CardTitle>

        {exportError ? <FormError>{exportError}</FormError> : null}

        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Inclui seu perfil, dados cadastrais, grupos, contas, movimentações, cartões, compras,
          dívidas e regras de recorrência em formato padrão aberto.
        </p>

        <Button className="mt-4" onClick={() => void onExport()} disabled={exporting}>
          {exporting ? "Preparando…" : "Baixar meus dados (JSON)"}
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
