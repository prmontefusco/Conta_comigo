"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addDays,
  formatCalendarDate,
  formatMonthKey,
  monthKeyOf,
  type CalendarDate,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, money, subtract, sum, zero, type Money } from "@/core/money/money";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Callout,
  MoneyText,
  ProgressBar,
  Spinner,
  Stat,
} from "@/components/ui/primitives";
import { MoneyField } from "@/components/ui/form";
import { type CardStatement, type CreditCard } from "@/modules/cards/domain/credit-card";
import { buildCategoryIndex } from "@/modules/categories/domain/category";
import {
  buildSchedule,
  effectiveMonthlyRate,
  outstandingPrincipal,
  type Debt,
} from "@/modules/debts/domain/debt";
import { classifyDebt } from "@/modules/debts/domain/debt-risk";
import {
  DECISION_KIND_LABELS,
  pendingDecisions,
  summariseDecisions,
} from "@/modules/decisions/domain/decision";
import { useFinance, type FinanceData } from "@/modules/household/ui/finance-provider";
import { buildScript, type ScriptId } from "@/modules/negotiation/domain/scripts";
import { proposalCapacity } from "@/modules/negotiation/domain/affordable-proposal";
import { isOpen, remainingAmount } from "@/modules/obligations/domain/obligation";
import { starterReserveStatus } from "@/modules/reserves/domain/starter-reserve";

type PriorityKind = "ESSENTIAL" | "COLLATERAL" | "EXPENSIVE" | "QUICK_WIN" | "CASH_FLOW";

interface DebtPriority {
  readonly id: string;
  readonly kind: PriorityKind;
  readonly title: string;
  readonly detail: string;
  readonly amount: Money;
  readonly href: string;
  readonly tone: "critical" | "attention" | "positive" | "neutral";
}

interface ActionItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly tone: "critical" | "attention" | "positive" | "neutral";
}

