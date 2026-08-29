"use client";

import Link from "next/link";
import { formatCalendarDate, differenceInDays } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { isNegative, isPositive } from "@/core/money/money";
import { Badge, Card, CardTitle, MoneyText, Stat } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { displayStatus } from "@/modules/obligations/domain/obligation";

/**
 * "Quanto eu tenho hoje?"
 *
 * The first three figures deliberately answer three different questions.
 * Showing only the account balance is how people end up spending money that
 * was already owed (docs/PRODUCT.md section 3.3).
 */
export function TodayBlock() {
  const { overview, asOf } = useFinance();
  const { today } = overview;

  return (
    <Card aria-labelledby="hoje-title">
      <CardTitle
        id="hoje-title"
        hint={`Situação em ${formatCalendarDate(asOf, { style: "long" })}`}
      >
        Hoje
      </CardTitle>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Saldo nas contas"
          value={today.totalCash}
          size="xl"
          hint="Tudo o que está nas contas e na carteira."
        />
        <Stat
          label="Reserva protegida"
          value={today.protectedReserve}
          size="lg"
          tone="outflow"
          hint="Você definiu que este dinheiro não está disponível."
        />
        <Stat
          label="Saldo livre"
          value={today.spendableCash}
          size="lg"
          tone={isNegative(today.spendableCash) ? "critical" : "positive"}
          hint="Saldo nas contas menos a reserva protegida."
        />
      </dl>

      <div className="mt-5 border-t border-[color:var(--card-border)] pt-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat
            label="Contas vencidas"
            value={today.payables.overdue}
            size="base"
            tone={isPositive(today.payables.overdue) ? "critical" : "neutral"}
            hint={
              today.overdue.length === 0
                ? "Nenhuma conta em atraso."
                : `${today.overdue.length} ${today.overdue.length === 1 ? "conta" : "contas"} aguardando pagamento.`
            }
          />
          <Stat
            label="Comprometido até o fim do mês"
            value={{
              amount: Math.max(today.spendableCash.amount - today.uncommittedCash.amount, 0),
              currency: today.spendableCash.currency,
            }}
            size="base"
            tone="outflow"
            hint={
              isNegative(today.uncommittedCash)
                ? `Faltam ${formatMoney({ amount: -today.uncommittedCash.amount, currency: today.uncommittedCash.currency })} para cobrir as contas deste mês.`
                : `Depois disso, restam ${formatMoney(today.uncommittedCash)}.`
            }
          />
        </dl>
      </div>

      <DueSoonList />
    </Card>
  );
}

function DueSoonList() {
  const { overview, asOf } = useFinance();
  const items = [...overview.today.overdue, ...overview.today.dueSoon].slice(0, 6);

  if (items.length === 0) {
    return (
      <p className="mt-5 text-sm" style={{ color: "var(--muted-fg)" }}>
        Nenhuma conta vence nos próximos sete dias.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold">Vencendo agora</h3>
      <ul className="mt-2 divide-y divide-[color:var(--card-border)]">
        {items.map((obligation) => {
          const status = displayStatus(obligation, asOf);
          const days = differenceInDays(asOf, obligation.dueDate);

          return (
            <li key={obligation.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{obligation.description}</p>
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  {status === "OVERDUE"
                    ? `Venceu em ${formatCalendarDate(obligation.dueDate)} · ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}`
                    : days === 0
                      ? "Vence hoje"
                      : `Vence em ${formatCalendarDate(obligation.dueDate)} · ${days} ${days === 1 ? "dia" : "dias"}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {status === "OVERDUE" ? <Badge tone="critical">Vencida</Badge> : null}
                <MoneyText value={obligation.amount} size="sm" tone="outflow" />
              </div>
            </li>
          );
        })}
      </ul>
      <Link
        href="/app/contas"
        className="mt-3 inline-block text-sm font-medium text-[color:var(--color-brand-700)] underline underline-offset-2"
      >
        Ver todas as contas
      </Link>
    </div>
  );
}
