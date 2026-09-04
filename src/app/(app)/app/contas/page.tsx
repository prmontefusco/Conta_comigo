"use client";

import { useMemo, useState } from "react";
import { addDays, endOfMonth, formatCalendarDate } from "@/core/date/calendar-date";
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
import { SettleObligationDialog } from "@/modules/obligations/ui/settle-obligation-dialog";
import { DocumentImportButton } from "@/modules/receipts/ui/document-import-button";
import { FinancialInsightCard } from "@/modules/education/ui/financial-insight-card";

type Filter = "OPEN" | "OVERDUE" | "THIS_MONTH" | "SETTLED";
type Direction = "OUTFLOW" | "INFLOW";

const FILTER_LABELS: Record<Filter, string> = {
  OPEN: "Em aberto",
  OVERDUE: "Vencidas",
  THIS_MONTH: "Este mês",
  SETTLED: "Quitadas",
};

/**
 * Bills and expected income.
 *
 * A late bill is never hidden or auto-closed: it stays in the list, and in the
 * projection, until someone records that it was actually paid.
 */
export default function ObligationsPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [direction, setDirection] = useState<Direction>("OUTFLOW");
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [creating, setCreating] = useState(false);
  const [settling, setSettling] = useState<Obligation | null>(null);

  const items = useMemo(
    () => filterObligations(finance.obligations, direction, filter, finance.asOf),
    [finance.obligations, direction, filter, finance.asOf],
  );

  const total = sum(items.filter(isOpen).map(remainingAmount));

  if (finance.loading) return <Spinner label="Carregando suas contas" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Contas</h1>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <DocumentImportButton />
            <Button onClick={() => setCreating(true)}>Nova conta</Button>
          </div>
        ) : null}
      </div>

      <FinancialInsightCard
        tag="Contas Essenciais & Sobrevivência"
        title="Prioridade Absoluta: Água, Luz e Moradia"
        description="Contas de serviços essenciais nunca devem ser deixadas para depois de dívidas bancárias comuns. Se o dinheiro faltar no mês, proteja sempre o teto e os serviços básicos da sua família."
        tips={[
          "Ligue para a concessionária antes do corte: negociar antes do corte evita taxas de religação e permite parcelamento do saldo atrasado.",
          "Verifique se você tem direito à Tarifa Social de Energia Elétrica (descontos de até 65% na conta de luz para famílias inscritas no CadÚnico).",
          "Boletos pagos em atraso acumulam 2% de multa + juros diários. Pague no vencimento sempre que possível.",
        ]}
        helpTopic="Use o botão 'Importar Conta / Fatura' para ler o PDF ou foto do boleto pela câmera sem digitar nada, ou clique em 'Nova conta' para lançar manualmente."
      />

      <div role="tablist" aria-label="Tipo" className="flex gap-2">
        {(["OUTFLOW", "INFLOW"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={direction === value}
            onClick={() => setDirection(value)}
            className={tabClass(direction === value)}
          >
            {value === "OUTFLOW" ? "A pagar" : "A receber"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
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
              : undefined
          }
        >
          {direction === "OUTFLOW" ? "A pagar" : "A receber"}
        </CardTitle>

        {filter !== "SETTLED" ? (
          <p className="mb-3 text-sm" style={{ color: "var(--muted-fg)" }}>
            Total em aberto: <MoneyText value={total} size="sm" tone="outflow" />
          </p>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="Nada por aqui"
            description={
              filter === "OVERDUE"
                ? "Nenhuma conta em atraso neste momento."
                : "Cadastre suas contas para que elas apareçam na projeção dos próximos meses."
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
                        onClick={() => setSettling(obligation)}
                      >
                        {obligation.direction === "INFLOW" ? "Recebi" : "Paguei"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <NewObligationDialog open={creating} onClose={() => setCreating(false)} />
      <SettleObligationDialog obligation={settling} onClose={() => setSettling(null)} />
    </div>
  );
}

function filterObligations(
  obligations: readonly Obligation[],
  direction: Direction,
  filter: Filter,
  today: ReturnType<typeof useFinance>["asOf"],
): Obligation[] {
  const scoped = obligations.filter((item) => item.direction === direction);

  const filtered = scoped.filter((item) => {
    switch (filter) {
      case "OPEN":
        return isOpen(item);
      case "OVERDUE":
        return isOpen(item) && item.dueDate < today;
      case "THIS_MONTH":
        return isOpen(item) && item.dueDate <= endOfMonth(today);
      case "SETTLED":
        return item.status === "SETTLED";
    }
  });

  return filter === "SETTLED"
    ? filtered.sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1)).slice(0, 100)
    : filtered.sort(byUrgency).filter((item) => item.dueDate <= addDays(today, 400));
}

function tabClass(active: boolean): string {
  return [
    "min-h-11 flex-1 rounded-lg px-4 text-sm font-medium",
    active
      ? "bg-[color:var(--color-brand-600)] text-white"
      : "border border-[color:var(--card-border)] bg-[color:var(--card-bg)]",
  ].join(" ");
}

function chipClass(active: boolean): string {
  return [
    "min-h-9 rounded-full px-3 text-xs font-medium",
    active
      ? "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]"
      : "border border-[color:var(--card-border)]",
  ].join(" ");
}
