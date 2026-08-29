"use client";

import { useState } from "react";
import { fromDecimalString } from "@/core/money/money";
import { Button } from "@/components/ui/primitives";
import { FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

export function NewCardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household } = useSession();
  const collections = useCollections();

  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [limitText, setLimitText] = useState("");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay, setDueDay] = useState("5");
  const [visibility, setVisibility] = useState("HOUSEHOLD");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    const creditLimit = fromDecimalString(limitText);
    if (!creditLimit || creditLimit.amount < 0) {
      setError("Informe o limite do cartão.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Dê um nome ao cartão.");
      return;
    }

    const closing = Number(closingDay);
    const due = Number(dueDay);
    if (!Number.isInteger(closing) || closing < 1 || closing > 31) {
      setError("O dia de fechamento precisa estar entre 1 e 31.");
      return;
    }
    if (!Number.isInteger(due) || due < 1 || due > 31) {
      setError("O dia de vencimento precisa estar entre 1 e 31.");
      return;
    }

    setSaving(true);
    try {
      await collections.creditCards.create({
        householdId: household.id,
        name: name.trim(),
        issuer: issuer.trim() || undefined,
        creditLimit,
        closingDay: closing,
        dueDay: due,
        visibility: visibility as never,
        archived: false,
      } as never);
      setName("");
      setLimitText("");
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo cartão"
      description="As datas de fechamento e vencimento definem em qual fatura cada compra entra."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <TextField
          label="Nome do cartão"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Cartão principal"
        />

        <TextField
          label="Banco ou emissor"
          value={issuer}
          onChange={(event) => setIssuer(event.target.value)}
          placeholder="Opcional"
        />

        <MoneyField
          label="Limite"
          required
          value={limitText}
          onChange={(event) => setLimitText(event.target.value)}
          placeholder="0,00"
        />

        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Dia de fechamento"
            type="number"
            min={1}
            max={31}
            required
            value={closingDay}
            onChange={(event) => setClosingDay(event.target.value)}
            hint="Compras após esse dia entram na próxima fatura."
          />
          <TextField
            label="Dia de vencimento"
            type="number"
            min={1}
            max={31}
            required
            value={dueDay}
            onChange={(event) => setDueDay(event.target.value)}
            hint="Se for menor que o fechamento, vence no mês seguinte."
          />
        </div>

        <SelectField
          label="De quem é"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          options={[
            { value: "HOUSEHOLD", label: "Do grupo" },
            { value: "PERSONAL", label: "Pessoal" },
          ]}
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
