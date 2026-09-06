"use client";

import { useMemo } from "react";
import { formatMoney } from "@/core/money/format";
import { Card, CardTitle, ProgressBar, Stat } from "@/components/ui/primitives";
import {
  buildDebtCountdown,
  hasProgressToShow,
  progressPercent,
} from "@/modules/recovery-timeline/domain/debt-countdown";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * A dívida caindo.
 *
 * O painel dizia quanto se deve e quando acaba. Faltava a única coisa que
 * sustenta alguém no meio de vinte e dois meses de parcela: **está
 * diminuindo, e quanto**.
 *
 * Quando não há o que comemorar, este cartão não comemora. Sem movimento no
 * período ele mostra apenas o saldo e o quanto falta — um "R$ 0,00 pagos nos
 * últimos meses" em destaque seria desânimo com aparência de dado.
 */
export function DebtCountdownCard() {
  const finance = useFinance();

  const countdown = useMemo(
    () =>
      buildDebtCountdown({
        asOf: finance.asOf,
        debts: finance.debts,
        paidDebtInstallments: finance.paidDebtInstallments,
      }),
    [finance.asOf, finance.debts, finance.paidDebtInstallments],
  );

  if (finance.loading || countdown.current.amount <= 0) return null;

  const percent = progressPercent(countdown);
  const showProgress = hasProgressToShow(countdown);
  const grew = countdown.paidDown !== null && countdown.paidDown.amount < 0;

  return (
    <Card>
      <CardTitle hint="Comparado com três meses atrás.">Sua dívida está caindo</CardTitle>

      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Falta pagar" value={countdown.current} size="base" tone="outflow" />

        {showProgress ? (
          <div>
            <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
              Você derrubou
            </dt>
            <dd
              className="tabular mt-1 text-lg font-bold"
              style={{ color: "var(--color-positive-700)" }}
            >
              − {formatMoney(countdown.paidDown!)}
              <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                nos últimos três meses
              </p>
            </dd>
          </div>
        ) : null}

        {grew ? (
          <div>
            <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
              No período, cresceu
            </dt>
            <dd
              className="tabular mt-1 text-lg font-bold"
              style={{ color: "var(--tone-critical)" }}
            >
              + {formatMoney({ ...countdown.paidDown!, amount: -countdown.paidDown!.amount })}
            </dd>
          </div>
        ) : null}

        <div>
          <dt className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
            Parcelas
          </dt>
          <dd className="tabular mt-1 text-lg font-bold">
            {countdown.installmentsPaid} pagas
            <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              faltam {countdown.installmentsLeft}
            </p>
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <ProgressBar ratio={countdown.progress} label="Quanto da dívida já foi amortizado" />
        <p className="text-2xs mt-1.5" style={{ color: "var(--muted-fg)" }}>
          {percent}% do que foi contratado já saiu do caminho.
        </p>
      </div>

      {countdown.nextToClear ? (
        <p className="mt-3 border-t border-[color:var(--card-border)] pt-3 text-sm">
          A mais perto de acabar é <strong>{countdown.nextToClear.description}</strong>:{" "}
          {countdown.nextToClear.installmentsLeft}{" "}
          {countdown.nextToClear.installmentsLeft === 1 ? "parcela" : "parcelas"} e ela sai da sua
          vida.
        </p>
      ) : null}
    </Card>
  );
}
