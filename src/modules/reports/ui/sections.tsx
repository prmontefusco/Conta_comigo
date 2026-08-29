"use client";

import { useMemo, useState } from "react";
import { formatMonthKey, monthKeyOf, type MonthKey } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { add, isNegative, subtract, zero } from "@/core/money/money";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  ProgressBar,
  Stat,
} from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/form";
import { buildCategoryIndex, categoryName } from "@/modules/categories/domain/category";
import { useFinance } from "@/modules/household/ui/finance-provider";
import {
  averageOf,
  budgetHistory,
  cashFlowByMonth,
  commitmentsByNature,
  debtOutlook,
  spendingByCategory,
  spendingTrend,
  upcomingMonths,
} from "@/modules/reports/domain/reports";
import { BarList, MonthlyColumns, TrendLine, type BarListItem } from "./charts";

/**
 * The report sections.
 *
 * Each one is a self-contained answer to the question in its heading, reading
 * what it needs from the finance provider. Splitting them this way keeps the
 * page a thin composition and lets a section be understood - or replaced -
 * without reading the other five.
 */

interface SectionProps {
  readonly months: readonly MonthKey[];
  readonly hasHistory: boolean;
}

/* ------------------------------------------------------------------ */

export function CashFlowSection({ months, hasHistory }: SectionProps) {
  const finance = useFinance();

  const cashFlow = useMemo(
    () => cashFlowByMonth(finance.transactions, months),
    [finance.transactions, months],
  );

  const income = cashFlow.reduce((acc, month) => add(acc, month.income), zero());
  const spending = cashFlow.reduce((acc, month) => add(acc, month.spending), zero());
  const result = subtract(income, spending);

  return (
    <Card aria-labelledby="fluxo-title">
      <CardTitle
        id="fluxo-title"
        hint="Receitas e despesas por mês de competência, ou seja, pelo mês a que pertencem."
      >
        Quanto entrou e quanto saiu?
      </CardTitle>

      {!hasHistory ? (
        <EmptyState
          title="Nenhuma movimentação registrada"
          description="Assim que você marcar contas como pagas e receitas como recebidas, este bloco passa a comparar os meses."
        />
      ) : (
        <MonthlyColumns
          months={months}
          caption="Receitas e despesas por mês"
          series={[
            {
              key: "income",
              label: "Receitas",
              tone: "positive",
              values: cashFlow.map((month) => month.income),
            },
            {
              key: "spending",
              label: "Despesas",
              tone: "attention",
              values: cashFlow.map((month) => month.spending),
            },
          ]}
        />
      )}

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[color:var(--card-border)] pt-4 lg:grid-cols-3">
        <Stat label="Receitas no período" value={income} size="base" tone="positive" />
        <Stat label="Despesas no período" value={spending} size="base" tone="outflow" />
        <Stat
          label="Resultado"
          value={result}
          size="base"
          tone={isNegative(result) ? "critical" : "positive"}
        />
      </dl>

      <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
        Transferências entre suas contas não aparecem aqui: elas movimentam dinheiro sem alterar o
        que você tem. O mesmo vale para pagamentos de fatura, que já foram contabilizados como
        despesa no mês da compra.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function CategoriesSection({ months }: Pick<SectionProps, "months">) {
  const finance = useFinance();
  const currentMonth = monthKeyOf(finance.asOf);

  /**
   * Defaults to the most recent month that actually has something in it.
   *
   * Early in a month there is nothing registered yet, and an empty breakdown
   * would read as a household that spent nothing rather than a month that has
   * just started.
   */
  const [chosenMonth, setChosenMonth] = useState<MonthKey | null>(null);

  const defaultMonth = useMemo(() => {
    const withData = [...months]
      .reverse()
      .find(
        (month) =>
          spendingByCategory(finance.transactions, finance.obligations, month).total.amount > 0,
      );
    return withData ?? currentMonth;
  }, [months, finance.transactions, finance.obligations, currentMonth]);

  const selectedMonth = chosenMonth ?? defaultMonth;

  const breakdown = useMemo(
    () => spendingByCategory(finance.transactions, finance.obligations, selectedMonth),
    [finance.transactions, finance.obligations, selectedMonth],
  );

  const categoryIndex = buildCategoryIndex(finance.categories);

  return (
    <Card aria-labelledby="categorias-title">
      <CardTitle id="categorias-title">Para onde meu dinheiro foi?</CardTitle>

      <div className="mb-4 max-w-xs">
        <SelectField
          label="Mês"
          value={selectedMonth}
          onChange={(event) => setChosenMonth(event.target.value as MonthKey)}
          options={[...months].reverse().map((month) => ({
            value: month,
            label:
              month === currentMonth
                ? `${formatMonthKey(month)} (em andamento)`
                : formatMonthKey(month),
          }))}
        />
      </div>

      <BarList
        emptyLabel="Nenhuma despesa registrada neste mês ainda."
        items={breakdown.lines.slice(0, 10).map((line) => ({
          key: line.categoryId ?? "sem-categoria",
          label: categoryName(categoryIndex, line.categoryId ?? undefined),
          value: line.total,
          ratio: line.share,
          tone: line.share > 0.3 ? "attention" : "brand",
          caption: (
            <>
              {line.committed.amount > 0
                ? `${formatMoney(line.actual)} gastos · ${formatMoney(line.committed)} ainda a pagar`
                : `${formatMoney(line.actual)} gastos`}
              {line.changeFromPrevious.amount !== 0 ? (
                <>
                  {" · "}
                  {line.changeFromPrevious.amount > 0 ? "+" : "−"}
                  {formatMoney({
                    amount: Math.abs(line.changeFromPrevious.amount),
                    currency: "BRL",
                  })}{" "}
                  em relação ao mês anterior
                </>
              ) : null}
            </>
          ),
        }))}
      />

      {breakdown.total.amount > 0 ? (
        <p className="mt-4 border-t border-[color:var(--card-border)] pt-3 text-sm">
          Total do mês: <MoneyText value={breakdown.total} size="sm" tone="outflow" />
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function TrendSection({ months, hasHistory }: SectionProps) {
  const finance = useFinance();
  const [categoryFilter, setCategoryFilter] = useState("");

  const trend = useMemo(
    () => spendingTrend(finance.transactions, months, categoryFilter || undefined),
    [finance.transactions, months, categoryFilter],
  );

  const categoryIndex = buildCategoryIndex(finance.categories);
  const label = categoryFilter ? categoryName(categoryIndex, categoryFilter) : "Todas as despesas";

  return (
    <Card aria-labelledby="tendencia-title">
      <CardTitle
        id="tendencia-title"
        hint="Um mês isolado é anedota. Vários meses mostram um padrão."
      >
        Isso é sempre assim?
      </CardTitle>

      {!hasHistory ? (
        <EmptyState
          title="Ainda não dá para ver um padrão"
          description="Um padrão precisa de pelo menos alguns meses registrados. Continue marcando o que foi pago e este bloco começa a fazer sentido."
        />
      ) : (
        <>
          <div className="mb-4 max-w-sm">
            <SelectField
              label="Categoria"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              options={[
                { value: "", label: "Todas as despesas" },
                ...finance.categories
                  .filter((category) => category.kind === "EXPENSE" && !category.archived)
                  .map((category) => ({
                    value: category.id,
                    label: `${category.icon ?? ""} ${category.name}`.trim(),
                  })),
              ]}
            />
          </div>

          <MonthlyColumns
            months={months}
            caption={categoryFilter ? `Gastos mensais em ${label}` : "Gastos mensais totais"}
            series={[
              {
                key: "spending",
                label,
                tone: "brand",
                values: trend.map((point) => point.amount),
              },
            ]}
          />

          <p className="mt-4 text-sm" style={{ color: "var(--muted-fg)" }}>
            Média dos meses com movimento: <MoneyText value={averageOf(trend)} size="sm" />
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function NatureSection() {
  const finance = useFinance();
  const currentMonth = monthKeyOf(finance.asOf);

  const nature = useMemo(
    () => commitmentsByNature(finance.obligations, finance.recurringRules, currentMonth),
    [finance.obligations, finance.recurringRules, currentMonth],
  );

  return (
    <Card aria-labelledby="natureza-title">
      <CardTitle
        id="natureza-title"
        hint={`Compromissos de ${formatMonthKey(currentMonth)}, pela classificação que você deu a cada um.`}
      >
        Quanto do meu custo é obrigatório?
      </CardTitle>

      {nature.total.amount === 0 ? (
        <EmptyState
          title="Nenhum compromisso neste mês"
          description="Cadastre suas contas recorrentes para ver quanto do seu mês já está definido antes de qualquer escolha."
        />
      ) : (
        <>
          <BarList
            emptyLabel=""
            items={(
              [
                {
                  key: "fixed",
                  label: "Fixas",
                  value: nature.fixed,
                  ratio: nature.fixed.amount / nature.total.amount,
                  tone: "attention",
                  caption: "Não mudam de um mês para o outro.",
                },
                {
                  key: "variable",
                  label: "Variáveis",
                  value: nature.variable,
                  ratio: nature.variable.amount / nature.total.amount,
                  tone: "brand",
                  caption: "Acontecem todo mês, com valores diferentes.",
                },
                {
                  key: "occasional",
                  label: "Eventuais",
                  value: nature.occasional,
                  ratio: nature.occasional.amount / nature.total.amount,
                  tone: "positive",
                  caption: "Aparecem de vez em quando.",
                },
              ] satisfies BarListItem[]
            ).filter((item) => item.value.amount > 0)}
          />

          <p className="mt-5 border-t border-[color:var(--card-border)] pt-4 text-sm">
            <strong>{Math.round(nature.fixedShare * 100)}%</strong> dos compromissos deste mês são
            despesas fixas. Elas não respondem a mudanças de hábito no curto prazo; ajustar o
            orçamento normalmente começa pelas variáveis.
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function BudgetSection({ months }: Pick<SectionProps, "months">) {
  const finance = useFinance();

  const points = useMemo(
    () => budgetHistory(finance.budgets, finance.transactions, finance.obligations, months),
    [finance.budgets, finance.transactions, finance.obligations, months],
  );

  return (
    <Card aria-labelledby="orcamento-title">
      <CardTitle
        id="orcamento-title"
        hint="Planejado contra o que já saiu somado ao que ainda vai sair."
      >
        O orçamento está funcionando?
      </CardTitle>

      {points.every((point) => !point.hasBudget) ? (
        <EmptyState
          title="Nenhum orçamento definido ainda"
          description="Sem um valor planejado não há com o que comparar. Você pode começar por uma ou duas categorias."
        />
      ) : (
        <>
          <MonthlyColumns
            months={months}
            caption="Planejado contra realizado, por mês"
            series={[
              {
                key: "planned",
                label: "Planejado",
                tone: "muted",
                values: points.map((point) => point.planned),
              },
              {
                key: "used",
                label: "Gasto + comprometido",
                tone: "brand",
                values: points.map((point) => add(point.actual, point.committed)),
              },
            ]}
          />

          <ul className="mt-5 divide-y divide-[color:var(--card-border)] border-t border-[color:var(--card-border)]">
            {points
              .filter((point) => point.hasBudget)
              .slice(-4)
              .reverse()
              .map((point) => (
                <li key={point.month} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm">{formatMonthKey(point.month)}</span>
                  <span className="flex items-center gap-2">
                    {isNegative(point.difference) ? (
                      <Badge tone="attention">Acima do planejado</Badge>
                    ) : (
                      <Badge tone="positive">Dentro do planejado</Badge>
                    )}
                    <MoneyText
                      value={point.difference}
                      size="sm"
                      tone={isNegative(point.difference) ? "critical" : "positive"}
                      showSign
                    />
                  </span>
                </li>
              ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function DebtSection() {
  const finance = useFinance();

  const outlook = useMemo(
    () => debtOutlook(finance.debts, finance.cardStatements, upcomingMonths(finance.asOf, 13)),
    [finance.debts, finance.cardStatements, finance.asOf],
  );

  return (
    <Card aria-labelledby="divida-title">
      <CardTitle
        id="divida-title"
        hint="Considerando que você siga pagando as parcelas e faturas nas datas."
      >
        Estou reduzindo meu endividamento?
      </CardTitle>

      {outlook.startingTotal.amount === 0 ? (
        <EmptyState
          title="Sem dívidas registradas"
          description="Empréstimos, financiamentos e parcelas de cartão apareceriam aqui, com a data em que cada um termina."
        />
      ) : (
        <>
          <TrendLine
            months={outlook.points.map((point) => point.month)}
            values={outlook.points.map((point) => point.total)}
            caption="Total devido ao fim de cada mês"
            tone={outlook.reduction.amount > 0 ? "positive" : "attention"}
          />

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[color:var(--card-border)] pt-4 lg:grid-cols-3">
            <Stat label="Devido hoje" value={outlook.startingTotal} size="base" tone="outflow" />
            <Stat
              label="Em 12 meses"
              value={outlook.endingTotal}
              size="base"
              tone={outlook.reduction.amount > 0 ? "positive" : "critical"}
            />
            <Stat
              label="Juros ainda a pagar"
              value={outlook.totalInterestRemaining}
              size="base"
              tone="outflow"
              hint="Só nos contratos com taxa informada."
            />
          </dl>

          <p className="mt-4 text-sm">
            {outlook.reduction.amount > 0 ? (
              <>
                Seguindo os contratos atuais, a dívida cai{" "}
                <MoneyText value={outlook.reduction} size="sm" tone="positive" /> em doze meses.
              </>
            ) : outlook.reduction.amount === 0 ? (
              <>Seguindo os contratos atuais, a dívida permanece no mesmo patamar em doze meses.</>
            ) : (
              <>
                Seguindo os contratos atuais, a dívida cresce{" "}
                <MoneyText value={subtract(zero(), outlook.reduction)} size="sm" tone="critical" />{" "}
                em doze meses.
              </>
            )}
          </p>

          <div className="mt-4">
            <ProgressBar
              ratio={Math.max(0, outlook.endingTotal.amount / outlook.startingTotal.amount)}
              label="Proporção da dívida que ainda restará em doze meses"
              tone={outlook.reduction.amount > 0 ? "positive" : "attention"}
            />
          </div>

          {outlook.endings.length > 0 ? (
            <div className="mt-5 border-t border-[color:var(--card-border)] pt-4">
              <h3 className="text-sm font-semibold">Quando cada dívida termina</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {outlook.endings.map((ending) => (
                  <li
                    key={`${ending.description}-${ending.month}`}
                    className="flex justify-between gap-3"
                  >
                    <span className="min-w-0 truncate">{ending.description}</span>
                    <span style={{ color: "var(--muted-fg)" }}>{formatMonthKey(ending.month)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
                A partir de cada uma dessas datas, o valor da parcela deixa de comprometer o mês.
              </p>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
