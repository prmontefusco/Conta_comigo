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
import { NewObligationDialog } from "@/modules/obligations/ui/new-obligation-dialog";
import { FinancialInsightCard } from "@/modules/education/ui/financial-insight-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Recorrências</h1>
        {canWrite ? <Button onClick={() => setCreating(true)}>Nova regra recorrente</Button> : null}
      </div>

      <FinancialInsightCard
        tag="Renda e Previsibilidade"
        title="Como Lidar com Renda Variável, Comissões e Bicos"
        description="Se a renda da sua casa varia de mês para mês, calibrar o orçamento é a chave para não se endividar nos meses mais fracos."
        tips={[
          "Calibre suas despesas essenciais pelo seu mês mais baixo: viva com o valor mínimo seguro para nunca depender de comissões incertas para pagar água e luz.",
          "Nos meses de renda alta: use o dinheiro extra para acelerar a quitação de dívidas ou engordar a Reserva de Respiro.",
          "Cadastre salários com dia certo: informe o dia habitual em que o dinheiro cai na conta para a projeção futura calcular os saldos com precisão.",
        ]}
        helpTopic="Adicione salários de cada membro da família como 'Receita Recorrente' e contas mensais fixas como 'Despesa Recorrente'. O sistema projeta os próximos 12 meses automaticamente."
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
            canWrite={canWrite}
            onToggle={toggle}
          />
          <RuleGroup
            title="Saídas"
            rules={bills}
            asOf={finance.asOf}
            canWrite={canWrite}
            onToggle={toggle}
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
  canWrite,
  onToggle,
}: {
  title: string;
  rules: ReturnType<typeof useFinance>["recurringRules"];
  asOf: ReturnType<typeof useFinance>["asOf"];
  canWrite: boolean;
  onToggle: (ruleId: string, active: boolean) => Promise<void>;
}) {
  if (rules.length === 0) return null;

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <ul className="divide-y divide-[color:var(--card-border)]">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{rule.description}</p>
              <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                {frequencyLabel(rule)}
                {rule.dayOfMonth ? ` · dia ${rule.dayOfMonth}` : ""} ·{" "}
                {nextOccurrenceLabel(rule, asOf)}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {!rule.active ? <Badge tone="neutral">Pausada</Badge> : null}
                {rule.confidence === "ESTIMATED" ? <Badge>Estimada</Badge> : null}
                {rule.endDate ? <Badge>Até {formatCalendarDate(rule.endDate)}</Badge> : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
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
        ))}
      </ul>
    </Card>
  );
}
