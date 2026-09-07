"use client";

import Link from "next/link";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Card } from "@/components/ui/primitives";
import { alertActionLabel, alertAppHref } from "@/modules/alerts/domain/alert-actions";
import type { AlertSeverity } from "@/modules/alerts/domain/alerts";
import { buildTodayPriorities } from "@/modules/dashboard/domain/today-priorities";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * "Atenção agora": a primeira coisa que se vê depois de entrar.
 *
 * Antes disto, a tela inicial abria com o painel de saúde financeira e a
 * projeção, e os avisos vinham depois. Para quem está com a luz para cortar,
 * a informação certa estava a uma rolagem de distância da errada.
 *
 * Nenhum aviso é calculado aqui. A lista vem de `buildTodayPriorities`, os
 * botões vêm de `alert-actions` — os mesmos que o sininho e a caixa de avisos
 * usam. Se um dia o rótulo de uma ação mudar, muda nos três ao mesmo tempo.
 */

const SEVERITY_STYLE: Record<Exclude<AlertSeverity, "INFO">, { bar: string; chip: string }> = {
  URGENT: {
    bar: "border-l-[color:var(--color-critical-600)] bg-[color:var(--color-critical-100)]",
    chip: "text-[color:var(--color-critical-700)]",
  },
  ATTENTION: {
    bar: "border-l-[color:var(--color-attention-600)] bg-[color:var(--color-attention-100)]",
    chip: "text-[color:var(--color-attention-700)]",
  },
};

export function TodayPrioritiesCard() {
  const finance = useFinance();
  const priorities = buildTodayPriorities({ alerts: finance.alerts });

  if (priorities.items.length === 0) {
    return (
      <Card aria-labelledby="atencao-agora-title">
        <h2 id="atencao-agora-title" className="text-lg font-semibold">
          Nada pedindo atenção agora
        </h2>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted-fg)" }}>
          Pelos dados registrados até aqui, não há conta vencida, fatura estourando nem mês fechando
          no vermelho. Isso pode mudar quando um valor novo entrar — e, quando mudar, aparece aqui.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuietLink href="/app/plano">Ver o plano de ação</QuietLink>
          <QuietLink href="/app/decisoes">Registrar uma decisão</QuietLink>
          <QuietLink href="/app/avisos">Abrir a caixa de avisos</QuietLink>
        </div>
      </Card>
    );
  }

  return (
    <Card
      aria-labelledby="atencao-agora-title"
      className="border-l-4 border-l-[color:var(--color-critical-600)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="atencao-agora-title" className="text-lg font-semibold">
            Atenção agora
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--muted-fg)" }}>
            {priorities.urgentCount > 0
              ? "Comece por aqui. Cada linha leva direto ao lugar onde dá para resolver."
              : "Nada em atraso. Estes pontos ainda dá tempo de tratar com calma."}
          </p>
        </div>
        <Link
          href="/app/avisos"
          className="text-sm font-semibold text-[color:var(--color-brand-700)] underline-offset-2 hover:underline"
        >
          Ver todos os avisos
        </Link>
      </div>

      <ol className="mt-3 space-y-2.5">
        {priorities.items.map(({ alert, label }, index) => {
          const style = SEVERITY_STYLE[alert.severity === "URGENT" ? "URGENT" : "ATTENTION"];

          return (
            <li
              key={alert.id}
              className={`rounded-lg border-l-4 p-3 text-[color:var(--color-ink-900)] ${style.bar}`}
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={`text-xs font-bold tracking-wide uppercase ${style.chip}`}>
                    <span className="sr-only">Prioridade {index + 1}: </span>
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-medium">{alert.message}</p>
                  {alert.date || alert.amount ? (
                    <p className="mt-0.5 text-xs opacity-80">
                      {alert.date ? formatCalendarDate(alert.date) : null}
                      {alert.date && alert.amount ? " · " : null}
                      {alert.amount ? formatMoney(alert.amount) : null}
                    </p>
                  ) : null}
                </div>

                <Link
                  href={alertAppHref(alert)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] px-3 py-2 text-sm font-semibold text-white shadow-2xs transition hover:bg-[color:var(--color-brand-700)]"
                >
                  {alertActionLabel(alert)}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {priorities.hidden > 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            {priorities.hidden === 1
              ? "Mais 1 aviso na caixa de avisos."
              : `Mais ${priorities.hidden} avisos na caixa de avisos.`}
          </p>
        ) : null}
        <QuietLink href="/app/decisoes">Registrar o que a família decidiu</QuietLink>
      </div>
    </Card>
  );
}

function QuietLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center rounded-lg border border-[color:var(--card-border)] px-3 text-sm font-semibold text-[color:var(--color-brand-700)] transition hover:bg-[color:var(--color-surface-sunken)]"
    >
      {children}
    </Link>
  );
}
