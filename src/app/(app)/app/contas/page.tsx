"use client";

import { useMemo, useState } from "react";
import { addDays, endOfMonth, formatCalendarDate, startOfMonth } from "@/core/date/calendar-date";
import { sum } from "@/core/money/money";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  Spinner,
} from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  byUrgency,
  displayStatus,
  isOpen,
  remainingAmount,
  type Obligation,
} from "@/modules/obligations/domain/obligation";
import { NewObligationDialog } from "@/modules/obligations/ui/new-obligation-dialog";
import { ConfirmOccurrenceDialog } from "@/modules/recurring/ui/confirm-occurrence-dialog";
import { EditRecurringRuleDialog } from "@/modules/recurring/ui/edit-recurring-rule-dialog";
import { RecurringPatternsCard } from "@/modules/recurring/ui/recurring-patterns-card";
import {
  pendingOccurrenceAsObligation,
  pendingOccurrences,
  type PendingOccurrence,
} from "@/modules/recurring/domain/pending-occurrences";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import { SettleObligationDialog } from "@/modules/obligations/ui/settle-obligation-dialog";
import { DocumentImportButton } from "@/modules/receipts/ui/document-import-button";

type Filter = "OPEN" | "OVERDUE" | "THIS_MONTH" | "SETTLED";
const FILTER_LABELS: Record<Filter, string> = {
  OPEN: "Todas em aberto",
  OVERDUE: "Vencidas",
  THIS_MONTH: "Este mês",
  SETTLED: "Quitadas",
};

/**
 * Bills awaiting payment.
 *
 * A late bill is never hidden or auto-closed: it stays in the list, and in the
 * projection, until someone records that it was actually paid.
 */
