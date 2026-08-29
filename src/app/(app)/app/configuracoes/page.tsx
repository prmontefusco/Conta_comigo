"use client";

import Link from "next/link";
import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { instant } from "@/core/date/calendar-date";
import { Button, Callout, Card, CardTitle } from "@/components/ui/primitives";
import { FormError, SelectField, TextField } from "@/components/ui/form";
import { getDb } from "@/lib/firebase/client";
import { useSession } from "@/modules/household/ui/session-provider";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Cuiaba",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Rio_Branco",
  "America/Noronha",
] as const;

/**
 * Household settings.
 *
 * The timezone matters more than it looks: it decides which day "today" is,
 * and therefore whether a bill due today is reported as overdue.
 */
export default function SettingsPage() {
  const { household, canAdminister } = useSession();

  const [name, setName] = useState(household?.name ?? "");
  const [timezone, setTimezone] = useState(household?.settings.timezone ?? "America/Sao_Paulo");
  const [strategy, setStrategy] = useState(
    household?.settings.cardCompetenceStrategy ?? "PURCHASE_DATE",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!household) return null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (!household) return;
    if (name.trim().length < 2) {
      setError("Dê um nome ao grupo.");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(getDb(), "households", household.id), {
        name: name.trim(),
        settings: { ...household.settings, timezone, cardCompetenceStrategy: strategy },
        updatedAt: instant(),
      });
      setSaved(true);
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Configurações</h1>

      <Card>
        <CardTitle>Grupo</CardTitle>

        {!canAdminister ? (
          <Callout tone="info">
            Apenas quem administra o grupo pode alterar estas configurações.
          </Callout>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <FormError>{error}</FormError> : null}
          {saved ? (
            <p
              role="status"
              className="rounded-lg border-l-4 border-[color:var(--color-positive-600)] bg-[color:var(--color-positive-100)] p-3 text-sm text-[color:var(--color-ink-900)]"
            >
              Configurações salvas.
            </p>
          ) : null}

          <TextField
            label="Nome do grupo"
            required
            disabled={!canAdminister}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <SelectField
            label="Fuso horário"
            disabled={!canAdminister}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            hint="Define qual dia é 'hoje' para vencimentos e contas em atraso."
            options={TIMEZONES.map((value) => ({ value, label: value.replace("America/", "") }))}
          />

          <SelectField
            label="Mês de uma compra no cartão"
            disabled={!canAdminister}
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as typeof strategy)}
            hint="Vale apenas para compras novas. Compras já registradas mantêm o mês com que foram salvas."
            options={[
              { value: "PURCHASE_DATE", label: "Mês em que a compra foi feita" },
              { value: "STATEMENT_MONTH", label: "Mês da fatura" },
            ]}
          />

          {canAdminister ? (
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          ) : null}
        </form>
      </Card>

      <Card>
        <CardTitle>Seus dados</CardTitle>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Você pode baixar ou excluir seus dados a qualquer momento, sem pedir autorização a
          ninguém. Nenhuma informação financeira sua é usada para publicidade. Detalhes na{" "}
          <a href="/privacidade" className="underline underline-offset-2">
            Política de Privacidade
          </a>
          .
        </p>

        <Link href="/app/meus-dados" className="mt-4 inline-block">
          <Button variant="secondary">Meus dados</Button>
        </Link>
      </Card>
    </div>
  );
}
