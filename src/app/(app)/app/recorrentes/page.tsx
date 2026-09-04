"use client";

import { useState } from "react";
import {
  formatCalendarDate,
  frequencyLabel,
  nextOccurrenceLabel,
} from "@/modules/recurring/ui/labels";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  Spinner,
} from "@/components/ui/primitives";
import { formatMoney } from "@/core/money/format";
import type { Money } from "@/core/money/money";
import { NewObligationDialog } from "@/modules/obligations/ui/new-obligation-dialog";
import { FinancialInsightCard } from "@/modules/education/ui/financial-insight-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";
import { estimateVariableExpense } from "@/modules/recurring/domain/variable-expense-estimator";

/**
 * Recurring income and bills.
 *
 * A rule is a description of the future, not a pile of documents. Pausing one
 * immediately changes every projection that depended on it.
 */
export default function RecurringPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const collections = useCollections();
  const [creating, setCreating] = useState(false);

  if (finance.loading) return <Spinner label="Carregando suas recorrências" />;

  const income = finance.recurringRules.filter((rule) => rule.direction === "INFLOW");
  const bills = finance.recurringRules.filter((rule) => rule.direction === "OUTFLOW");

  async function toggle(ruleId: string, active: boolean) {
    await collections.recurringRules.update(ruleId, { active } as never);
  }

  async function updateAmount(ruleId: string, amount: Money) {
    await collections.recurringRules.update(ruleId, {
      amount,
      expenseNature: "VARIABLE",
      confidence: "ESTIMATED",
    } as never);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Recorrências</h1>
        {canWrite ? <Button onClick={() => setCreating(true)}>Nova regra recorrente</Button> : null}
      </div>

      <FinancialInsightCard
        tag="Renda e Previsibilidade"
        title="Como Lidar com Renda e Despesas Variáveis"
        description="Contas como água, luz e gás mudam de valor todo mês. Calibrar sua projeção pela média recente é o que mantém o fluxo de caixa realista."
        tips={[
          "Contas variáveis (água, luz, gás): cadastre a regra com a média dos últimos meses e confira a sugestão de calibração automática abaixo.",
          "Calibre suas despesas essenciais pelo seu mês mais baixo: viva com o valor mínimo seguro para nunca depender de comissões incertas.",
          "Nos meses de renda alta ou faturas menores: use o excedente para fortalecer sua Reserva de Respiro.",
        ]}
        helpTopic="Adicione contas fixas e variáveis como 'Despesa Recorrente'. O sistema compara com os pagamentos dos meses anteriores e permite calibrar a média em um clique."
      />

      {finance.recurringRules.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma recorrência cadastrada"
            description="Salário, aluguel, internet, escola. São elas que permitem projetar os próximos meses."
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>Nova recorrência</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <RuleGroup
            title="Entradas"
            rules={income}
            asOf={finance.asOf}
            transactions={finance.transactions}
            obligations={finance.obligations}
            canWrite={canWrite}
            onToggle={toggle}
            onUpdateAmount={updateAmount}
          />
          <RuleGroup
            title="Saídas"
            rules={bills}
            asOf={finance.asOf}
            transactions={finance.transactions}
            obligations={finance.obligations}
            canWrite={canWrite}
            onToggle={toggle}
            onUpdateAmount={updateAmount}
          />
        </>
      )}

      <NewObligationDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function RuleGroup({
  title,
  rules,
  asOf,
  transactions,
  obligations,
  canWrite,
  onToggle,
  onUpdateAmount,
}: {
  title: string;
  rules: ReturnType<typeof useFinance>["recurringRules"];
  asOf: ReturnType<typeof useFinance>["asOf"];
  transactions: ReturnType<typeof useFinance>["transactions"];
  obligations: ReturnType<typeof useFinance>["obligations"];
  canWrite: boolean;
  onToggle: (ruleId: string, active: boolean) => Promise<void>;
  onUpdateAmount: (ruleId: string, amount: Money) => Promise<void>;
}) {
  if (rules.length === 0) return null;

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <ul className="divide-y divide-[color:var(--card-border)]">
        {rules.map((rule) => {
          const isOutflow = rule.direction === "OUTFLOW";
          const estimate = isOutflow
            ? estimateVariableExpense({
                transactions,
                obligations,
                asOf,
                categoryId: rule.categoryId,
                recurringRuleId: rule.id,
                searchTerms: [rule.description],
                lookbackMonths: 3,
              })
            : null;

          const hasRecentData = Boolean(estimate?.hasSufficientData);
          const hasDiff =
            hasRecentData && estimate && estimate.average.amount !== rule.amount.amount;

          return (
            <li
              key={rule.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{rule.description}</p>
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  {frequencyLabel(rule)}
                  {rule.dayOfMonth ? ` · dia ${rule.dayOfMonth}` : ""} ·{" "}
                  {nextOccurrenceLabel(rule, asOf)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {!rule.active ? <Badge tone="neutral">Pausada</Badge> : null}
                  {rule.expenseNature === "VARIABLE" ? <Badge>Variável</Badge> : null}
                  {rule.confidence === "ESTIMATED" ? <Badge>Estimada</Badge> : null}
                  {rule.endDate ? <Badge>Até {formatCalendarDate(rule.endDate)}</Badge> : null}
                  {hasRecentData && estimate ? (
                    <span className="text-xs text-[color:var(--muted-fg)]">
                      · Média recente ({estimate.sampleCount}m):{" "}
                      <strong>{formatMoney(estimate.average)}</strong>
                    </span>
                  ) : null}
                </div>

                {hasDiff && canWrite && estimate ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => void onUpdateAmount(rule.id, estimate.average)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--color-brand-300)] bg-[color:var(--color-brand-50)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-brand-700)] transition hover:bg-[color:var(--color-brand-100)] dark:border-[color:var(--color-brand-800)] dark:bg-[color:var(--color-brand-950)]/50 dark:text-[color:var(--color-brand-300)]"
                    >
                      ⚡ Calibrar para média recente ({formatMoney(estimate.average)})
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <MoneyText
                  value={rule.amount}
                  size="sm"
                  tone={rule.direction === "INFLOW" ? "positive" : "outflow"}
                />
                {canWrite ? (
                  <Button
                    variant="secondary"
                    className="mt-1 block w-full text-xs"
                    onClick={() => void onToggle(rule.id, !rule.active)}
                  >
                    {rule.active ? "Pausar" : "Retomar"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
