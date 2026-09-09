"use client";

import { useMemo, useState } from "react";
import {
  addMonthsToKey,
  formatCalendarDate,
  formatMonthKey,
  monthKeyOf,
  type MonthKey,
} from "@/core/date/calendar-date";
import { isNegative } from "@/core/money/money";
import {
  Badge,
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
import { buildCategoryIndex, categoryName } from "@/modules/categories/domain/category";
import {
  buildDailyEntries,
  dailyTotals,
  entriesInMonth,
  groupByDay,
  plannedEntriesInMonth,
  plannedTotals,
  spendingByCategory,
  totalsByMember,
  type DailyEntry,
  type PlannedEntry,
} from "@/modules/daily/domain/daily-entries";
import {
  convertFutureTransactions,
  futureTransactions,
} from "@/modules/daily/application/convert-future-transactions";
import { NewEntryDialog } from "@/modules/daily/ui/new-entry-dialog";
import { QuickEntryBar } from "@/modules/daily/ui/quick-entry-bar";
import { SettleObligationDialog } from "@/modules/obligations/ui/settle-obligation-dialog";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import { getDb } from "@/lib/firebase/client";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useMembers } from "@/modules/household/ui/use-members";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * The day-to-day screen.
 *
 * Everything else in the app answers what is committed or what is coming.
 * This one answers what happened: the market on Saturday, the fuel on Monday,
 * the salary that landed on the fifth. Without it, the household's own habits
 * are the only part of its finances the app cannot see.
 *
 * One month at a time, because "how am I doing this month" is the question
 * people actually ask, and an infinite scroll of every purchase ever made
 * answers a different one.
 */
type Filter = "ALL" | "OUT" | "IN";

