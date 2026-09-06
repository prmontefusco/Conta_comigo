"use client";

import { useMemo } from "react";
import { formatMonthKey } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Card, CardTitle, Stat } from "@/components/ui/primitives";
import { buildCommittedInstallments } from "@/modules/cards/domain/committed-installments";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * Quanto dos próximos meses já tem dono.
 *
 * A lista de parcelamentos mostra uma compra por linha, e é fácil olhar cada
 * uma e achar pequena. O que muda a decisão da próxima compra é a soma — e o
 * mês em que ela finalmente alivia.
 *
 * Nada aqui repreende as compras já feitas: quem parcelou tinha um motivo, e
 * quase sempre era não ter o dinheiro à vista. O tempo verbal é o futuro.
 */
export function CommittedMonthsCard({ cardId }: { cardId?: string }) {
  const finance = useFinance();

  const committed = useMemo(
    () =>
      buildCommittedInstallments({
        cards: cardId ? finance.cards.filter((card) => card.id === cardId) : finance.cards,
        purchases: finance.cardPurchases,
        asOf: finance.asOf,
      }),
    [finance.cards, finance.cardPurchases, finance.asOf, cardId],
  );

  if (committed.totalRemaining.amount === 0) return null;

  const peak = committed.heaviestMonth;
  const withCharges = committed.months.filter((month) => month.amount.amount > 0);
  const max = peak?.amount.amount ?? 1;

  return (
    <Card>
      <CardTitle hint="Somando todas as compras parceladas, mês a mês.">
        O que dos próximos meses já está comprometido
      </CardTitle>

      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat
          label="Ainda será cobrado"
          value={committed.totalRemaining}
          size="base"
          tone="outflow"
        />
        <Stat
          label="Por mês, em média"
          value={committed.averageWhileCommitted}
          size="base"
          tone="outflow"
        />
        <div>
          <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
            Alivia a partir de
          </dt>
          <dd className="mt-1 text-lg font-bold">
            {committed.firstFreeMonth ? (
              formatMonthKey(committed.firstFreeMonth)
            ) : (
              <span style={{ color: "var(--muted-fg)" }}>—</span>
            )}

            <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              {committed.firstFreeMonth
                ? "primeiro mês sem parcela"
                : "há parcela em todos os meses à frente"}
            </p>
          </dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-1.5 border-t border-[color:var(--card-border)] pt-4">
        {withCharges.map((month) => (
          <li key={month.month} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs" style={{ color: "var(--muted-fg)" }}>
              {formatMonthKey(month.month)}
            </span>

            <span
              className="h-2.5 shrink-0 rounded-full"
              style={{
                width: `${Math.max(4, Math.round((month.amount.amount / max) * 100))}%`,
                background:
                  month.month === peak?.month ? "var(--tone-attention)" : "var(--color-brand-600)",
              }}
              aria-hidden="true"
            />

            <span className="tabular ml-auto shrink-0 text-xs font-medium">
              {formatMoney(month.amount)}
            </span>
            <span
              className="text-2xs w-16 shrink-0 text-right"
              style={{ color: "var(--muted-fg)" }}
            >
              {month.purchaseCount} {month.purchaseCount === 1 ? "compra" : "compras"}
            </span>
          </li>
        ))}
      </ul>

      {peak ? (
        <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
          O mês mais pesado é {formatMonthKey(peak.month)}, com {formatMoney(peak.amount)} em
          parcelas. Vale conferir se as contas desse mês cabem antes de assumir um parcelamento
          novo.
        </p>
      ) : null}
    </Card>
  );
}
