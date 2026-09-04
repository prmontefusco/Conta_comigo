"use client";

import { formatMonthKey, formatMonthShort } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { isNegative } from "@/core/money/money";
import { Badge, Card, CardTitle, MoneyText, ScrollableX } from "@/components/ui/primitives";
import type { ForecastMonth } from "@/modules/forecast/domain/forecast-types";

/**
 * The months view.
 *
 * This is the screen the product exists for: a month that will not close is
 * visible now, not when it arrives. The wording states the gap and its size
 * and stops there - no advice, no verdict on the household
 * (docs/PRODUCT.md sections 11 and 31).
 */
export function MonthsTable({
  months,
  limit = 12,
  title = "Próximos meses",
}: {
  months: readonly ForecastMonth[];
  limit?: number;
  title?: string;
}) {
  const visible = months.slice(0, limit);
  const firstDeficit = visible.find((month) => month.isDeficit && !month.isPartial);
  const hasPartialMonth = visible.some((month) => month.isPartial);

  return (
    <Card aria-labelledby="meses-title">
      <CardTitle
        id="meses-title"
        hint="Receitas previstas contra compromissos já assumidos, mês a mês."
      >
        {title}
      </CardTitle>

      {firstDeficit ? (
        <p
          className="mb-4 rounded-lg border-l-4 border-[color:var(--color-attention-600)] bg-[color:var(--color-attention-100)] p-3 text-sm text-[color:var(--color-ink-900)]"
          role="note"
        >
          Os compromissos previstos superam as receitas de{" "}
          <strong>{formatMonthKey(firstDeficit.month)}</strong> em{" "}
          <strong className="tabular">{formatMoney(firstDeficit.deficitAmount)}</strong>.
        </p>
      ) : null}

      {/* Wide table scrolls inside its own container; the page never does. */}
      <ScrollableX label="Projeção mensal" className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">
            Projeção mensal de receitas, compromissos e saldo livre
          </caption>
          <thead>
            <tr className="border-b border-[color:var(--card-border)] text-left">
              <th scope="col" className="py-2 pr-3 font-medium">
                Mês
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Receitas
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Compromissos
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Sendo dívida
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Sobra
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((month) => (
              <tr
                key={month.month}
                className={
                  month.isDeficit && !month.isPartial
                    ? "border-b border-[color:var(--card-border)] bg-[color:var(--color-attention-100)]/40"
                    : "border-b border-[color:var(--card-border)]"
                }
              >
                <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                  <span className="uppercase">{formatMonthShort(month.month)}</span>
                  <span className="ml-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                    {month.month.slice(0, 4)}
                  </span>
                  {month.isPartial ? (
                    <span className="ml-2 align-middle">
                      <Badge>o que resta</Badge>
                    </span>
                  ) : month.isDeficit ? (
                    <span className="ml-2 align-middle">
                      <Badge tone="attention">Déficit</Badge>
                    </span>
                  ) : null}
                </th>
                <td className="py-2.5 pr-3 text-right">
                  <MoneyText value={month.expectedInflows} size="sm" tone="positive" />
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <MoneyText value={month.committedOutflows} size="sm" tone="outflow" />
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <MoneyText value={month.debtCommitment} size="sm" tone="outflow" />
                </td>
                <td className="py-2.5 text-right">
                  <MoneyText
                    value={month.net}
                    size="sm"
                    tone={isNegative(month.net) ? "critical" : "positive"}
                    showSign
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableX>

      <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
        {hasPartialMonth ? (
          <>
            O primeiro mês mostra apenas o que ainda falta acontecer nele: receitas já recebidas e
            contas já pagas não entram nessa linha.{" "}
          </>
        ) : null}
        A projeção considera contas recorrentes, parcelas de cartão, empréstimos e financiamentos já
        registrados. Despesas e receitas marcadas como estimadas (como água e luz calculadas pela
        média recente) entram no cálculo como referência, mantendo sua previsão realista.
      </p>
    </Card>
  );
}