export default function DailyPage() {
  const finance = useFinance();
  const { canWrite, household, user } = useSession();
  const { active: members, nameOf } = useMembers();

  const [month, setMonth] = useState<MonthKey>(monthKeyOf(finance.asOf));
  const [filter, setFilter] = useState<Filter>("ALL");
  const [creating, setCreating] = useState<"EXPENSE" | "INCOME" | null>(null);
  const [editing, setEditing] = useState<DailyEntry | null>(null);
  const [confirming, setConfirming] = useState<Obligation | null>(null);
  const [converting, setConverting] = useState(false);
  const [converted, setConverted] = useState<number | null>(null);

  const entries = useMemo(
    () =>
      buildDailyEntries({
        transactions: finance.transactions,
        cardPurchases: finance.cardPurchases,
      }),
    [finance.transactions, finance.cardPurchases],
  );

  /**
   * Os lançamentos do mês que **já aconteceram**.
   *
   * `buildDailyEntries` continua sendo "tudo o que foi registrado", porque é
   * essa a definição de gasto de que o sugeridor de orçamento depende. Mas os
   * totais desta tela respondem outra pergunta — "como foi este mês até
   * agora" — e um lançamento datado para o dia 30 não faz parte da resposta.
   *
   * Lançamento futuro não nasce mais aqui (vira plano), então isto só alcança
   * o que foi gravado antes da separação. O aviso no topo da tela oferece a
   * conversão; até lá, o total não mente.
   */
  const monthEntries = useMemo(() => entriesInMonth(entries, month), [entries, month]);
  const realised = useMemo(
    () => monthEntries.filter((entry) => entry.date <= finance.asOf),
    [monthEntries, finance.asOf],
  );
  const totals = useMemo(() => dailyTotals(realised), [realised]);
  const byCategory = useMemo(() => spendingByCategory(realised), [realised]);
  const byMember = useMemo(() => totalsByMember(realised), [realised]);
  const categories = useMemo(() => buildCategoryIndex(finance.categories), [finance.categories]);

  // O que está previsto para o mês e ainda não virou dinheiro. Lista separada
  // de propósito: misturar plano com fato nos totais é o que fazia esta tela
  // dizer que um salário do dia 30 já tinha entrado.
  const planned = useMemo(
    () => plannedEntriesInMonth({ obligations: finance.obligations, month, asOf: finance.asOf }),
    [finance.obligations, month, finance.asOf],
  );
  const plannedSum = useMemo(() => plannedTotals(planned), [planned]);

  // Lançamentos datados para frente que foram gravados antes de esta tela
  // separar plano de fato. Sem a conversão, eles não seriam contados em
  // lugar nenhum.
  const stragglers = useMemo(
    () => futureTransactions(finance.transactions, finance.asOf),
    [finance.transactions, finance.asOf],
  );

  const visible = realised.filter((entry) => filter === "ALL" || entry.direction === filter);
  const days = groupByDay(visible);

  const currentMonth = monthKeyOf(finance.asOf);

  if (finance.loading) return <Spinner label="Carregando seus lançamentos" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dia a dia</h1>
        {canWrite ? (
          <div className="flex gap-2">
            <Button onClick={() => setCreating("EXPENSE")}>Registrar gasto</Button>
            <Button variant="secondary" onClick={() => setCreating("INCOME")}>
              Recebi
            </Button>
          </div>
        ) : null}
      </div>

      <QuickEntryBar onOpenFullForm={() => setCreating("EXPENSE")} />

      {converted !== null ? (
        <Callout tone="positive">
          {converted === 1
            ? "1 lançamento virou plano. Ele agora aparece"
            : `${converted} lançamentos viraram planos. Eles agora aparecem`}{" "}
          em “Planejado” e na projeção, e você confirma o valor real quando o dinheiro se mover.
        </Callout>
      ) : null}

      {stragglers.length > 0 && canWrite ? (
        <Callout
          tone="attention"
          title={`${stragglers.length} ${stragglers.length === 1 ? "lançamento tem" : "lançamentos têm"} data futura`}
        >
          <p className="text-sm">
            {stragglers.length === 1 ? "Ele foi registrado" : "Eles foram registrados"} como se
            {stragglers.length === 1 ? " já tivesse" : " já tivessem"} acontecido, mas a data ainda
            não chegou — então {stragglers.length === 1 ? "não entra" : "não entram"} no saldo nem
            na projeção. Transformar em plano coloca{stragglers.length === 1 ? "" : "m"}-
            {stragglers.length === 1 ? "o" : "os"} no lugar certo, e você confirma o valor real
            quando o dinheiro se mover.
          </p>
          <div className="mt-3">
            <Button
              variant="secondary"
              disabled={converting}
              onClick={() => {
                void (async () => {
                  if (!household || !user) return;
                  setConverting(true);
                  const result = await convertFutureTransactions({
                    db: getDb(),
                    householdId: household.id,
                    uid: user.uid,
                    transactions: finance.transactions,
                    asOf: finance.asOf,
                  }).catch(() => null);
                  setConverting(false);
                  if (result?.ok) setConverted(result.value.converted);
                })();
              }}
            >
              {converting ? "Convertendo…" : "Transformar em plano"}
            </Button>
          </div>
        </Callout>
      ) : null}

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

        <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Entrou" value={totals.received} tone="positive" />
          <Stat label="Saiu" value={totals.spent} tone="outflow" />
          <Stat
            label="Sobrou"
            value={totals.net}
            tone={isNegative(totals.net) ? "critical" : "positive"}
            hint={
              isNegative(totals.net)
                ? "Neste mês o grupo gastou mais do que recebeu."
                : "O que entrou menos o que foi consumido."
            }
          />
          <Stat
            label="Foi no cartão"
            value={totals.onCard}
            tone="attention"
            hint="Já é gasto deste mês, mas o dinheiro sai na fatura."
          />
        </dl>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Lançamentos</CardTitle>
          <div className="flex gap-2">
            {(
              [
                ["ALL", "Tudo"],
                ["OUT", "Gastos"],
                ["IN", "Recebimentos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={[
                  "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                  filter === value
                    ? "bg-[color:var(--color-brand-600)] text-white"
                    : "border border-[color:var(--card-border)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {days.length === 0 ? (
          <EmptyState
            title="Nada registrado neste mês"
            description="Mercado, combustível, farmácia, estacionamento, a diária que você recebeu. É o registro do dia a dia que mostra para onde o dinheiro está indo de verdade."
            action={
              canWrite ? (
                <Button onClick={() => setCreating("EXPENSE")}>Registrar gasto</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {days.map((day) => (
              <div key={day.date}>
                <div className="flex items-baseline justify-between gap-3 border-b border-[color:var(--card-border)] pb-1">
                  <h3 className="text-sm font-semibold">{formatCalendarDate(day.date)}</h3>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {day.spent.amount > 0 ? `saiu ${money(day.spent.amount)}` : null}
                    {day.spent.amount > 0 && day.received.amount > 0 ? " · " : null}
                    {day.received.amount > 0 ? `entrou ${money(day.received.amount)}` : null}
                  </p>
                </div>

                <ul className="divide-y divide-[color:var(--card-border)]">
                  {day.entries.map((entry) => (
                    <EntryRow
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

      {planned.length > 0 ? (
        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle hint="Ainda não entrou nem saiu da conta. Entra na projeção; não entra nos totais acima.">
              Planejado para {formatMonthKey(month)}
            </CardTitle>
            <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
              {plannedSum.toReceive.amount > 0 ? (
                <>
                  a receber <MoneyText value={plannedSum.toReceive} size="sm" tone="positive" />
                </>
              ) : null}
              {plannedSum.toReceive.amount > 0 && plannedSum.toPay.amount > 0 ? " · " : null}
              {plannedSum.toPay.amount > 0 ? (
                <>
                  a pagar <MoneyText value={plannedSum.toPay} size="sm" tone="outflow" />
                </>
              ) : null}
            </p>
          </div>

          <ul className="divide-y divide-[color:var(--card-border)]">
            {planned.map((entry) => (
              <PlannedRow
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
          <CardTitle hint={`Gastos de ${formatMonthKey(month)}`}>Para onde foi</CardTitle>
          <ul className="space-y-3">
            {byCategory.slice(0, 8).map((line) => (
              <li key={line.categoryId ?? "sem-categoria"}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">
                    {categoryName(categories, line.categoryId)}
                  </p>
                  <MoneyText value={line.total} size="sm" tone="outflow" />
                </div>
                <div className="mt-1">
                  <ProgressBar
                    ratio={totals.spent.amount === 0 ? 0 : line.total.amount / totals.spent.amount}
                    label={`Participação de ${categoryName(categories, line.categoryId)} nos gastos do mês`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {members.length > 1 && byMember.length > 0 ? (
        <Card>
          <CardTitle hint="Só o que foi registrado no nome de alguém.">Por pessoa</CardTitle>
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
                  {/* Someone who only received money should read as income,
                      not as a prominent "R$ 0,00" spent. */}
                  {line.spent.amount > 0 || line.received.amount === 0 ? (
                    <MoneyText value={line.spent} size="sm" tone="outflow" />
                  ) : null}
                  {line.received.amount > 0 ? (
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      recebeu <MoneyText value={line.received} size="sm" tone="positive" />
                    </p>
                  ) : null}
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

/**
 * Uma linha do dia a dia.
 *
 * A linha inteira abre a correção quando a pessoa pode escrever. Um gasto
 * lançado com o valor errado vira saldo errado no mesmo instante, e o conserto
 * precisa estar onde o erro é percebido — não em outra tela, atrás de um menu.
 */
function EntryRow({
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
        {memberLabel || entry.visibility === "PERSONAL" || (entry.installmentCount ?? 1) > 1 ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {memberLabel ? <Badge>{memberLabel}</Badge> : null}
            {entry.visibility === "PERSONAL" ? <Badge tone="neutral">Pessoal</Badge> : null}
            {(entry.installmentCount ?? 1) > 1 ? (
              <Badge tone="attention">{entry.installmentCount}x</Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <MoneyText
          value={entry.amount}
          size="sm"
          tone={entry.direction === "IN" ? "positive" : "outflow"}
        />
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
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        {content}
      </button>
    </li>
  );
}

function sourceLabelFor(entry: DailyEntry, finance: ReturnType<typeof useFinance>): string {
  if (entry.creditCardId) {
    const card = finance.cards.find((item) => item.id === entry.creditCardId);
    return card ? `${card.name} · crédito` : "Cartão";
  }
  const account = finance.accounts.find((item) => item.id === entry.accountId);
  return account?.name ?? "Conta";
}

/** Compact amount for the day header, where a full component would be noise. */
function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Uma linha do que está previsto.
 *
 * Visualmente separada do que aconteceu, e com o verbo no futuro: a diferença
 * entre "saiu R$ 180" e "vai sair R$ 180" é a diferença entre um saldo e uma
 * expectativa.
 */
function PlannedRow({
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
            <Badge tone="critical">Passou da data</Badge>
          </span>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <MoneyText
          value={entry.amount}
          size="sm"
          tone={entry.direction === "IN" ? "positive" : "outflow"}
        />
        {onConfirm ? (
          <Button variant="ghost" className="mt-1 block w-full text-xs" onClick={onConfirm}>
            {entry.direction === "IN" ? "Recebi" : "Paguei"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
