"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonthsToKey,
  formatCalendarDate,
  formatMonthKey,
  monthKeyOf,
  type MonthKey,
} from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  ProgressBar,
  Spinner,
  Stat,
} from "@/components/ui/primitives";
import { buildCategoryIndex, categoryName } from "@/modules/categories/domain/category";
import {
  buildDailyEntries,
  dailyTotals,
  entriesInMonth,
  groupByDay,
  plannedEntriesInMonth,
  plannedTotals,
  type DailyEntry,
  type PlannedEntry,
} from "@/modules/daily/domain/daily-entries";
import { NewEntryDialog } from "@/modules/daily/ui/new-entry-dialog";
import { QuickIncomeBar } from "@/modules/daily/ui/quick-income-bar";
import { SettleObligationDialog } from "@/modules/obligations/ui/settle-obligation-dialog";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useMembers } from "@/modules/household/ui/use-members";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * Tela dedicada ao registro e acompanhamento de Entradas e Recebimentos extras.
 *
 * Salários, PIX de parentes/pais, devoluções, restituição do imposto de renda,
 * ganho de ações judiciais, inventário familiar ou qualquer valor extra que entra
 * nas contas bancárias da casa.
 */
export default function EntradasPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const { active: members, nameOf } = useMembers();

  const [month, setMonth] = useState<MonthKey>(monthKeyOf(finance.asOf));
  const [creating, setCreating] = useState<"EXPENSE" | "INCOME" | null>(null);
  const [editing, setEditing] = useState<DailyEntry | null>(null);
  const [confirming, setConfirming] = useState<Obligation | null>(null);

  const entries = useMemo(
    () =>
      buildDailyEntries({
        transactions: finance.transactions,
        cardPurchases: finance.cardPurchases,
      }),
    [finance.transactions, finance.cardPurchases],
  );

  const monthEntries = useMemo(() => entriesInMonth(entries, month), [entries, month]);
  const realised = useMemo(
    () => monthEntries.filter((entry) => entry.date <= finance.asOf),
    [monthEntries, finance.asOf],
  );
  const totals = useMemo(() => dailyTotals(realised), [realised]);

  // Apenas entradas/recebimentos
  const realisedIncomes = useMemo(
    () => realised.filter((entry) => entry.direction === "IN"),
    [realised],
  );

  const days = useMemo(() => groupByDay(realisedIncomes), [realisedIncomes]);
  const categories = useMemo(() => buildCategoryIndex(finance.categories), [finance.categories]);

  // Planejados para o mês (apenas a receber)
  const planned = useMemo(
    () => plannedEntriesInMonth({ obligations: finance.obligations, month, asOf: finance.asOf }),
    [finance.obligations, month, finance.asOf],
  );
  const plannedInflows = useMemo(
    () => planned.filter((entry) => entry.direction === "IN"),
    [planned],
  );
  const plannedSum = useMemo(() => plannedTotals(planned), [planned]);

  // Distribuição de entradas por categoria
  const byCategory = useMemo(() => {
    const map = new Map<string | undefined, number>();
    for (const entry of realisedIncomes) {
      map.set(entry.categoryId, (map.get(entry.categoryId) ?? 0) + entry.amount.amount);
    }
    return [...map.entries()]
      .map(([categoryId, cents]) => ({ categoryId, total: money(cents) }))
      .sort((a, b) => b.total.amount - a.total.amount);
  }, [realisedIncomes]);

  // Distribuição de entradas por membro
  const byMember = useMemo(() => {
    const map = new Map<string | undefined, number>();
    for (const entry of realisedIncomes) {
      map.set(
        entry.responsibleMemberId,
        (map.get(entry.responsibleMemberId) ?? 0) + entry.amount.amount,
      );
    }
    return [...map.entries()]
      .map(([memberId, cents]) => ({ memberId, total: money(cents) }))
      .sort((a, b) => b.total.amount - a.total.amount);
  }, [realisedIncomes]);

  const currentMonth = monthKeyOf(finance.asOf);

  if (finance.loading) return <Spinner label="Carregando suas entradas" />;

  return (
    <div className="space-y-4">
      {/* Seletor rápido Saídas / Entradas para navegação veloz tanto no Desktop quanto no Mobile */}
      <div className="flex rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-1">
        <Link
          href="/app/dia-a-dia"
          className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium text-[color:var(--muted-fg)] transition hover:text-[color:var(--page-fg)]"
        >
          🧾 Saídas (Gastos)
        </Link>
        <Link
          href="/app/entradas"
          className="flex-1 rounded-lg bg-[color:var(--card-bg)] px-3 py-2 text-center text-xs font-bold text-[color:var(--color-brand-700)] shadow-2xs"
        >
          💰 Entradas (Recebimentos)
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Entradas</h1>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Registro de entradas de saldo e recebimentos extras (parentes, imposto de renda, ganho judicial, inventário, etc.)
          </p>
        </div>
        {canWrite ? (
          <div className="flex gap-2">
            <Button onClick={() => setCreating("INCOME")}>+ Registrar entrada</Button>
          </div>
        ) : null}
      </div>

      <QuickIncomeBar onOpenFullForm={() => setCreating("INCOME")} />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setMonth(addMonthsToKey(month, -1))}
            aria-label="Mês anterior"
          >
            ←
          </Button>
          <p className="font-medium">{formatMonthKey(month)}</p>
          <Button
            variant="ghost"
            onClick={() => setMonth(addMonthsToKey(month, 1))}
            aria-label="Próximo mês"
            disabled={month >= currentMonth}
          >
            →
          </Button>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Total que entrou"
            value={totals.received}
            tone="positive"
            hint="Entradas e rendas que já caíram na conta neste mês."
          />
          <Stat
            label="Previsto a receber"
            value={plannedSum.toReceive}
            tone="neutral"
            hint="Valores agendados para este mês que ainda não foram confirmados."
          />
          <Stat
            label="Saldo líquido do mês"
            value={totals.net}
            tone={totals.net.amount >= 0 ? "positive" : "critical"}
            hint="Total recebido menos o que foi consumido em saídas."
          />
        </dl>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <CardTitle hint="Valores que efetivamente entraram na sua conta">
            Entradas Realizadas
          </CardTitle>
          <span className="text-xs font-semibold" style={{ color: "var(--color-positive-700)" }}>
            {realisedIncomes.length} {realisedIncomes.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {days.length === 0 ? (
          <EmptyState
            title="Nenhuma entrada registrada neste mês"
            description="Quando receber um valor de um parente, pai, restituição de imposto de renda, ação judicial ganha, inventário ou renda extra, registre aqui para atualizar seu saldo."
            action={
              canWrite ? (
                <Button onClick={() => setCreating("INCOME")}>Registrar primeira entrada</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {days.map((day) => (
              <div key={day.date}>
                <div className="flex items-baseline justify-between gap-3 border-b border-[color:var(--card-border)] pb-1">
                  <h3 className="text-sm font-semibold">{formatCalendarDate(day.date)}</h3>
                  <p className="text-xs font-medium" style={{ color: "var(--color-positive-700)" }}>
                    entrou {money(day.received.amount).amount > 0 ? (day.received.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00"}
                  </p>
                </div>

                <ul className="divide-y divide-[color:var(--card-border)]">
                  {day.entries.map((entry) => (
                    <IncomeEntryRow
                      key={entry.id}
                      entry={entry}
                      categoryLabel={categoryName(categories, entry.categoryId)}
                      sourceLabel={sourceLabelFor(entry, finance)}
                      memberLabel={
                        entry.responsibleMemberId ? nameOf(entry.responsibleMemberId) : null
                      }
                      onEdit={canWrite ? () => setEditing(entry) : undefined}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {plannedInflows.length > 0 ? (
        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle hint="Ainda não caiu na conta. Ao receber, toque em 'Recebi' para entrar no saldo.">
              Previsto a Receber em {formatMonthKey(month)}
            </CardTitle>
            <p className="text-xs" style={{ color: "var(--color-positive-700)" }}>
              total <MoneyText value={plannedSum.toReceive} size="sm" tone="positive" />
            </p>
          </div>

          <ul className="divide-y divide-[color:var(--card-border)]">
            {plannedInflows.map((entry) => (
              <PlannedIncomeRow
                key={entry.id}
                entry={entry}
                categoryLabel={categoryName(categories, entry.categoryId)}
                onConfirm={
                  canWrite
                    ? () => {
                        const obligation = finance.obligations.find((item) => item.id === entry.id);
                        if (obligation) setConfirming(obligation);
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        </Card>
      ) : null}

      {byCategory.length > 0 ? (
        <Card>
          <CardTitle hint={`Origem das entradas de ${formatMonthKey(month)}`}>
            De onde veio
          </CardTitle>
          <ul className="space-y-3">
            {byCategory.slice(0, 8).map((line) => (
              <li key={line.categoryId ?? "sem-categoria"}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">
                    {categoryName(categories, line.categoryId)}
                  </p>
                  <MoneyText value={line.total} size="sm" tone="positive" />
                </div>
                <div className="mt-1">
                  <ProgressBar
                    ratio={totals.received.amount === 0 ? 0 : line.total.amount / totals.received.amount}
                    label={`Participação de ${categoryName(categories, line.categoryId)} nas entradas do mês`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {members.length > 1 && byMember.length > 0 ? (
        <Card>
          <CardTitle hint="Entradas associadas aos membros da família.">Por pessoa</CardTitle>
          <ul className="divide-y divide-[color:var(--card-border)]">
            {byMember.map((line) => (
              <li
                key={line.memberId ?? "grupo"}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <p className="truncate text-sm font-medium">
                  {line.memberId ? nameOf(line.memberId) : "Do grupo"}
                </p>
                <div className="shrink-0 text-right">
                  <MoneyText value={line.total} size="sm" tone="positive" />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <NewEntryDialog
        mode={creating}
        entry={editing}
        onClose={() => {
          setCreating(null);
          setEditing(null);
        }}
      />

      <SettleObligationDialog obligation={confirming} onClose={() => setConfirming(null)} />
    </div>
  );
}

function IncomeEntryRow({
  entry,
  categoryLabel,
  sourceLabel,
  memberLabel,
  onEdit,
}: {
  entry: DailyEntry;
  categoryLabel: string;
  sourceLabel: string;
  memberLabel: string | null;
  onEdit?: () => void;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium">{entry.description}</p>
        <p className="truncate text-xs" style={{ color: "var(--muted-fg)" }}>
          {categoryLabel} · {sourceLabel}
        </p>
        {memberLabel || entry.visibility === "PERSONAL" ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {memberLabel ? <Badge>{memberLabel}</Badge> : null}
            {entry.visibility === "PERSONAL" ? <Badge tone="neutral">Pessoal</Badge> : null}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <MoneyText value={entry.amount} size="sm" tone="positive" />
        {onEdit ? (
          <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
            corrigir
          </p>
        ) : null}
      </div>
    </>
  );

  if (!onEdit) return <li className="flex items-center gap-3 py-2.5">{content}</li>;

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Corrigir ${entry.description}`}
        className="flex w-full items-center gap-3 py-2.5 text-left transition hover:opacity-80"
      >
        {content}
      </button>
    </li>
  );
}

function sourceLabelFor(entry: DailyEntry, finance: ReturnType<typeof useFinance>): string {
  const account = finance.accounts.find((item) => item.id === entry.accountId);
  return account ? `Entrou em ${account.name}` : "Conta bancária";
}

function PlannedIncomeRow({
  entry,
  categoryLabel,
  onConfirm,
}: {
  entry: PlannedEntry;
  categoryLabel: string;
  onConfirm?: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{entry.description}</p>
        <p className="truncate text-xs" style={{ color: "var(--muted-fg)" }}>
          {formatCalendarDate(entry.dueDate)} · {categoryLabel}
        </p>
        {entry.late ? (
          <span className="mt-1 inline-block">
            <Badge tone="critical">Passou da data prevista</Badge>
          </span>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <MoneyText value={entry.amount} size="sm" tone="positive" />
        {onConfirm ? (
          <Button variant="secondary" className="mt-1 block w-full text-xs" onClick={onConfirm}>
            Recebi
          </Button>
        ) : null}
      </div>
    </li>
  );
}
