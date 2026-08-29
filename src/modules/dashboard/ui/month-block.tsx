"use client";

import { formatCalendarDate, formatMonthKey } from "@/core/date/calendar-date";
import { add, isNegative, subtract } from "@/core/money/money";
import { Card, CardTitle, MoneyText, Stat } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * "Este mês" and "próximos 30 dias".
 *
 * The month block separates what has already happened from what is still
 * expected, because those are different kinds of certainty and merging them
 * makes a month look either better or worse than it is.
 */
export function MonthBlock() {
  const { overview } = useFinance();
  const { thisMonth } = overview;

  return (
    <Card aria-labelledby="mes-title">
      <CardTitle id="mes-title" hint={formatMonthKey(thisMonth.month)}>
        Este mês
      </CardTitle>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Receitas recebidas"
          value={thisMonth.incomeReceived}
          size="base"
          tone="positive"
        />
        <Stat
          label="Receitas previstas"
          value={thisMonth.incomeExpected}
          size="base"
          hint="Ainda não entraram."
        />
        <Stat label="Despesas pagas" value={thisMonth.expensesPaid} size="base" tone="outflow" />
        <Stat
          label="Despesas previstas"
          value={thisMonth.expensesPending}
          size="base"
          tone="outflow"
          hint="Ainda não saíram."
        />
      </dl>

      <div className="mt-5 border-t border-[color:var(--card-border)] pt-4">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Stat
            label="Faturas de cartão"
            value={thisMonth.cardCommitment}
            size="base"
            tone="outflow"
          />
          <Stat
            label="Parcelas de dívidas"
            value={thisMonth.debtCommitment}
            size="base"
            tone="outflow"
          />
          <Stat
            label="Resultado esperado"
            value={thisMonth.expectedResult}
            size="lg"
            tone={isNegative(thisMonth.expectedResult) ? "critical" : "positive"}
            hint={
              isNegative(thisMonth.expectedResult)
                ? "Os compromissos do mês superam o que entra."
                : "O que deve sobrar considerando tudo o que está previsto."
            }
          />
        </dl>
      </div>
    </Card>
  );
}

export function Next30DaysBlock() {
  const { overview } = useFinance();
  const { next30Days } = overview;

  return (
    <Card aria-labelledby="proximos-title">
      <CardTitle
        id="proximos-title"
        hint="Entradas e saídas previstas, dia a dia, considerando contas, faturas e parcelas."
      >
        Próximos 30 dias
      </CardTitle>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Vai entrar" value={next30Days.inflows} size="base" tone="positive" />
        <Stat label="Vai sair" value={next30Days.outflows} size="base" tone="outflow" />
        <Stat
          label="Já comprometido"
          value={next30Days.committed}
          size="base"
          tone="outflow"
          hint="Faturas, empréstimos e financiamentos."
        />
        <Stat
          label="Menor saldo previsto"
          value={next30Days.lowestProjectedBalance}
          size="base"
          tone={isNegative(next30Days.lowestProjectedBalance) ? "critical" : "neutral"}
          hint={`Em ${formatCalendarDate(next30Days.lowestProjectedBalanceDate)}`}
        />
      </dl>

      <p className="mt-4 text-sm" style={{ color: "var(--muted-fg)" }}>
        Saldo estimado ao fim do período:{" "}
        <MoneyText
          value={subtract(add(overview.today.totalCash, next30Days.inflows), next30Days.outflows)}
          size="sm"
        />
      </p>
    </Card>
  );
}