export default function ObligationsPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [creating, setCreating] = useState(false);
  const [settling, setSettling] = useState<Obligation | null>(null);
  const [editing, setEditing] = useState<Obligation | null>(null);
  const [confirming, setConfirming] = useState<PendingOccurrence | null>(null);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  /** Ocorrências de contas recorrentes ainda não confirmadas como pagas. */
  const recurring = useMemo(
    () =>
      pendingOccurrences({
        rules: finance.recurringRules,
        obligations: finance.obligations,
        asOf: finance.asOf,
        direction: "OUTFLOW",
      }),
    [finance.recurringRules, finance.obligations, finance.asOf],
  );

  const items = useMemo(
    () =>
      filterObligations(
        [
          ...finance.obligations,
          ...(filter === "SETTLED" ? [] : recurring.map(pendingOccurrenceAsObligation)),
        ],
        filter,
        finance.asOf,
      ),
    [finance.obligations, recurring, filter, finance.asOf],
  );

  const recurringByOccurrenceKey = useMemo(
    () => new Map(recurring.map((item) => [item.occurrence.occurrenceKey, item])),
    [recurring],
  );

  const total = sum(items.filter(isOpen).map(remainingAmount));

  if (finance.loading) return <Spinner label="Carregando suas contas" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Contas a pagar</h1>
          <p className="mt-1 text-sm text-[color:var(--muted-fg)]">
            Veja os vencimentos e marque quando pagar. As próximas contas recorrentes também
            aparecem nesta lista.
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <DocumentImportButton />
            <Button onClick={() => setCreating(true)}>Nova conta</Button>
          </div>
        ) : null}
      </div>

      <div role="group" aria-label="Filtrar contas" className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={chipClass(filter === value)}
          >
            {FILTER_LABELS[value]}
          </button>
        ))}
      </div>

      <Card>
        <CardTitle
          hint={
            filter === "SETTLED"
              ? `${items.length} ${items.length === 1 ? "registro" : "registros"}`
              : `${items.length} ${items.length === 1 ? "conta" : "contas"} nesta lista`
          }
        >
          A pagar
        </CardTitle>

        {filter !== "SETTLED" ? (
          <p className="mb-3 text-sm" style={{ color: "var(--muted-fg)" }}>
            Total previsto nesta lista: <MoneyText value={total} size="sm" tone="outflow" />
          </p>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="Nada por aqui"
            description={
              filter === "OVERDUE"
                ? "Nenhuma conta em atraso neste momento."
                : "Cadastre uma conta ou uma conta recorrente para ver os próximos vencimentos aqui."
            }
            action={
              canWrite ? <Button onClick={() => setCreating(true)}>Nova conta</Button> : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-[color:var(--card-border)]">
            {items.map((obligation) => {
              const status = displayStatus(obligation, finance.asOf);
              const remaining = remainingAmount(obligation);
              const pending = obligation.source?.occurrenceKey
                ? recurringByOccurrenceKey.get(obligation.source.occurrenceKey)
                : undefined;

              return (
                <li key={obligation.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{obligation.description}</p>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      {formatCalendarDate(obligation.dueDate)}
                      {obligation.confidence === "ESTIMATED" ? " · valor estimado" : ""}
                      {obligation.source?.installmentNumber
                        ? ` · parcela ${obligation.source.installmentNumber}/${obligation.source.installmentCount}`
                        : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {pending ? <Badge tone="neutral">Recorrente</Badge> : null}
                      {status === "OVERDUE" ? <Badge tone="critical">Vencida</Badge> : null}
                      {status === "PARTIALLY_SETTLED" ? (
                        <Badge tone="attention">Parcialmente paga</Badge>
                      ) : null}
                      {status === "SETTLED" ? <Badge tone="positive">Quitada</Badge> : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <MoneyText
                      value={isOpen(obligation) ? remaining : obligation.amount}
                      size="sm"
                      tone={obligation.direction === "INFLOW" ? "positive" : "outflow"}
                    />
                    {canWrite && isOpen(obligation) ? (
                      <Button
                        variant="secondary"
                        className="mt-1 block w-full text-xs"
                        onClick={() => (pending ? setConfirming(pending) : setSettling(obligation))}
                      >
                        Paguei
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        className="mt-1 block w-full text-xs"
                        onClick={() =>
                          pending ? setEditingRule(pending.rule) : setEditing(obligation)
                        }
                        aria-label={`${pending ? "Editar regra de" : "Corrigir"} ${obligation.description}`}
                      >
                        {pending ? "Editar" : "Corrigir"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <RecurringPatternsCard
        direction="OUTFLOW"
        onCreate={() => setCreating(true)}
        onEdit={setEditingRule}
      />

      <ConfirmOccurrenceDialog pending={confirming} onClose={() => setConfirming(null)} />
      <EditRecurringRuleDialog
        rule={editingRule}
        onClose={() => setEditingRule(null)}
        lockDirection
      />

      <NewObligationDialog
        open={creating || editing !== null}
        obligation={editing}
        defaultDirection="OUTFLOW"
        lockDirection
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <SettleObligationDialog obligation={settling} onClose={() => setSettling(null)} />
    </div>
  );
}

function filterObligations(
  obligations: readonly Obligation[],
  filter: Filter,
  today: ReturnType<typeof useFinance>["asOf"],
): Obligation[] {
  const scoped = obligations.filter((item) => item.direction === "OUTFLOW");

  const filtered = scoped.filter((item) => {
    switch (filter) {
      case "OPEN":
        return isOpen(item);
      case "OVERDUE":
        return isOpen(item) && item.dueDate < today;
      case "THIS_MONTH":
        return (
          isOpen(item) && item.dueDate >= startOfMonth(today) && item.dueDate <= endOfMonth(today)
        );
      case "SETTLED":
        return item.status === "SETTLED";
    }
  });

  return filter === "SETTLED"
    ? filtered.sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1)).slice(0, 100)
    : filtered.sort(byUrgency).filter((item) => item.dueDate <= addDays(today, 400));
}

function chipClass(active: boolean): string {
  return [
    "min-h-9 rounded-full px-3 text-xs font-medium",
    active
      ? "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]"
      : "border border-[color:var(--card-border)]",
  ].join(" ");
}
