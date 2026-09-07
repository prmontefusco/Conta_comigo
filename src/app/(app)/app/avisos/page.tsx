"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Button, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { alertActionLabel, alertAppHref } from "@/modules/alerts/domain/alert-actions";
import type { Alert, AlertSeverity } from "@/modules/alerts/domain/alerts";
import { buildAlertInbox, inboxStorageKey, markAllSeen } from "@/modules/alerts/domain/alert-inbox";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

type Filter = "ALL" | "UNSEEN" | "URGENT";

const SEVERITY_META: Record<AlertSeverity, { label: string; dot: string; card: string }> = {
  URGENT: {
    label: "Urgente",
    dot: "var(--tone-critical)",
    card: "border-[color:var(--color-critical-600)] bg-[color:var(--color-critical-100)]",
  },
  ATTENTION: {
    label: "Atenção",
    dot: "var(--tone-attention)",
    card: "border-[color:var(--color-attention-600)] bg-[color:var(--color-attention-100)]",
  },
  INFO: {
    label: "Informação",
    dot: "var(--color-brand-600)",
    card: "border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)]",
  },
};

export default function AlertsPage() {
  const finance = useFinance();
  const { household } = useSession();
  const [seenIds, setSeenIds] = useState<readonly string[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");

  const householdId = household?.id ?? "";

  useEffect(() => {
    if (!householdId) return;
    try {
      const raw = window.localStorage.getItem(inboxStorageKey(householdId));
      setSeenIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setSeenIds([]);
    }
  }, [householdId]);

  const inbox = useMemo(
    () => buildAlertInbox({ alerts: finance.alerts, seenIds }),
    [finance.alerts, seenIds],
  );

  const visibleItems = inbox.items.filter((item) => {
    if (filter === "UNSEEN") return item.unseen;
    if (filter === "URGENT") return item.alert.severity === "URGENT";
    return true;
  });

  function markSeen() {
    if (!householdId) return;
    const ids = markAllSeen(finance.alerts);
    setSeenIds(ids);
    try {
      window.localStorage.setItem(inboxStorageKey(householdId), JSON.stringify(ids));
    } catch {
      // A marcação de leitura é só conveniência local. Sem armazenamento, a tela segue útil.
    }
  }

  if (finance.loading) return <Spinner label="Carregando avisos" />;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-[color:var(--color-brand-700)]">
          Alertas dentro do aplicativo
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Caixa de avisos</h1>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--muted-fg)" }}>
              Estes avisos aparecem quando você acessa o app. Eles são calculados pelos dados da
              família e levam direto para a próxima ação possível.
            </p>
          </div>
          {inbox.unseenCount > 0 ? (
            <Button onClick={markSeen} variant="secondary">
              Marcar tudo como visto
            </Button>
          ) : null}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo dos avisos">
        <SummaryCard label="Novos" value={inbox.unseenCount} />
        <SummaryCard label="Urgentes novos" value={inbox.unseenUrgentCount} tone="critical" />
        <SummaryCard label="Total ativo" value={inbox.items.length} />
      </section>

      <Card>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar avisos">
          <FilterButton active={filter === "ALL"} onClick={() => setFilter("ALL")}>
            Todos
          </FilterButton>
          <FilterButton active={filter === "UNSEEN"} onClick={() => setFilter("UNSEEN")}>
            Novos
          </FilterButton>
          <FilterButton active={filter === "URGENT"} onClick={() => setFilter("URGENT")}>
            Urgentes
          </FilterButton>
        </div>
      </Card>

      {visibleItems.length === 0 ? (
        <Card>
          <CardTitle>Nada nesta lista</CardTitle>
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Não há avisos para o filtro escolhido. Se aparecer uma conta vencida, uma fatura próxima
            ou um mês que não fecha, ela entra aqui automaticamente ao abrir o aplicativo.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visibleItems.map(({ alert, unseen }) => (
            <li key={alert.id}>
              <AlertCard alert={alert} unseen={unseen} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "critical";
}) {
  return (
    <Card>
      <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
        {label}
      </p>
      <p
        className="mt-1 text-3xl font-semibold"
        style={{ color: tone === "critical" ? "var(--tone-critical)" : "var(--page-fg)" }}
      >
        {value}
      </p>
    </Card>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-[color:var(--color-brand-600)] text-white"
          : "bg-[color:var(--color-surface-sunken)] hover:bg-[color:var(--color-ink-100)]"
      }`}
    >
      {children}
    </button>
  );
}

function AlertCard({ alert, unseen }: { alert: Alert; unseen: boolean }) {
  const meta = SEVERITY_META[alert.severity];

  return (
    <Card className={`border-l-4 ${meta.card}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ background: meta.dot }}
            />
            <span className="text-xs font-bold tracking-wide uppercase">{meta.label}</span>
            {unseen ? (
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-[color:var(--color-brand-700)]">
                novo
              </span>
            ) : (
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs">visto</span>
            )}
          </div>
          <p className="mt-2 text-sm font-medium">{alert.message}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            {alert.date ? formatCalendarDate(alert.date) : "Sem data específica"}
            {alert.amount ? ` · ${formatMoney(alert.amount)}` : ""}
          </p>
        </div>

        <Link
          href={alertAppHref(alert)}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] px-3 py-2 text-sm font-semibold text-white shadow-2xs transition hover:bg-[color:var(--color-brand-700)]"
        >
          {alertActionLabel(alert)}
        </Link>
      </div>
    </Card>
  );
}
