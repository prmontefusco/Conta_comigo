"use client";

import Link from "next/link";
import { formatMoney } from "@/core/money/format";
import type { PlanFeasibility } from "@/modules/recovery-timeline/domain/recovery-calculator";

/**
 * What the app says when the plan does not close.
 *
 * This is the screen the product was missing. Before it, a household whose
 * income did not cover its minimum instalments was handed a payoff date built
 * on money it had told us it did not have - the most comforting number on the
 * page and the only one that was false.
 *
 * The replacement is not a warning badge. It is a different instruction: when
 * the arithmetic says the month cannot be made to work by paying harder, the
 * next move is to change the contracts, and the app should say so and point at
 * the screen that helps do it.
 */
export function PlanViabilityNotice({ feasibility }: { feasibility: PlanFeasibility }) {
  if (feasibility.viability === "ON_TRACK") return null;

  const tight = feasibility.viability === "TIGHT";

  return (
    <div
      role="note"
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        borderColor: tight ? "var(--tone-attention)" : "var(--tone-critical)",
        background: "var(--card-bg)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-2xs rounded-md px-2 py-0.5 font-bold tracking-wider uppercase"
          style={{
            color: tight ? "var(--tone-attention)" : "var(--tone-critical)",
            background: "var(--color-surface-sunken)",
          }}
        >
          {tight ? "Sem folga" : "Este plano não fecha"}
        </span>
      </div>

      <p className="mt-2.5 text-sm font-semibold">
        {tight
          ? "As parcelas cabem, mas não sobra nada para adiantar."
          : `Com o que entra hoje, faltam ${formatMoney(feasibility.monthlyShortfall)} por mês só para pagar as parcelas mínimas.`}
      </p>

      <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
        {tight ? (
          <>
            Pagar só o mínimo deixa a dívida andar devagar e reduz a margem para imprevistos. Antes
            de comprimir ainda mais o mês, vale tentar prazo maior nas parcelas — sobra vira
            respiro, não só antecipação.
          </>
        ) : (
          <>
            Não é julgamento: a conta não fecha por aritmética. Comprimir ainda mais o mês não
            resolve uma diferença desse tamanho, e pagar uma parcela deixando outra vencer só troca
            a dívida de lugar.{" "}
            <strong style={{ color: "var(--page-fg)" }}>
              O caminho aqui é renegociar prazo, não pagar mais rápido.
            </strong>
          </>
        )}
      </p>

      <dl className="mt-3.5 grid grid-cols-2 gap-3 border-t border-[color:var(--card-border)] pt-3 sm:grid-cols-3">
        <div>
          <dt className="text-2xs font-medium" style={{ color: "var(--muted-fg)" }}>
            Sobra para dívidas
          </dt>
          <dd className="tabular mt-0.5 text-sm font-semibold">
            {formatMoney(feasibility.monthlyCapacity)}
          </dd>
        </div>
        <div>
          <dt className="text-2xs font-medium" style={{ color: "var(--muted-fg)" }}>
            Parcelas mínimas pedem
          </dt>
          <dd className="tabular mt-0.5 text-sm font-semibold">
            {formatMoney(feasibility.requiredMinimums)}
          </dd>
        </div>
        {!tight ? (
          <div>
            <dt className="text-2xs font-medium" style={{ color: "var(--muted-fg)" }}>
              Falta por mês
            </dt>
            <dd
              className="tabular mt-0.5 text-sm font-semibold"
              style={{ color: "var(--tone-critical)" }}
            >
              {formatMoney(feasibility.monthlyShortfall)}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/app/negociar"
          className="inline-flex min-h-10 items-center rounded-xl bg-[color:var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[color:var(--color-brand-700)]"
        >
          Preparar a renegociação
        </Link>
        <Link
          href="/app/emergencia"
          className="inline-flex min-h-10 items-center rounded-xl border border-[color:var(--card-border)] px-4 text-sm font-semibold transition hover:border-[color:var(--color-brand-600)]"
        >
          O que pagar primeiro este mês
        </Link>
      </div>
    </div>
  );
}

/**
 * A horizon that may not exist.
 *
 * Every date on the recovery screens is conditional on the plan closing, so
 * they all need the same fallback - and it must not look like a number. An
 * em-dash with an explanation beats "0 meses", which reads as good news.
 */
export function HorizonStat({
  label,
  months,
  dateLabel,
  tone = "default",
}: {
  label: string;
  months: number | null;
  dateLabel: string | null;
  tone?: "default" | "brand" | "positive";
}) {
  const color =
    tone === "brand"
      ? "var(--color-brand-700)"
      : tone === "positive"
        ? "var(--color-positive-700)"
        : "var(--page-fg)";

  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
        {label}
      </dt>
      <dd className="mt-1">
        {months === null ? (
          <>
            <span className="text-xl font-bold" style={{ color: "var(--muted-fg)" }}>
              —
            </span>
            <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              Sem data enquanto o mês não fechar
            </p>
          </>
        ) : (
          <>
            <span className="tabular text-xl font-bold" style={{ color }}>
              {months} {months === 1 ? "mês" : "meses"}
            </span>
            {dateLabel ? (
              <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                Previsão: {dateLabel}
              </p>
            ) : null}
          </>
        )}
      </dd>
    </div>
  );
}
