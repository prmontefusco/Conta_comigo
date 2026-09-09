"use client";

import { useEffect, useState } from "react";
import { fromDecimalString } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { canAddOne } from "@/modules/billing/domain/plan-limits";
import type { CreditCard } from "@/modules/cards/domain/credit-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { MemberField } from "@/modules/household/ui/member-field";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Cadastrar ou corrigir um cartão.
 *
 * Fechamento e vencimento não são detalhe de cadastro: são eles que decidem em
 * qual fatura cada compra cai. Um dia de fechamento errado joga meio mês de
 * compras para a fatura seguinte, e a projeção passa a cobrar no mês errado —
 * por isso corrigir precisa estar aqui, e não em um suporte por e-mail.
 */
export function NewCardDialog({
  open,
  card = null,
  onClose,
}: {
  open: boolean;
  /** O cartão sendo corrigido, quando houver. */
  card?: CreditCard | null;
  onClose: () => void;
}) {
  const { household, effectivePlan, canAdminister } = useSession();
  const finance = useFinance();
  const collections = useCollections();

  const editing = card !== null;

  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [limitText, setLimitText] = useState("");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay, setDueDay] = useState("5");
  const [visibility, setVisibility] = useState("HOUSEHOLD");
  const [holderMemberId, setHolderMemberId] = useState("");
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Abrir o diálogo é o que traz os dados: sem isto, corrigir um cartão depois
  // de outro mostraria os números do anterior.
  useEffect(() => {
    if (!open) return;

    setError(null);
    setConfirmingDelete(false);

    if (!card) {
      setName("");
      setIssuer("");
      setLimitText("");
      setClosingDay("25");
      setDueDay("5");
      setVisibility("HOUSEHOLD");
      setHolderMemberId("");
      setArchived(false);
      return;
    }

    setName(card.name);
    setIssuer(card.issuer ?? "");
    setLimitText((card.creditLimit.amount / 100).toFixed(2).replace(".", ","));
    setClosingDay(String(card.closingDay));
    setDueDay(String(card.dueDay));
    setVisibility(card.visibility);
    setHolderMemberId(card.holderMemberId ?? "");
    setArchived(card.archived);
  }, [open, card]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    // O teto do plano é checado antes de qualquer validação de formulário: não
    // faz sentido pedir para alguém corrigir um campo de um cartão que não vai
    // caber de qualquer jeito. Só vale para cartão novo — corrigir um cartão
    // que já existe não aumenta a contagem.
    if (!card) {
      const room = canAddOne("creditCards", effectivePlan, finance.cards.length);
      if (!room.allowed) {
        setError(room.message);
        return;
      }
    }

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
      const fields = {
        name: name.trim(),
        issuer: issuer.trim() || undefined,
        creditLimit,
        closingDay: closing,
        dueDay: due,
        visibility: visibility as never,
        // `null` apaga o campo de verdade; `undefined` sairia do payload e
        // deixaria o titular antigo no documento.
        holderMemberId: card ? holderMemberId || null : holderMemberId || undefined,
        archived: card ? archived : false,
      };

      if (card) {
        await collections.creditCards.update(card.id, fields as never);
      } else {
        await collections.creditCards.create({ householdId: household.id, ...fields } as never);
      }
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!card) return;
    setError(null);
    setSaving(true);
    try {
      await collections.creditCards.remove(card.id);
      onClose();
    } catch (deleteError) {
      console.error(deleteError);
      setError("Não foi possível excluir agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const purchaseCount = card
    ? finance.cardPurchases.filter((purchase) => purchase.creditCardId === card.id).length
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar cartão" : "Novo cartão"}
      description={
        editing
          ? "Corrigir o fechamento ou o vencimento remonta as faturas: as compras passam a cair no mês certo."
          : "As datas de fechamento e vencimento definem em qual fatura cada compra entra."
      }
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

        <MemberField
          label="Titular"
          hint="Quem responde por este cartão. Serve para o grupo ver os cartões de cada um."
          value={holderMemberId}
          onChange={setHolderMemberId}
          emptyLabel="Do grupo"
        />

        <SelectField
          label="Este cartão é"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          options={[
            { value: "HOUSEHOLD", label: "Do grupo" },
            { value: "PERSONAL", label: "Pessoal" },
          ]}
        />

        {editing ? (
          <SelectField
            label="Situação"
            value={archived ? "ARCHIVED" : "ACTIVE"}
            onChange={(event) => setArchived(event.target.value === "ARCHIVED")}
            options={[
              { value: "ACTIVE", label: "Em uso" },
              { value: "ARCHIVED", label: "Arquivado (cartão cancelado)" },
            ]}
            hint="Arquivar tira o cartão das listas de escolha sem apagar compra nenhuma."
          />
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>

        {editing && canAdminister ? (
          <div className="border-t border-[color:var(--card-border)] pt-4">
            {confirmingDelete ? (
              <Callout tone="critical" title="Excluir este cartão?">
                <p className="text-sm">
                  {purchaseCount > 0
                    ? `${purchaseCount} ${purchaseCount === 1 ? "compra registrada ficaria" : "compras registradas ficariam"} sem cartão. Arquivar mantém o histórico das faturas e tira o cartão das listas — é quase sempre o que você quer.`
                    : "Nenhuma compra aponta para este cartão, então excluir não deixa buraco no histórico."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onDelete()}
                    disabled={saving}
                  >
                    Excluir mesmo assim
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={saving}
                  >
                    Manter
                  </Button>
                </div>
              </Callout>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
              >
                Excluir cartão
              </Button>
            )}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
