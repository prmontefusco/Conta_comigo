"use client";

import { useEffect, useState } from "react";
import {
  addMonthsToKey,
  calendarDate,
  firstDayOfMonthKey,
  formatMonthKey,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { allocate, fromDecimalString } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { dueDateFor, statementMonthForPurchase } from "@/modules/cards/domain/credit-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Recording a card purchase.
 *
 * The preview below the form is the point of this screen: before saving,
 * someone can see exactly which faturas the purchase will land in and what
 * each installment will be. A parcelamento that quietly stretches into next
 * year should be visible at the moment of the decision, not months later.
 */
export function NewPurchaseDialog({
  cardId,
  onClose,
}: {
  cardId: string | null;
  onClose: () => void;
}) {
  const { cards, categories, asOf } = useFinance();
  const { household } = useSession();
  const collections = useCollections();

  const card = cards.find((item) => item.id === cardId);

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<string>(asOf);
  const [installments, setInstallments] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [visibility, setVisibility] = useState("HOUSEHOLD");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const expenseCategories = categories.filter((category) => category.kind === "EXPENSE");
  const defaultCategoryId = expenseCategories[0]?.id ?? "";

  useEffect(() => {
    if (!cardId) return;
    setDescription("");
    setAmountText("");
    setPurchaseDate(asOf);
    setInstallments("1");
    setCategoryId(defaultCategoryId);
    setError(null);
  }, [cardId, asOf, defaultCategoryId]);

  if (!card) return null;

  const amount = fromDecimalString(amountText);
  const parts = Number(installments) || 1;
  const preview =
    amount && amount.amount > 0 && parts >= 1
      ? buildPreview(card, calendarDateOrNull(purchaseDate), amount, parts)
      : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household || !card) return;

    if (!amount || amount.amount <= 0) {
      setError("Informe o valor da compra.");
      return;
    }
    if (description.trim().length < 2) {
      setError("Descreva a compra.");
      return;
    }
    if (!categoryId) {
      setError("Escolha uma categoria para a compra.");
      return;
    }
    const date = calendarDateOrNull(purchaseDate);
    if (!date) {
      setError("Informe uma data válida.");
      return;
    }
    if (parts < 1 || parts > 120) {
      setError("O número de parcelas precisa estar entre 1 e 120.");
      return;
    }

    setSaving(true);
    try {
      await collections.cardPurchases.create({
        householdId: household.id,
        creditCardId: card.id,
        description: description.trim(),
        totalAmount: amount,
        purchaseDate: date,
        // The consumption belongs to the day it happened. The instalments
        // affect cash later; those are two different views of the same purchase.
        competenceDate: date,
        categoryId,
        installmentCount: parts,
        visibility: visibility as never,
      } as never);
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
      open={Boolean(cardId)}
      onClose={onClose}
      title="Nova compra"
      description={`${card.name} · fecha dia ${card.closingDay}, vence dia ${card.dueDay}`}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <TextField
          label="Descrição"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Geladeira"
        />

        <MoneyField
          label="Valor total"
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          placeholder="0,00"
          hint="O valor cheio da compra, não o da parcela."
        />

        <div className="grid grid-cols-2 gap-4">
          <DateField
            label="Data da compra"
            required
            value={purchaseDate}
            onChange={(event) => setPurchaseDate(event.target.value)}
          />
          <TextField
            label="Parcelas"
            type="number"
            min={1}
            max={120}
            required
            value={installments}
            onChange={(event) => setInstallments(event.target.value)}
          />
        </div>

        <SelectField
          label="Categoria"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          options={expenseCategories.map((category) => ({
            value: category.id,
            label: `${category.icon ?? ""} ${category.name}`.trim(),
          }))}
        />

        <SelectField
          label="De quem é"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          options={[
            { value: "HOUSEHOLD", label: "Do grupo" },
            { value: "PERSONAL", label: "Pessoal" },
          ]}
        />

        {preview ? (
          <Callout tone="info" title="Como isso vai cair nas faturas">
            <ul className="mt-1 space-y-0.5 text-sm">
              {preview.slice(0, 6).map((item) => (
                <li key={item.month} className="tabular">
                  {formatMonthKey(item.month)}: {formatMoney(item.amount)} · vence{" "}
                  {item.dueDate.split("-").reverse().join("/")}
                </li>
              ))}
              {preview.length > 6 ? (
                <li style={{ color: "var(--muted-fg)" }}>
                  e mais {preview.length - 6} {preview.length - 6 === 1 ? "parcela" : "parcelas"},
                  até {formatMonthKey(preview[preview.length - 1]!.month)}
                </li>
              ) : null}
            </ul>
          </Callout>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar compra"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function calendarDateOrNull(value: string) {
  try {
    return calendarDate(value);
  } catch {
    return null;
  }
}

function buildPreview(
  card: NonNullable<ReturnType<typeof useFinance>["cards"][number]>,
  date: ReturnType<typeof calendarDateOrNull>,
  amount: NonNullable<ReturnType<typeof fromDecimalString>>,
  parts: number,
) {
  if (!date) return null;
  const first = statementMonthForPurchase(card, date);
  return allocate(amount, parts).map((value, index) => {
    const month = addMonthsToKey(first, index);
    return {
      month,
      amount: value,
      dueDate: dueDateFor(card, month),
      firstDay: firstDayOfMonthKey(month),
    };
  });
}
