"use client";

import Link from "next/link";
import { formatCalendarDate } from "@/core/date/calendar-date";
import {
  Badge,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  ProgressBar,
  ScrollableX,
  Spinner,
  Stat,
} from "@/components/ui/primitives";
import {
  buildSchedule,
  DEBT_KIND_LABELS,
  disbursementCost,
  effectiveMonthlyRate,
  outstandingPrincipal,
  summariseDebts,
} from "@/modules/debts/domain/debt";
import {
  classifyDebt,
  RISK_LEVEL_LABELS,
  sortByRisk,
  type DebtRiskLevel,
} from "@/modules/debts/domain/debt-risk";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { loanContracts } from "@/modules/debts/domain/debt-sections";
import { useSession } from "@/modules/household/ui/session-provider";
import { FinancialInsightCard } from "@/modules/education/ui/financial-insight-card";

/**
 * Loans and financings.
 *
 * The headline is the monthly commitment, not the outstanding balance: what
 * constrains next month is the installment, and a large balance with small
 * installments is a very different situation from the reverse.
 */
export default function DebtsPage() {
  const finance = useFinance();
  const { canWrite } = useSession();

  if (finance.loading) return <Spinner label="Carregando suas dívidas" />;

  // Without the instalments already paid, every number below would report the
  // contracted amount for ever, as if nothing had been paid off.
  const paidByDebt = finance.paidDebtInstallments;
  const loans = loanContracts(finance.debts);
  const summary = summariseDebts(loans, finance.asOf, paidByDebt);
  const active = sortByRisk(loans.filter((debt) => debt.status !== "SETTLED"));
  const settled = loans.filter((debt) => debt.status === "SETTLED");
  const hasSecuredDebt = active.some((debt) =>
    ["VEHICLE_FINANCING", "REAL_ESTATE_FINANCING", "EQUIPMENT_FINANCING"].includes(debt.kind),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Análise de empréstimos e financiamentos</h1>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Contratos de empréstimo e financiamento. Faturas e acordos de cartão ficam em Cartões.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/negociar"
            className="inline-flex min-h-11 items-center rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 text-sm font-medium hover:bg-[color:var(--color-ink-50)]"
          >
            Negociar
          </Link>
          {canWrite ? (
            <Link
              href="/app/cadastro-emprestimos"
              className="inline-flex min-h-11 items-center rounded-lg bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white hover:bg-[color:var(--color-brand-700)]"
            >
              Gerenciar contratos
            </Link>
          ) : null}
        </div>
      </div>

      <FinancialInsightCard
        tag="Estratégia de quitação"
        title={
          hasSecuredDebt
            ? "Proteja primeiro o bem em garantia"
            : "Priorize o que causa mais dano agora"
        }
        description={
          hasSecuredDebt
            ? "Há financiamento com bem em garantia. Quando existe atraso, esse compromisso precisa de atenção antes de uma cobrança sem garantia."
            : "Nenhum contrato ativo registrado envolve bem em garantia. Compare juros, atraso e impacto mensal antes de escolher a ordem de pagamento."
        }
        tips={[
          "Se o carro, a moto ou a casa entram na renda ou na segurança da família, essa parcela precisa aparecer no topo da análise.",
          "Pelo método avalanche, a sobra vai para a dívida com maior taxa. Ele reduz custo, mas só funciona quando o mês fecha.",
          "Método Bola de Neve (Mais Motivador): se estiver desanimado, quite primeiro a dívida de menor valor para eliminar um boleto da sua frente rápido e ganhar alívio.",
        ]}
        helpTopic="Cadastre contratos, taxas e parcelas em Cadastro de empréstimos. Esta tela mostra o impacto dos empréstimos; a simulação global fica na aba Dívidas e cartões do painel geral."
      />

      <Card>
        <CardTitle hint="Faturas e acordos de cartão não estão somados aqui; veja Cartões.">
          Situação
        </CardTitle>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Saldo devedor" value={summary.totalOutstanding} size="lg" tone="outflow" />
          <Stat
            label="Compromisso do próximo mês"
            value={summary.monthlyCommitment}
            tone="outflow"
          />
          <Stat
            label="Juros ainda a pagar"
            value={summary.totalInterestRemaining}
            tone="outflow"
            hint="Só nos contratos com taxa informada."
          />
          <div>
            <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
              Parcelas restantes
            </dt>
            <dd className="tabular mt-0.5 text-xl font-semibold">
              {summary.remainingInstallments}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Destaque para a Lei do Superendividamento */}
      <Callout tone="info" title="As parcelas das dívidas estão sufocando o salário da família?">
        Se o total de parcelas consome sua renda e falta dinheiro para alimentação, aluguel ou
        remédios, você pode se enquadrar na{" "}
        <strong>Lei do Superendividamento (Lei 14.181/2021)</strong>. Monte seu plano de repactuação
        em 5 anos com carência de 180 dias.
        <div className="mt-2">
          <Link href="/app/superendividamento" className="text-xs font-bold underline">
            ⚖️ Acessar Dossiê de Superendividamento &rarr;
          </Link>
        </div>
      </Callout>

      <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
        Para comparar a quitação de todas as dívidas, incluindo cartões, use o simulador na aba
        Dívidas e cartões do{" "}
        <Link href="/app" className="underline">
          painel geral
        </Link>
        .
      </p>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma dívida cadastrada"
            description="Se você tem empréstimo ou financiamento, cadastre para ver o quanto dos próximos meses já está comprometido."
            action={
              canWrite ? (
                <Link href="/app/cadastro-emprestimos" className="underline">
                  Cadastrar empréstimo
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        active.map((debt) => {
          const schedule = buildSchedule(debt);
          const paidNumbers = paidByDebt.get(debt.id) ?? [];
          const paidSet = new Set(paidNumbers);
          const outstanding = outstandingPrincipal(debt, paidNumbers);
          const paidRatio =
            debt.principalContracted.amount === 0
              ? 0
              : 1 - outstanding.amount / debt.principalContracted.amount;
          const upfrontCost = disbursementCost(debt);
          const risk = classifyDebt(debt);
          const rate = effectiveMonthlyRate(debt);
          const nextInstallments = schedule.filter((item) => !paidSet.has(item.number));

          return (
            <Card key={debt.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle
                  hint={`${DEBT_KIND_LABELS[debt.kind]}${debt.institution ? ` · ${debt.institution}` : ""}`}
                >
                  {debt.description}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={riskTone(risk.level)}>{RISK_LEVEL_LABELS[risk.level]}</Badge>
                  {rate.source === "UNKNOWN" ? (
                    <Badge tone="neutral">Sem taxa informada</Badge>
                  ) : null}
                </div>
              </div>

              <p className="mb-4 text-sm" style={{ color: "var(--muted-fg)" }}>
                {risk.consequence}
              </p>

              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat
                  label="Parcela"
                  value={schedule[0]?.total ?? debt.principalContracted}
                  tone="outflow"
                />
                <Stat label="Saldo devedor" value={outstanding} tone="outflow" />
                <div>
                  <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
                    Parcelas
                  </dt>
                  <dd className="tabular mt-0.5 text-xl font-semibold">{debt.installmentCount}</dd>
                </div>
                <div>
                  <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
                    Última parcela
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {schedule.at(-1) ? formatCalendarDate(schedule.at(-1)!.dueDate) : "—"}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <ProgressBar
                  ratio={paidRatio}
                  label={`Amortização de ${debt.description}`}
                  tone="positive"
                />
                <p className="mt-1.5 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {Math.round(paidRatio * 100)}% do valor contratado já amortizado ·{" "}
                  {paidNumbers.length} de {debt.installmentCount}{" "}
                  {debt.installmentCount === 1 ? "parcela paga" : "parcelas pagas"}.
                </p>

                <p className="mt-1.5 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {rateSentence(rate, debt.cetAnnual)}
                </p>
              </div>

              {upfrontCost.amount > 0 ? (
                <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
                  Foram contratados <MoneyText value={debt.principalContracted} size="sm" /> e
                  recebidos <MoneyText value={debt.amountDisbursed} size="sm" />. A diferença de{" "}
                  <MoneyText value={upfrontCost} size="sm" tone="outflow" /> foi custo na
                  contratação.
                </p>
              ) : null}

              {schedule[0]?.breakdownKnown ? (
                <ScrollableX
                  label={`Parcelas em aberto de ${debt.description}`}
                  className="-mx-4 mt-4 px-4 sm:mx-0 sm:px-0"
                >
                  <table className="w-full min-w-[28rem] border-collapse text-sm">
                    <caption className="sr-only">Parcelas em aberto de {debt.description}</caption>
                    <thead>
                      <tr className="border-b border-[color:var(--card-border)] text-left">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Parcela
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Total
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right font-medium">
                          Amortização
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Juros
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {nextInstallments.slice(0, 6).map((item) => (
                        <tr
                          key={item.number}
                          className="border-b border-[color:var(--card-border)]"
                        >
                          <th scope="row" className="py-2 pr-3 text-left font-normal">
                            {item.number}/{item.of} · {formatCalendarDate(item.dueDate)}
                          </th>
                          <td className="py-2 pr-3 text-right">
                            <MoneyText value={item.total} size="sm" />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <MoneyText value={item.principal} size="sm" />
                          </td>
                          <td className="py-2 text-right">
                            <MoneyText value={item.interest} size="sm" tone="outflow" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
                    Só a parte de juros e encargos é despesa. A amortização troca dinheiro por uma
                    dívida menor: o seu patrimônio não muda com ela.
                  </p>
                </ScrollableX>
              ) : (
                <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {debt.sourceCardInvoiceId
                    ? "O total adicional do parcelamento é conhecido, mas a divisão mensal entre amortização e encargos é estimada. Confira o demonstrativo do emissor."
                    : "Sem a taxa de juros informada, a parcela inteira é tratada como amortização. Informe a taxa do contrato para ver quanto está indo para juros."}
                </p>
              )}
            </Card>
          );
        })
      )}

      {settled.length > 0 ? (
        <Card>
          <CardTitle hint="Ficam fora dos totais, mas continuam aqui — inclusive para desfazer uma quitação marcada por engano.">
            Dívidas quitadas
          </CardTitle>
          <ul className="divide-y divide-[color:var(--card-border)]">
            {settled.map((debt) => (
              <li key={debt.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{debt.description}</p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {DEBT_KIND_LABELS[debt.kind]}
                    {debt.institution ? ` · ${debt.institution}` : ""}
                  </p>
                </div>
                {canWrite ? (
                  <Link href="/app/cadastro-emprestimos" className="text-xs underline">
                    Gerenciar
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * How the rate is described, and where it came from.
 *
 * A rate solved from the instalments is useful and is not the same thing as a
 * rate the bank stated. Saying which is which is the difference between
 * informing someone and quietly making a number up for them.
 */
function rateSentence(
  rate: ReturnType<typeof effectiveMonthlyRate>,
  cetAnnual: number | undefined,
): string {
  const cet = cetAnnual ? ` · CET de ${formatPercent(cetAnnual)} ao ano` : "";

  switch (rate.source) {
    case "CONTRACT":
      return `Juros de ${formatPercent(rate.monthly)} ao mês, conforme o contrato${cet}.`;
    case "CET":
      return `Juros de cerca de ${formatPercent(rate.monthly)} ao mês, calculados a partir do CET de ${formatPercent(cetAnnual ?? 0)} ao ano.`;
    case "IMPLIED":
      return `Juros estimados em ${formatPercent(rate.monthly)} ao mês, calculados a partir do valor da parcela${cet}. Confirme no contrato.`;
    case "UNKNOWN":
      return `Sem taxa informada${cet ? cet.replace(" · ", ", mas com ") : ""}. Informe a taxa ou o CET para comparar esta dívida com as outras.`;
  }
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function riskTone(level: DebtRiskLevel): "critical" | "attention" | "neutral" {
  return level === "CRITICAL" ? "critical" : level === "HIGH" ? "attention" : "neutral";
}
