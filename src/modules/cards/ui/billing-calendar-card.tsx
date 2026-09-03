"use client";

import { useMemo } from "react";
import { formatCalendarDate, formatMonthKey, monthKeyOf } from "@/core/date/calendar-date";
import { Badge, Card, CardTitle, EmptyState, MoneyText } from "@/components/ui/primitives";
import { billingSchedule } from "@/modules/cards/domain/credit-card";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * What every card bills, month by month.
 *
 * A household with three cards has three closing dates, and no single fatura
 * ever answers "quanto o cartão vai custar em março". This table does, per
 * card and summed, for as far ahead as the instalments already made reach.
 */
export function BillingCalendarCard({ months = 12 }: { months?: number }) {
  const finance = useFinance();

  const schedule = useMemo(
    () =>
      billingSchedule(
        finance.cards.filter((card) => !card.archived),
        finance.cardStatements,
        monthKeyOf(finance.asOf),
        months,
      ),
    [finance.cards, finance.cardStatements, finance.asOf, months],
  );

  const currentMonth = monthKeyOf(finance.asOf);

  if (schedule.length === 0) {
    return (
      <Card>
        <CardTitle>O que vai ser faturado</CardTitle>
        <EmptyState
          title="Nenhuma fatura à frente"
          description="Assim que houver compras nos cartões, os próximos meses aparecem aqui, com o total de cada cartão e a soma de todos."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle hint="Somando todos os cartões, com o que já está parcelado.">
        O que vai ser faturado, mês a mês
      </CardTitle>

      <ul className="space-y-4">
        {schedule.map((month) => (
          <li key={month.month}>
            <div className="flex items-baseline justify-between gap-3 border-b border-[color:var(--card-border)] pb-1">
              <h3 className="text-sm font-semibold">
                {formatMonthKey(month.month)}
                {month.month === currentMonth ? (
                  <span className="ml-2 align-middle">
                    <Badge tone="brand">Mês atual</Badge>
                  </span>
                ) : null}
              </h3>
              <MoneyText value={month.total} size="sm" tone="outflow" />
            </div>

            <ul className="mt-1">
              {month.cards.map((line) => (
                <li
                  key={line.creditCardId}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{line.cardName}</p>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      vence {formatCalendarDate(line.dueDate)} · {line.entryCount}{" "}
                      {line.entryCount === 1 ? "lançamento" : "lançamentos"}
                      {line.settled ? " · paga" : ""}
                    </p>
                  </div>
                  <MoneyText
                    value={line.total}
                    size="sm"
                    tone={line.settled ? "neutral" : "outflow"}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
        Os meses à frente já contam as parcelas das compras que você fez. Uma compra nova entra aqui
        no mesmo instante.
      </p>
    </Card>
  );
}
