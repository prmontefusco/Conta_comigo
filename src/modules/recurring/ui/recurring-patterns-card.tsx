"use client";

import { formatMoney } from "@/core/money/format";
import { Badge, Button, Card, CardTitle, EmptyState, MoneyText } from "@/components/ui/primitives";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import { estimateVariableExpense } from "@/modules/recurring/domain/variable-expense-estimator";
import { frequencyLabel, nextOccurrenceLabel } from "@/modules/recurring/ui/labels";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";
import { useState } from "react";

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
  const [showRules, setShowRules] = useState(false);

  async function toggle(rule: RecurringRule) {
    await collections.recurringRules.update(rule.id, { active: !rule.active } as never);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>
            {direction === "OUTFLOW" ? "Contas que se repetem" : "Recebimentos que se repetem"}
          </CardTitle>
          <p className="mt-1 text-sm text-[color:var(--muted-fg)]">
            {direction === "OUTFLOW"
              ? "Configure uma vez. Cada próximo vencimento aparece na lista de contas acima."
              : "Configure uma vez. Cada próximo recebimento aparece na página Entradas."}
          </p>
        </div>
        {rules.length > 0 ? (
          <Button
            variant="ghost"
            className="text-xs"
            aria-expanded={showRules}
            onClick={() => setShowRules((open) => !open)}
          >
            {showRules
              ? "Ocultar lista"
              : `Ver ${direction === "OUTFLOW" ? "contas" : "recebimentos"} (${rules.length})`}
          </Button>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title={
            direction === "OUTFLOW"
              ? "Nenhuma conta recorrente cadastrada"
              : "Nenhum recebimento recorrente cadastrado"
          }
          description={
            direction === "OUTFLOW"
              ? "Use para aluguel, internet, água ou luz. O app prepara os próximos vencimentos sem você cadastrar a mesma conta todo mês."
              : "Use para salário, benefício ou outra renda previsível. O app lembra dos próximos recebimentos sem novo cadastro todo mês."
          }
          action={
            canWrite ? (
              <Button onClick={onCreate}>
                {direction === "OUTFLOW"
                  ? "Cadastrar conta recorrente"
                  : "Cadastrar recebimento recorrente"}
              </Button>
            ) : undefined
          }
        />
      ) : showRules ? (
        <>
          <p className="mb-3 text-sm text-[color:var(--muted-fg)]">
            {direction === "OUTFLOW"
              ? "Contas fixas repetem o valor informado. Para contas variáveis, como energia, a estimativa usa a média dos últimos três meses completos quando há histórico."
              : "O recebimento previsto aparece nesta tela até você confirmar que o dinheiro caiu na conta."}
          </p>
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
                    <p className="text-xs text-[color:var(--muted-fg)]">
                      {direction === "OUTFLOW"
                        ? "Estimativa próxima conta"
                        : "Estimativa próximo recebimento"}
                    </p>
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
        </>
      ) : null}
    </Card>
  );
}
