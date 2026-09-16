"use client";

import { formatMoney } from "@/core/money/format";
import { Badge, Button, Card, CardTitle, EmptyState, MoneyText } from "@/components/ui/primitives";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import { estimateVariableExpense } from "@/modules/recurring/domain/variable-expense-estimator";
import { frequencyLabel, nextOccurrenceLabel } from "@/modules/recurring/ui/labels";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

export function RecurringPatternsCard({
  direction,
  onCreate,
  onEdit,
}: {
  direction: "OUTFLOW" | "INFLOW";
  onCreate: () => void;
  onEdit: (rule: RecurringRule) => void;
}) {
  const finance = useFinance();
  const { canWrite } = useSession();
  const collections = useCollections();
  const rules = finance.recurringRules.filter((rule) => rule.direction === direction);

  async function toggle(rule: RecurringRule) {
    await collections.recurringRules.update(rule.id, { active: !rule.active } as never);
  }

  return (
    <Card>
      <CardTitle hint="Estes padrões alimentam a projeção. Eles não criam várias contas a pagar antecipadamente.">
        {direction === "OUTFLOW" ? "Padrões das contas" : "Padrões dos recebimentos"}
      </CardTitle>
      <p className="mb-3 text-sm text-[color:var(--muted-fg)]">
        {direction === "OUTFLOW"
          ? "Contas fixas repetem o valor informado. Nas variáveis, como energia, a previsão usa automaticamente a média dos últimos três meses completos."
          : "Recebimentos recorrentes ajudam a estimar o dinheiro disponível nos próximos meses."}
      </p>

      {rules.length === 0 ? (
        <EmptyState
          title="Nenhum padrão cadastrado"
          description="Ao cadastrar uma nova conta, escolha que ela se repete para incluí-la aqui e na projeção."
          action={
            canWrite ? <Button onClick={onCreate}>Cadastrar conta recorrente</Button> : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-[color:var(--card-border)]">
          {rules.map((rule) => {
            const estimate =
              direction === "OUTFLOW" && rule.expenseNature === "VARIABLE"
                ? estimateVariableExpense({
                    transactions: finance.transactions,
                    obligations: finance.obligations,
                    asOf: finance.asOf,
                    categoryId: rule.categoryId,
                    recurringRuleId: rule.id,
                    searchTerms: [rule.description],
                    lookbackMonths: 3,
                    safetyMarginPercent: 0,
                  })
                : null;
            const forecastAmount = estimate?.hasSufficientData ? estimate.average : rule.amount;

            return (
              <li key={rule.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{rule.description}</p>
                  <p className="text-xs text-[color:var(--muted-fg)]">
                    {frequencyLabel(rule)} · {nextOccurrenceLabel(rule, finance.asOf)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {!rule.active ? <Badge tone="neutral">Pausada</Badge> : null}
                    {rule.expenseNature === "VARIABLE" ? (
                      <Badge>Variável</Badge>
                    ) : (
                      <Badge>Fixa</Badge>
                    )}
                    {estimate?.hasSufficientData ? (
                      <Badge tone="positive">
                        Média de {estimate.sampleCount}{" "}
                        {estimate.sampleCount === 1 ? "mês" : "meses"}:{" "}
                        {formatMoney(estimate.average)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[color:var(--muted-fg)]">Valor na previsão</p>
                  <MoneyText
                    value={forecastAmount}
                    size="sm"
                    tone={direction === "INFLOW" ? "positive" : "outflow"}
                  />
                  {canWrite ? (
                    <div className="mt-1 flex justify-end gap-1">
                      <Button variant="ghost" className="text-xs" onClick={() => onEdit(rule)}>
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-xs"
                        onClick={() => void toggle(rule)}
                      >
                        {rule.active ? "Pausar" : "Retomar"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
