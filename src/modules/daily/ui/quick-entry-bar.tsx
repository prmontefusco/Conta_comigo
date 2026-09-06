"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString } from "@/core/money/money";
import { Button, Card, CardTitle } from "@/components/ui/primitives";
import { FormError, MoneyField } from "@/components/ui/form";
import {
  PROBLEM_MESSAGES,
  buildQuickEntry,
  suggestQuickAccount,
  suggestQuickCategories,
} from "@/modules/daily/domain/quick-entry";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Lançar um gasto sem abrir formulário.
 *
 * Valor, uma categoria, salvar. Todo o resto — data, conta, visibilidade — vem
 * do que a própria casa vem fazendo, e continua editável no formulário
 * completo, que segue a um toque de distância.
 *
 * A categoria é o único campo que **não** é adivinhado. Errar a conta custa
 * uma correção; errar a categoria contamina orçamento, relatório e a leitura
 * do que a casa gasta com o quê.
 */
export function QuickEntryBar({ onOpenFullForm }: { onOpenFullForm?: () => void }) {
  const finance = useFinance();
  const { household, canWrite } = useSession();
  const collections = useCollections();

  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const suggestions = useMemo(
    () =>
      suggestQuickCategories({
        categories: finance.categories,
        transactions: finance.transactions,
        asOf: finance.asOf,
      }),
    [finance.categories, finance.transactions, finance.asOf],
  );

  const account = useMemo(
    () =>
      suggestQuickAccount({
        accounts: finance.accounts,
        transactions: finance.transactions,
        asOf: finance.asOf,
      }),
    [finance.accounts, finance.transactions, finance.asOf],
  );

  if (!canWrite || suggestions.length === 0) return null;

  async function save() {
    setError(null);
    setJustSaved(null);
    if (!household) return;

    const result = buildQuickEntry({
      amount: fromDecimalString(amountText),
      category: suggestions.find((item) => item.category.id === categoryId)?.category ?? null,
      account,
      asOf: finance.asOf,
    });

    if ("problem" in result) {
      setError(PROBLEM_MESSAGES[result.problem]);
      return;
    }

    setSaving(true);
    try {
      await collections.transactions.create({
        householdId: household.id,
        kind: "EXPENSE",
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
      setCategoryId("");
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle hint={account ? `Sai de ${account.name}, hoje.` : undefined}>
          Lançamento rápido
        </CardTitle>
        {onOpenFullForm ? (
          <button
            type="button"
            onClick={onOpenFullForm}
            className="text-xs font-medium underline underline-offset-2"
            style={{ color: "var(--color-brand-700)" }}
          >
            Preencher tudo
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

        <div className="max-w-[10rem]">
          <MoneyField
            label="Quanto foi"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            inputMode="decimal"
          />
        </div>

        <fieldset>
          <legend className="text-2xs font-semibold tracking-wider uppercase">Em quê</legend>
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
                    borderColor: selected ? "var(--color-brand-600)" : "var(--card-border)",
                    background: selected ? "var(--color-brand-600)" : "var(--color-surface-sunken)",
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
            {saving ? "Salvando…" : "Lançar"}
          </Button>
          {justSaved ? (
            <p role="status" className="text-xs" style={{ color: "var(--color-positive-700)" }}>
              Lançado: {justSaved}. Pode lançar o próximo.
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
