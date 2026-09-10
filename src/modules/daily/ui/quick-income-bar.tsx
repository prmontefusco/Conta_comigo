"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString } from "@/core/money/money";
import { Button, Card, CardTitle } from "@/components/ui/primitives";
import { FormError, MoneyField, TextField } from "@/components/ui/form";
import {
  INCOME_PROBLEM_MESSAGES,
  buildQuickEntry,
  suggestQuickIncomeAccount,
  suggestQuickIncomeCategories,
} from "@/modules/daily/domain/quick-entry";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Lançar uma entrada ou recebimento sem abrir o formulário completo.
 *
 * Ideal para registrar dinheiro que acabou de entrar na conta:
 * pix de parente, devolução/restituição, ganho extra, inventário familiar, etc.
 */
export function QuickIncomeBar({ onOpenFullForm }: { onOpenFullForm?: () => void }) {
  const finance = useFinance();
  const { household, canWrite } = useSession();
  const collections = useCollections();

  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const suggestions = useMemo(
    () =>
      suggestQuickIncomeCategories({
        categories: finance.categories,
        transactions: finance.transactions,
        asOf: finance.asOf,
      }),
    [finance.categories, finance.transactions, finance.asOf],
  );

  const defaultAccount = useMemo(
    () =>
      suggestQuickIncomeAccount({
        accounts: finance.accounts,
        transactions: finance.transactions,
        asOf: finance.asOf,
      }),
    [finance.accounts, finance.transactions, finance.asOf],
  );

  const openAccounts = useMemo(
    () => finance.accounts.filter((account) => !account.archived),
    [finance.accounts],
  );

  const activeAccount = useMemo(
    () =>
      openAccounts.find((acc) => acc.id === selectedAccountId) ??
      defaultAccount ??
      openAccounts[0] ??
      null,
    [openAccounts, selectedAccountId, defaultAccount],
  );

  if (!canWrite || openAccounts.length === 0) return null;

  async function save() {
    setError(null);
    setJustSaved(null);
    if (!household) return;

    const selectedCategory =
      suggestions.find((item) => item.category.id === categoryId)?.category ??
      finance.categories.find((c) => c.id === categoryId) ??
      null;

    const result = buildQuickEntry({
      amount: fromDecimalString(amountText),
      category: selectedCategory,
      account: activeAccount,
      asOf: finance.asOf,
      description: description.trim() || undefined,
    });

    if ("problem" in result) {
      setError(INCOME_PROBLEM_MESSAGES[result.problem]);
      return;
    }

    setSaving(true);
    try {
      await collections.transactions.create({
        householdId: household.id,
        kind: "INCOME",
        amount: result.draft.amount,
        transactionDate: result.draft.date,
        competenceDate: result.draft.date,
        description: result.draft.description,
        accountId: result.draft.accountId,
        categoryId: result.draft.categoryId,
        visibility: "HOUSEHOLD",
      } as never);

      setJustSaved(`${formatMoney(result.draft.amount)} em ${result.draft.description}`);
      setAmountText("");
      setDescription("");
      setCategoryId("");
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível registrar a entrada agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle
          hint={activeAccount ? `Entra em ${activeAccount.name}, hoje.` : "Entrada rápida"}
        >
          Lançamento rápido de entrada
        </CardTitle>
        {onOpenFullForm ? (
          <button
            type="button"
            onClick={onOpenFullForm}
            className="text-xs font-medium underline underline-offset-2"
            style={{ color: "var(--color-brand-700)" }}
          >
            Preencher formulário completo
          </button>
        ) : null}
      </div>

      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        noValidate
      >
        {error ? <FormError>{error}</FormError> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MoneyField
            label="Quanto entrou"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            inputMode="decimal"
          />

          <TextField
            label="Descrição (ex: Pix do pai, Restituição IR)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Opcional: usa categoria se vazio"
          />
        </div>

        {openAccounts.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span style={{ color: "var(--muted-fg)" }}>Conta de destino:</span>
            {openAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedAccountId(acc.id)}
                className={`min-h-8 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  activeAccount?.id === acc.id
                    ? "border-[color:var(--color-brand-600)] bg-[color:var(--color-brand-50)] text-[color:var(--color-brand-700)] dark:bg-[color:var(--color-brand-950)]/40"
                    : "border-[color:var(--card-border)] bg-[color:var(--card-bg)] text-[color:var(--page-fg)]"
                }`}
              >
                {acc.name}
              </button>
            ))}
          </div>
        ) : null}

        <fieldset>
          <legend className="text-2xs font-semibold tracking-wider uppercase">
            Origem / Categoria da Entrada
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map(({ category }) => {
              const selected = category.id === categoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategoryId(selected ? "" : category.id)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition"
                  style={{
                    borderColor: selected ? "var(--color-positive-600)" : "var(--card-border)",
                    background: selected
                      ? "var(--color-positive-600)"
                      : "var(--color-surface-sunken)",
                    color: selected ? "#fff" : "var(--page-fg)",
                  }}
                >
                  {category.icon ? <span aria-hidden="true">{category.icon}</span> : null}
                  {category.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Lançar entrada"}
          </Button>
          {justSaved ? (
            <p role="status" className="text-xs" style={{ color: "var(--color-positive-700)" }}>
              ✓ Entrada registrada: {justSaved}.
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