export default function ActionPlanPage() {
  const finance = useFinance();
  const [incomeDropText, setIncomeDropText] = useState("30");
  const [serviceCashText, setServiceCashText] = useState("");
  const [scriptId, setScriptId] = useState<ScriptId>("PRAZO");

  const plan = useMemo(() => buildActionPlan(finance), [finance]);
  const incomeStress = useMemo(
    () => stressIncome(finance, incomeDropText),
    [finance, incomeDropText],
  );
  const serviceCash = fromDecimalString(serviceCashText) ?? finance.overview.today.spendableCash;
  const serviceReport = useMemo(
    () => buildServiceReport(finance, serviceCash),
    [finance, serviceCash],
  );
  const firstDebt = finance.debts.find((debt) => debt.status !== "SETTLED");
  const script = buildScript(scriptId, {
    personName: "Responsável pela família",
    ...(firstDebt?.institution ? { creditorName: firstDebt.institution } : {}),
    ...(firstDebt ? { debtDescription: firstDebt.description } : {}),
    ...(firstDebt
      ? {
          claimedBalance: outstandingPrincipal(
            firstDebt,
            finance.paidDebtInstallments.get(firstDebt.id) ?? [],
          ),
        }
      : {}),
    affordableInstallment: plan.negotiationCapacity.maxInstallment,
    installmentCount: 12,
  });

  if (finance.loading) return <Spinner label="Montando seu plano de ação" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Plano de ação</h1>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Uma agenda prática para atravessar o mês, negociar e reduzir risco.
          </p>
        </div>
        <Button onClick={() => window.print()} variant="secondary">
          Imprimir relatório
        </Button>
      </div>

      {plan.actions.some((item) => item.tone === "critical") ? (
        <Callout tone="attention" title="Há ações para esta semana">
          O plano prioriza contas essenciais, bens em garantia e compromissos que podem piorar o
          mês. Os valores vêm do que já está cadastrado.
        </Callout>
      ) : null}

      <Card>
        <CardTitle hint="Tarefas derivadas automaticamente das suas contas, dívidas e projeção.">
          Próximos passos
        </CardTitle>
        <ol className="space-y-3">
          {plan.actions.map((item, index) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-lg border border-[color:var(--card-border)] p-3"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-sm font-bold text-[color:var(--color-brand-700)]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  <Badge tone={item.tone}>{labelForTone(item.tone)}</Badge>
                </div>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
                  {item.detail}
                </p>
              </div>
              <Link
                href={item.href}
                className="text-sm font-medium text-[color:var(--color-brand-700)] hover:underline"
              >
                Abrir
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <DecisionsCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle hint="O que vence primeiro e quanto pressiona o caixa.">
            Calendário financeiro
          </CardTitle>
          <div className="space-y-2">
            {plan.calendar.slice(0, 12).map((event) => (
              <div
                key={`${event.date}-${event.description}-${event.amount.amount}`}
                className="flex items-center justify-between gap-3 border-b border-[color:var(--card-border)] py-2 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{event.description}</p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {formatCalendarDate(event.date)}
                  </p>
                </div>
                <MoneyText
                  value={event.amount}
                  tone={event.direction === "INFLOW" ? "positive" : "outflow"}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle hint="Quanto o mês aguenta se a renda cair.">
            Simulador de renda variável
          </CardTitle>
          <div className="max-w-xs">
            <label className="text-sm font-medium" htmlFor="queda-renda">
              Queda de renda simulada (%)
            </label>
            <input
              id="queda-renda"
              value={incomeDropText}
              onChange={(event) => setIncomeDropText(event.target.value)}
              inputMode="numeric"
              className="mt-1 min-h-11 w-full rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 text-sm"
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Renda média atual" value={incomeStress.currentIncome} />
            <Stat label="Renda simulada" value={incomeStress.stressedIncome} tone="attention" />
            <Stat
              label="Falta no pior mês"
              value={incomeStress.worstShortfall}
              tone={incomeStress.worstShortfall.amount > 0 ? "critical" : "positive"}
            />
            <CountStat
              label="Meses descobertos"
              value={String(incomeStress.deficitMonths)}
              hint="Quantidade em meses"
            />
          </dl>
          <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
            Use esse número como piso de segurança para autônomos, comissões ou renda informal.
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle hint="Ordem combinando consequência, taxa, valor e alívio mensal.">
          Priorização de dívidas
        </CardTitle>
        {plan.priorities.length === 0 ? (
          <Callout tone="positive">Nenhuma dívida ativa cadastrada.</Callout>
        ) : (
          <ul className="space-y-3">
            {plan.priorities.map((item) => (
              <li key={item.id} className="rounded-lg border border-[color:var(--card-border)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.tone}>{priorityLabel(item.kind)}</Badge>
                      <p className="font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
                      {item.detail}
                    </p>
                  </div>
                  <MoneyText value={item.amount} tone="outflow" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle hint="Metas pequenas para sair do sufoco sem prometer milagre.">
            Metas de curto prazo
          </CardTitle>
          <ul className="space-y-4">
            {plan.goals.map((goal) => (
              <li key={goal.title}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{goal.title}</p>
                  <span className="text-sm font-semibold">{goal.progress}%</span>
                </div>
                <ProgressBar
                  ratio={goal.progress / 100}
                  label={goal.title}
                  tone={goal.progress >= 100 ? "positive" : "brand"}
                />
                <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {goal.detail}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle hint="Use antes de ligar para banco, loja ou concessionária.">
            Central de negociação
          </CardTitle>
          <dl className="grid grid-cols-2 gap-4">
            <Stat
              label="Parcela máxima"
              value={plan.negotiationCapacity.maxInstallment}
              tone={plan.negotiationCapacity.maxInstallment.amount > 0 ? "positive" : "critical"}
            />
            <Stat
              label="Sobra mensal"
              value={plan.negotiationCapacity.leftOver}
              tone={plan.negotiationCapacity.leftOver.amount > 0 ? "positive" : "critical"}
            />
          </dl>
          <div className="mt-4">
            <label className="text-sm font-medium" htmlFor="roteiro">
              Roteiro
            </label>
            <select
              id="roteiro"
              value={scriptId}
              onChange={(event) => setScriptId(event.target.value as ScriptId)}
              className="mt-1 min-h-11 w-full rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 text-sm"
            >
              <option value="DETALHAMENTO">Pedir detalhamento</option>
              <option value="PROPOSTA">Propor parcela que cabe</option>
              <option value="PORTABILIDADE">Perguntar sobre portabilidade</option>
              <option value="PRAZO">Pedir prazo</option>
              <option value="COBRANCA_NAO_RECONHECIDA">Cobrança não reconhecida</option>
            </select>
          </div>
          <pre className="mt-3 rounded-lg bg-[color:var(--color-surface-sunken)] p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {script}
          </pre>
          <Link
            href="/app/negociar"
            className="mt-3 inline-flex text-sm font-medium text-[color:var(--color-brand-700)] hover:underline"
          >
            Abrir calculadora completa
          </Link>
        </Card>
      </div>

      <Card>
        <CardTitle hint="Resumo imprimível para Procon, Defensoria, mutirão ou atendimento social.">
          Relatório para atendimento
        </CardTitle>
        <div className="mb-4 max-w-xs print:hidden">
          <MoneyField
            label="Dinheiro disponível hoje"
            value={serviceCashText}
            onChange={(event) => setServiceCashText(event.target.value)}
            placeholder={(finance.overview.today.spendableCash.amount / 100)
              .toFixed(2)
              .replace(".", ",")}
          />
        </div>
        <div className="space-y-3 text-sm">
          {serviceReport.map((line) => (
            <p
              key={line.label}
              className="flex flex-wrap justify-between gap-3 border-b border-[color:var(--card-border)] pb-2 last:border-0"
            >
              <span style={{ color: "var(--muted-fg)" }}>{line.label}</span>
              <strong>{line.value}</strong>
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * O que a família já decidiu, dentro do plano.
 *
 * Os "próximos passos" acima são derivados dos números: o aplicativo os
 * recalcula toda vez e eles não guardam memória nenhuma. Esta lista é a
 * outra metade — o que a casa combinou por conta própria, com data. As duas
 * juntas são o que alguém leva para um atendimento: o que falta fazer e o
 * que já foi tentado.
 */
function DecisionsCard() {
  const finance = useFinance();
  const summary = summariseDecisions(finance.decisions);
  const pending = pendingDecisions(finance.decisions).slice(0, 4);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitle hint="Registrado pela família, não calculado pelo aplicativo.">
          Decisões da família
        </CardTitle>
        <Link
          href="/app/decisoes"
          className="text-sm font-semibold text-[color:var(--color-brand-700)] underline-offset-2 hover:underline"
        >
          Abrir histórico
        </Link>
      </div>

      {summary.total === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Nenhuma decisão registrada ainda. Quando vocês combinarem alguma coisa — ligar para um
          credor, adiar uma compra, guardar um valor por semana — anote no histórico para não
          depender da memória na próxima conversa.
        </p>
      ) : (
        <>
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            {summary.done === 0
              ? `${summary.total} ${summary.total === 1 ? "decisão registrada" : "decisões registradas"}.`
              : `${summary.done} de ${summary.total} ${summary.total === 1 ? "decisão já foi feita" : "decisões já foram feitas"}.`}
          </p>

          {pending.length > 0 ? (
            <ul className="mt-3 divide-y divide-[color:var(--card-border)]">
              {pending.map((decision) => (
                <li key={decision.id} className="py-2">
                  <p className="text-sm font-medium">{decision.description}</p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {DECISION_KIND_LABELS[decision.kind]} · combinado em{" "}
                    {formatCalendarDate(decision.decidedOn)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Card>
  );
}

function buildActionPlan(finance: FinanceData) {
  const month = monthKeyOf(finance.asOf);
  const categories = buildCategoryIndex(finance.categories);
  const overdueEssentials = finance.obligations.filter(
    (item) => item.direction === "OUTFLOW" && isOpen(item) && item.dueDate < finance.asOf,
  );
  const firstDeficit = finance.forecast.months.find((item) => item.isDeficit && !item.isPartial);
  const starter = starterReserveStatus(
    finance.reserves,
    finance.forecast.summary.committedOutflows,
  );
  // Só o que se repete e é confiável conta como renda.
  //
  // Este número vira a parcela oferecida a credores, num módulo cuja razão de
  // existir é provar que a renda não cobre o mínimo existencial. Um "meu irmão
  // me paga R$ 300 dia 20", anotado como plano, inflaria a capacidade de
  // pagamento e trabalharia contra a própria pessoa.
  const income = sum(
    finance.forecast.events
      .filter((event) => event.direction === "INFLOW" && event.confidence === "CONFIRMED")
      .map((event) => event.amount),
  );
  const essentials = sum(
    finance.obligations
      .filter((item) => item.direction === "OUTFLOW" && monthKeyOf(item.competenceDate) === month)
      .map(remainingAmount),
  );
  const debtPayments = finance.forecast.summary.debtCommitment;
  const negotiationCapacity = proposalCapacity({
    monthlyIncome: money(Math.round(income.amount / Math.max(1, finance.forecast.months.length))),
    monthlyEssentials: essentials,
    monthlyDebtPayments: debtPayments,
    monthlySaving: zero(),
  });

  const actions: ActionItem[] = [
    ...(overdueEssentials.length > 0
      ? [
          {
            id: "emergency",
            title: "Resolver contas vencidas primeiro",
            detail: `${overdueEssentials.length} contas em atraso continuam pressionando o caixa. Comece pelas que podem cortar serviço essencial.`,
            href: "/app/emergencia",
            tone: "critical" as const,
          },
        ]
      : []),
    ...(firstDeficit
      ? [
          {
            id: "deficit",
            title: `Preparar ${formatMonthKey(firstDeficit.month)}`,
            detail: `Os compromissos superam as entradas em ${formatMoney(firstDeficit.deficitAmount)}. Renegocie antes desse mês chegar.`,
            href: "/app/negociar",
            tone: "attention" as const,
          },
        ]
      : []),
    {
      id: "calendar",
      title: "Conferir próximos vencimentos",
      detail: "Use o calendário abaixo para evitar que um boleto vire atraso por esquecimento.",
      href: "/app/contas",
      tone: "neutral",
    },
    {
      id: "reserve",
      title: starter.isComplete ? "Manter reserva de partida" : "Formar reserva de partida",
      detail: starter.isComplete
        ? `A reserva de partida está em ${formatMoney(starter.current)}.`
        : `Faltam ${formatMoney(starter.missing)} para a reserva de partida.`,
      href: "/app/reservas",
      tone: starter.isComplete ? "positive" : "attention",
    },
  ];

  const calendar = finance.forecast.events
    .filter((event) => event.date <= addDays(finance.asOf, 45))
    .sort((a, b) =>
      a.date === b.date ? b.amount.amount - a.amount.amount : a.date < b.date ? -1 : 1,
    );

  return {
    actions,
    calendar,
    priorities: debtPriorities(
      finance.debts,
      finance.cards,
      finance.cardStatements,
      finance.paidDebtInstallments,
      finance.asOf,
    ),
    goals: [
      {
        title: "Fechar o mês atual sem novo atraso",
        progress: finance.overview.today.overdue.length === 0 ? 100 : 35,
        detail:
          finance.overview.today.overdue.length === 0
            ? "Nenhuma conta vencida aparece hoje."
            : `${finance.overview.today.overdue.length} contas vencidas precisam de atenção.`,
      },
      {
        title: "Proteger a reserva de partida",
        progress: Math.min(100, Math.round(starter.ratio * 100)),
        detail: `${formatMoney(starter.current)} guardados de ${formatMoney(starter.target)}.`,
      },
      {
        title: "Reduzir dívidas ativas",
        progress: finance.debts.some((debt) => debt.status !== "SETTLED") ? 20 : 100,
        detail: finance.debts.some((debt) => debt.status !== "SETTLED")
          ? "Use a ordem de prioridade para escolher o próximo contato."
          : "Nenhuma dívida ativa cadastrada.",
      },
      {
        title: "Revisar orçamento do mês",
        progress: finance.budgetStatus ? 100 : 0,
        detail: finance.budgetStatus
          ? "Orçamento do mês existe e já compara gasto, comprometido e planejado."
          : "Crie tetos por categoria para receber alertas melhores.",
      },
    ],
    negotiationCapacity,
    categories,
  };
}

function debtPriorities(
  debts: readonly Debt[],
  cards: readonly CreditCard[],
  statements: readonly CardStatement[],
  paidByDebt: ReadonlyMap<string, readonly number[]>,
  asOf: CalendarDate,
): DebtPriority[] {
  const items: DebtPriority[] = [];

  for (const debt of debts) {
    if (debt.status === "SETTLED") continue;
    const paid = paidByDebt.get(debt.id) ?? [];
    const balance = outstandingPrincipal(debt, paid);
    const risk = classifyDebt(debt);
    const rate = effectiveMonthlyRate(debt);
    const schedule = buildSchedule(debt).filter((item) => !paid.includes(item.number));
    const installment = schedule[0]?.total ?? debt.installmentAmount ?? balance;
    items.push({
      id: debt.id,
      kind:
        risk.guarantee === "COLLATERAL" || debt.status === "IN_DEFAULT"
          ? "COLLATERAL"
          : rate.monthly >= 5
            ? "EXPENSIVE"
            : balance.amount <= 1000_00
              ? "QUICK_WIN"
              : "CASH_FLOW",
      title: debt.description,
      detail: `${risk.consequence} Parcela próxima: ${formatMoney(installment)}. Taxa: ${rate.source === "UNKNOWN" ? "não informada" : `${rate.monthly.toFixed(2).replace(".", ",")}% ao mês`}.`,
      amount: balance,
      href: "/app/dividas",
      tone:
        risk.guarantee === "COLLATERAL" || debt.status === "IN_DEFAULT"
          ? "critical"
          : rate.monthly >= 5
            ? "attention"
            : "neutral",
    });
  }

  for (const card of cards) {
    const open = statements.filter(
      (statement) => statement.creditCardId === card.id && statement.remainingAmount.amount > 0,
    );
    if (open.length === 0) continue;
    const total = sum(open.map((statement) => statement.remainingAmount));
    const overdue = open.some((statement) => statement.dueDate < asOf);
    items.push({
      id: `card-${card.id}`,
      kind: overdue ? "EXPENSIVE" : "CASH_FLOW",
      title: `Cartão ${card.name}`,
      detail: overdue
        ? "Há fatura vencida. Evitar rotativo tende a ser a ação mais urgente."
        : "Faturas futuras comprometem o caixa mesmo antes do vencimento.",
      amount: total,
      href: "/app/cartoes",
      tone: overdue ? "critical" : "attention",
    });
  }

  return items.sort(
    (a, b) => priorityWeight(a.kind) - priorityWeight(b.kind) || b.amount.amount - a.amount.amount,
  );
}

function stressIncome(finance: FinanceData, percentText: string) {
  const months = finance.forecast.months.filter((month) => !month.isPartial);
  const drop = Math.min(100, Math.max(0, Number(percentText.replace(",", ".")) || 0)) / 100;
  const currentIncome = money(
    Math.round(
      months.reduce((total, month) => total + month.expectedInflows.amount, 0) /
        Math.max(1, months.length),
    ),
  );
  const stressedIncome = money(Math.round(currentIncome.amount * (1 - drop)));
  let worstShortfall = zero();
  let deficitMonths = 0;

  for (const month of months) {
    const stressedNet = stressedIncome.amount - month.committedOutflows.amount;
    if (stressedNet < 0) {
      deficitMonths++;
      const shortfall = money(Math.abs(stressedNet));
      if (shortfall.amount > worstShortfall.amount) worstShortfall = shortfall;
    }
  }

  return { currentIncome, stressedIncome, worstShortfall, deficitMonths };
}

function buildServiceReport(finance: FinanceData, availableCash: Money) {
  const activeDebts = finance.debts.filter((debt) => debt.status !== "SETTLED");
  const overdue = finance.obligations.filter((item) => isOpen(item) && item.dueDate < finance.asOf);
  const dueSoon = finance.obligations.filter(
    (item) =>
      isOpen(item) && item.dueDate >= finance.asOf && item.dueDate <= addDays(finance.asOf, 7),
  );
  const nextMonth = finance.forecast.months.find((month) => !month.isPartial);

  return [
    { label: "Data do relatório", value: formatCalendarDate(finance.asOf) },
    { label: "Saldo total informado", value: formatMoney(finance.overview.today.totalCash) },
    { label: "Saldo livre informado", value: formatMoney(finance.overview.today.spendableCash) },
    { label: "Dinheiro disponível para acordo hoje", value: formatMoney(availableCash) },
    {
      label: "Contas vencidas",
      value: `${overdue.length} (${formatMoney(sum(overdue.map(remainingAmount)))})`,
    },
    {
      label: "Contas vencendo em 7 dias",
      value: `${dueSoon.length} (${formatMoney(sum(dueSoon.map(remainingAmount)))})`,
    },
    { label: "Dívidas ativas", value: String(activeDebts.length) },
    { label: "Total de dívidas e cartões", value: formatMoney(finance.overview.today.totalDebt) },
    {
      label: "Parcela máxima para novo acordo",
      value: formatMoney(proposalCapacityFromFinance(finance).maxInstallment),
    },
    {
      label: "Próximo mês avaliado",
      value: nextMonth
        ? `${formatMonthKey(nextMonth.month)}: ${formatMoney(nextMonth.net)}`
        : "Sem projeção suficiente",
    },
  ];
}

function proposalCapacityFromFinance(finance: FinanceData) {
  const months = finance.forecast.months.filter((month) => !month.isPartial);
  const wholeMonthKeys = new Set(months.map((month) => month.month));

  // Renda é o que entra com regularidade e confiança — pelo mesmo motivo da
  // outra conta de capacidade acima: `expectedInflows` do mês incluiria um
  // recebimento pontual só planejado, e essa diferença chega ao credor como
  // uma proposta que a pessoa não tem como cumprir.
  const confirmedInflows = finance.forecast.events.filter(
    (event) =>
      event.direction === "INFLOW" &&
      event.confidence === "CONFIRMED" &&
      wholeMonthKeys.has(event.competenceMonth),
  );
  const income = money(
    Math.round(
      confirmedInflows.reduce((total, event) => total + event.amount.amount, 0) /
        Math.max(1, months.length),
    ),
  );
  const outflows = money(
    Math.round(
      months.reduce((total, month) => total + month.committedOutflows.amount, 0) /
        Math.max(1, months.length),
    ),
  );
  const debtPayments = finance.forecast.summary.debtCommitment;
  return proposalCapacity({
    monthlyIncome: income,
    monthlyEssentials: money(Math.max(0, subtract(outflows, debtPayments).amount)),
    monthlyDebtPayments: debtPayments,
    monthlySaving: zero(),
  });
}

function CountStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
        {label}
      </dt>
      <dd className="mt-0.5">
        <span className="text-2xl font-semibold">{value}</span>
        {hint ? (
          <p className="mt-1 text-sm leading-snug" style={{ color: "var(--muted-fg)" }}>
            {hint}
          </p>
        ) : null}
      </dd>
    </div>
  );
}

function priorityWeight(kind: PriorityKind): number {
  return { ESSENTIAL: 0, COLLATERAL: 1, EXPENSIVE: 2, QUICK_WIN: 3, CASH_FLOW: 4 }[kind];
}

function priorityLabel(kind: PriorityKind): string {
  return {
    ESSENTIAL: "Serviço essencial",
    COLLATERAL: "Bem em risco",
    EXPENSIVE: "Juros altos",
    QUICK_WIN: "Vitória rápida",
    CASH_FLOW: "Fluxo mensal",
  }[kind];
}

function labelForTone(tone: ActionItem["tone"]): string {
  return { critical: "urgente", attention: "atenção", positive: "em dia", neutral: "próximo" }[
    tone
  ];
}
