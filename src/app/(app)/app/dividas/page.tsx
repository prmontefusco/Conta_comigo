"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { fromDecimalString } from "@/core/money/money";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  ProgressBar,
  ScrollableX,
  Spinner,
  Stat,
} from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  buildSchedule,
  DEBT_KIND_LABELS,
  disbursementCost,
  effectiveMonthlyRate,
  outstandingPrincipal,
  summariseDebts,
  type DebtKind,
} from "@/modules/debts/domain/debt";
import {
  classifyDebt,
  RISK_LEVEL_LABELS,
  sortByRisk,
  type DebtRiskLevel,
} from "@/modules/debts/domain/debt-risk";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { MemberField } from "@/modules/household/ui/member-field";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";
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
  const [creating, setCreating] = useState(false);

  if (finance.loading) return <Spinner label="Carregando suas dívidas" />;

  // Without the instalments already paid, every number below would report the
  // contracted amount for ever, as if nothing had been paid off.
  const paidByDebt = finance.paidDebtInstallments;
  const summary = summariseDebts(finance.debts, finance.asOf, paidByDebt);
  const active = sortByRisk(finance.debts.filter((debt) => debt.status !== "SETTLED"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Empréstimos e financiamentos</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/negociar">
            <Button variant="secondary">Negociar</Button>
          </Link>
          {canWrite ? <Button onClick={() => setCreating(true)}>Nova dívida</Button> : null}
        </div>
      </div>

      <FinancialInsightCard
        tag="Estratégia de Quitação"
        title="Dívida com Garantia Vem Sempre Antes"
        description="Financiamento de veículo ou de imóvel tem o próprio bem como garantia: atrasar coloca o patrimônio da família em risco judicial imediato, enquanto empréstimos sem garantia não podem tomar sua casa."
        tips={[
          "Proteja os bens da família primeiro: financiou carro ou moto para trabalhar? Essa parcela tem prioridade sobre cartão de crédito e empréstimo pessoal.",
          "Método Avalanche (Mais Barato): pague o mínimo em todas e foque todo o dinheiro extra na dívida com maior taxa de juros (geralmente rotativo ou cheque especial).",
          "Método Bola de Neve (Mais Motivador): se estiver desanimado, quite primeiro a dívida de menor valor para eliminar um boleto da sua frente rápido e ganhar alívio.",
        ]}
        helpTopic="Cadastre seus contratos, taxa de juros e parcelas. O sistema calcula a taxa real e orienta qual contrato quitar primeiro na aba 'Visão de Futuro'."
      />

      <Card>
        <CardTitle hint="Cartões aparecem na aba Cartões e não estão somados aqui.">
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

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma dívida cadastrada"
            description="Se você tem empréstimo ou financiamento, cadastre para ver o quanto dos próximos meses já está comprometido."
            action={
              canWrite ? <Button onClick={() => setCreating(true)}>Nova dívida</Button> : undefined
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
                <div className="flex flex-wrap gap-1.5">
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
                  Sem a taxa de juros informada, a parcela inteira é tratada como amortização.
                  Informe a taxa do contrato para ver quanto está indo para juros.
                </p>
              )}
            </Card>
          );
        })
      )}

      <NewDebtDialog open={creating} onClose={() => setCreating(false)} />
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

function NewDebtDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household } = useSession();
  const { asOf } = useFinance();
  const collections = useCollections();

  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<DebtKind>("PERSONAL_LOAN");
  const [institution, setInstitution] = useState("");
  const [principalText, setPrincipalText] = useState("");
  const [disbursedText, setDisbursedText] = useState("");
  const [installments, setInstallments] = useState("12");
  const [installmentText, setInstallmentText] = useState("");
  const [rateText, setRateText] = useState("");
  const [cetText, setCetText] = useState("");
  const [firstDueDate, setFirstDueDate] = useState<string>(asOf);
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    const principal = fromDecimalString(principalText);
    if (!principal || principal.amount <= 0) {
      setError("Informe o valor contratado.");
      return;
    }
    if (description.trim().length < 2) {
      setError("Descreva a dívida.");
      return;
    }
    const count = Number(installments);
    if (!Number.isInteger(count) || count < 1 || count > 600) {
      setError("O número de parcelas precisa estar entre 1 e 600.");
      return;
    }

    const rate = rateText ? Number(rateText.replace(",", ".")) : undefined;
    const cet = cetText ? Number(cetText.replace(",", ".")) : undefined;

    if (cet !== undefined && (!Number.isFinite(cet) || cet < 0 || cet > 1000)) {
      setError("O CET anual precisa ser um percentual entre 0 e 1000.");
      return;
    }
    const installmentAmount = installmentText ? fromDecimalString(installmentText) : null;

    setSaving(true);
    try {
      await collections.debts.create({
        householdId: household.id,
        kind,
        description: description.trim(),
        institution: institution.trim() || undefined,
        principalContracted: principal,
        amountDisbursed: fromDecimalString(disbursedText || principalText) ?? principal,
        disbursementDate: asOf,
        amortisationSystem: rate && rate > 0 ? "PRICE" : "SIMPLE",
        interestRateMonthly: rate && rate > 0 ? rate : undefined,
        cetAnnual: cet && cet > 0 ? cet : undefined,
        installmentCount: count,
        installmentAmount: installmentAmount ?? undefined,
        firstDueDate: firstDueDate as never,
        status: "ACTIVE",
        visibility: "HOUSEHOLD",
        ...(memberId ? { responsibleMemberId: memberId } : {}),
      } as never);
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova dívida"
      description="Se você não souber a taxa de juros, deixe em branco: o sistema trabalha com os dados que você tiver."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <TextField
          label="Descrição"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Empréstimo pessoal"
        />

        <SelectField
          label="Tipo"
          value={kind}
          onChange={(event) => setKind(event.target.value as DebtKind)}
          options={Object.entries(DEBT_KIND_LABELS).map(([value, label]) => ({ value, label }))}
        />

        <TextField
          label="Instituição"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          placeholder="Opcional"
        />

        <MoneyField
          label="Valor contratado"
          required
          value={principalText}
          onChange={(event) => setPrincipalText(event.target.value)}
        />

        <MoneyField
          label="Valor que caiu na conta"
          value={disbursedText}
          onChange={(event) => setDisbursedText(event.target.value)}
          hint="Se for menor que o contratado, a diferença aparece como custo da contratação."
        />

        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Parcelas"
            type="number"
            min={1}
            max={600}
            required
            value={installments}
            onChange={(event) => setInstallments(event.target.value)}
          />
          <MoneyField
            label="Valor da parcela"
            value={installmentText}
            onChange={(event) => setInstallmentText(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Juros ao mês (%)"
            inputMode="decimal"
            value={rateText}
            onChange={(event) => setRateText(event.target.value)}
            placeholder="2,79"
            hint="Opcional. Com a taxa, o sistema separa juros de amortização."
          />
          <TextField
            label="CET ao ano (%)"
            inputMode="decimal"
            value={cetText}
            onChange={(event) => setCetText(event.target.value)}
            placeholder="38,90"
            hint="O Custo Efetivo Total é o número que compara propostas de verdade: inclui juros, tarifas e seguros."
          />
        </div>

        <DateField
          label="Primeiro vencimento"
          required
          value={firstDueDate}
          onChange={(event) => setFirstDueDate(event.target.value)}
        />

        <MemberField
          label="De quem é esta dívida"
          hint="Quem assinou o contrato. A dívida continua sendo do grupo nos totais."
          value={memberId}
          onChange={setMemberId}
          emptyLabel="Do grupo"
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
