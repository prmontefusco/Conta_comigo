"use client";

import { useMemo, useState } from "react";
import { formatMonthKey, monthKeyOf } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString } from "@/core/money/money";
import {
  Button,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  ProgressBar,
  Spinner,
  Stat,
} from "@/components/ui/primitives";
import { FormError, MoneyField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { computeBudgetStatus, type Budget } from "@/modules/budget/domain/budget";
import { categoryName, buildCategoryIndex } from "@/modules/categories/domain/category";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * The monthly budget.
 *
 * Three numbers per category, never two: planned, already committed, and
 * already spent. Someone with R$ 600 "left" but R$ 400 of bills still to pay
 * has R$ 200, and this page says so.
 */
export default function BudgetPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [editing, setEditing] = useState(false);

  const month = monthKeyOf(finance.asOf);
  const budget = finance.budgets.find((item) => item.month === month) ?? null;

  const status = useMemo(
    () => (budget ? computeBudgetStatus(budget, finance.transactions, finance.obligations) : null),
    [budget, finance.transactions, finance.obligations],
  );

  const categoryIndex = buildCategoryIndex(finance.categories);

  if (finance.loading) return <Spinner label="Carregando seu orçamento" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Orçamento</h1>
        {canWrite ? (
          <Button onClick={() => setEditing(true)}>
            {budget ? "Editar orçamento" : "Criar orçamento"}
          </Button>
        ) : null}
      </div>

      {!budget || !status ? (
        <Card>
          <EmptyState
            title={`Sem orçamento para ${formatMonthKey(month)}`}
            description="Defina quanto pretende gastar em cada categoria. O sistema mostra o que já foi gasto e o que já está comprometido."
            action={
              canWrite ? (
                <Button onClick={() => setEditing(true)}>Criar orçamento</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle hint={formatMonthKey(month)}>Total do mês</CardTitle>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Planejado" value={status.totals.planned} />
              <Stat label="Já gasto" value={status.totals.actual} tone="outflow" />
              <Stat
                label="Comprometido"
                value={status.totals.committed}
                tone="outflow"
                hint="Contas do mês ainda não pagas."
              />
              <Stat
                label="Disponível"
                value={status.totals.available}
                tone={status.totals.overspend.amount > 0 ? "critical" : "positive"}
              />
            </dl>

            {status.totals.overspend.amount > 0 ? (
              <Callout tone="attention">
                Somando o que já foi gasto e o que ainda está comprometido, o mês passa do planejado
                em {formatMoney(status.totals.overspend)}.
              </Callout>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Por categoria</CardTitle>
            <ul className="space-y-4">
              {status.lines.map((line) => (
                <li key={line.categoryId}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{categoryName(categoryIndex, line.categoryId)}</p>
                    <p className="text-sm">
                      <MoneyText
                        value={line.available}
                        size="sm"
                        tone={line.overspend.amount > 0 ? "critical" : "positive"}
                      />
                      <span style={{ color: "var(--muted-fg)" }}>
                        {" "}
                        de {formatMoney(line.planned)}
                      </span>
                    </p>
                  </div>

                  <div className="mt-1.5">
                    <ProgressBar
                      ratio={line.usage}
                      label={`Uso do orçamento de ${categoryName(categoryIndex, line.categoryId)}`}
                      tone={
                        line.usage >= 1 ? "critical" : line.usage >= 0.85 ? "attention" : "brand"
                      }
                    />
                  </div>

                  <p className="mt-1.5 text-xs" style={{ color: "var(--muted-fg)" }}>
                    {formatMoney(line.actual)} já gastos
                    {line.committed.amount > 0
                      ? ` · ${formatMoney(line.committed)} comprometidos`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>

            {status.unbudgeted.amount > 0 ? (
              <p
                className="mt-5 border-t border-[color:var(--card-border)] pt-4 text-sm"
                style={{ color: "var(--muted-fg)" }}
              >
                {formatMoney(status.unbudgeted)} do mês estão em categorias fora do orçamento.
              </p>
            ) : null}
          </Card>
        </>
      )}

      <BudgetDialog
        open={editing}
        onClose={() => setEditing(false)}
        month={month}
        budget={budget}
      />
    </div>
  );
}

function BudgetDialog({
  open,
  onClose,
  month,
  budget,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  budget: Budget | null;
}) {
  const { categories } = useFinance();
  const { household } = useSession();
  const collections = useCollections();

  const expenseCategories = categories.filter(
    (category) => category.kind === "EXPENSE" && !category.archived,
  );

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (budget?.lines ?? []).map((line) => [
        line.categoryId,
        (line.plannedAmount.amount / 100).toFixed(2).replace(".", ","),
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    const lines = Object.entries(values)
      .map(([categoryId, text]) => ({ categoryId, plannedAmount: fromDecimalString(text) }))
      .filter(
        (
          line,
        ): line is { categoryId: string; plannedAmount: NonNullable<typeof line.plannedAmount> } =>
          line.plannedAmount !== null && line.plannedAmount.amount > 0,
      );

    if (lines.length === 0) {
      setError("Defina ao menos uma categoria com valor.");
      return;
    }

    setSaving(true);
    try {
      if (budget) {
        await collections.budgets.update(budget.id, { lines } as never);
      } else {
        await collections.budgets.createWithId(month, {
          householdId: household.id,
          month: month as never,
          lines,
        } as never);
      }
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
      title={`Orçamento de ${formatMonthKey(month as never)}`}
      description="Deixe em branco as categorias que você não quer acompanhar por enquanto."
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        {expenseCategories.map((category) => (
          <MoneyField
            key={category.id}
            label={`${category.icon ?? ""} ${category.name}`.trim()}
            value={values[category.id] ?? ""}
            onChange={(event) =>
              setValues((current) => ({ ...current, [category.id]: event.target.value }))
            }
            placeholder="0,00"
          />
        ))}

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar orçamento"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
