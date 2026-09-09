"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  type Debt,
  type DebtKind,
  type DebtStatus,
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
import {
  ContractImportButton,
  type ContractSuggestion,
} from "@/modules/receipts/ui/contract-import-button";
import { useCollections } from "@/modules/shared/ui/use-collections";
import { FinancialInsightCard } from "@/modules/education/ui/financial-insight-card";
import { HelpTip } from "@/modules/education/ui/help-tip";
import { PayoffStrategyComparator } from "@/modules/recovery-timeline/ui/payoff-strategy-comparator";
import { Callout } from "@/components/ui/primitives";

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
  const [editing, setEditing] = useState<Debt | null>(null);

  if (finance.loading) return <Spinner label="Carregando suas dívidas" />;

  // Without the instalments already paid, every number below would report the
  // contracted amount for ever, as if nothing had been paid off.
  const paidByDebt = finance.paidDebtInstallments;
  const summary = summariseDebts(finance.debts, finance.asOf, paidByDebt);
  const active = sortByRisk(finance.debts.filter((debt) => debt.status !== "SETTLED"));
  const settled = finance.debts.filter((debt) => debt.status === "SETTLED");

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
        tag="Estratégia de quitação"
        title="Dívida com garantia pede atenção especial"
        description="Financiamento de veículo ou imóvel envolve um bem da família. Quando há atraso, o risco é diferente de uma dívida comum, então vale olhar esse compromisso com prioridade."
        tips={[
          "Se o carro, a moto ou a casa entram na renda ou na segurança da família, essa parcela precisa aparecer no topo da análise.",
          "Pelo método avalanche, a sobra vai para a dívida com maior taxa. Ele reduz custo, mas só funciona quando o mês fecha.",
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

      {/* Comparador Interativo: Bola de Neve vs. Avalanche */}
      <PayoffStrategyComparator />

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
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={riskTone(risk.level)}>{RISK_LEVEL_LABELS[risk.level]}</Badge>
                  {rate.source === "UNKNOWN" ? (
                    <Badge tone="neutral">Sem taxa informada</Badge>
                  ) : null}
                  {canWrite ? (
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setEditing(debt)}
                      aria-label={`Editar ${debt.description}`}
                    >
                      Editar
                    </Button>
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
                  <Button
                    variant="ghost"
                    className="shrink-0 text-xs"
                    onClick={() => setEditing(debt)}
                    aria-label={`Editar ${debt.description}`}
                  >
                    Editar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <DebtDialog
        open={creating || editing !== null}
        debt={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
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

/**
 * Cadastrar ou corrigir um contrato.
 *
 * O mesmo formulário serve para os dois porque as perguntas são exatamente as
 * mesmas. Um contrato cadastrado com a taxa errada, ou com o número de
 * parcelas trocado, contamina tudo o que vem depois: a projeção, a ordem de
 * quitação recomendada e o diagnóstico de superendividamento. Precisa ter
 * conserto, e o conserto precisa estar onde a pessoa já está olhando.
 *
 * Excluir é diferente de corrigir e continua sendo de administrador: apagar um
 * contrato apaga o contrato a que as parcelas pagas pertencem. Quando a dívida
 * acabou, o certo é marcá-la como quitada — aí o registro fica.
 */
function DebtDialog({
  open,
  debt,
  onClose,
}: {
  open: boolean;
  debt: Debt | null;
  onClose: () => void;
}) {
  const { household, canAdminister } = useSession();
  const { asOf } = useFinance();
  const collections = useCollections();

  const editing = debt !== null;

  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<DebtKind>("PERSONAL_LOAN");
  const [institution, setInstitution] = useState("");
  const [principalText, setPrincipalText] = useState("");
  const [disbursedText, setDisbursedText] = useState("");
  const [disbursementDate, setDisbursementDate] = useState<string>(asOf);
  const [installments, setInstallments] = useState("12");
  const [installmentText, setInstallmentText] = useState("");
  const [rateText, setRateText] = useState("");
  const [cetText, setCetText] = useState("");
  const [feesText, setFeesText] = useState("");
  const [insuranceText, setInsuranceText] = useState("");
  const [firstDueDate, setFirstDueDate] = useState<string>(asOf);
  const [alreadyPaid, setAlreadyPaid] = useState("0");
  const [status, setStatus] = useState<DebtStatus>("ACTIVE");
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Abrir o diálogo é o que traz os dados: sem isto, editar um contrato depois
  // de outro mostraria os números do anterior.
  useEffect(() => {
    if (!open) return;

    setError(null);
    setConfirmingDelete(false);

    if (!debt) {
      setDescription("");
      setKind("PERSONAL_LOAN");
      setInstitution("");
      setPrincipalText("");
      setDisbursedText("");
      setDisbursementDate(asOf);
      setInstallments("12");
      setInstallmentText("");
      setRateText("");
      setCetText("");
      setFeesText("");
      setInsuranceText("");
      setFirstDueDate(asOf);
      setAlreadyPaid("0");
      setStatus("ACTIVE");
      setMemberId("");
      return;
    }

    setDescription(debt.description);
    setKind(debt.kind);
    setInstitution(debt.institution ?? "");
    setPrincipalText(moneyField(debt.principalContracted.amount));
    setDisbursedText(moneyField(debt.amountDisbursed.amount));
    setDisbursementDate(debt.disbursementDate);
    setInstallments(String(debt.installmentCount));
    setInstallmentText(debt.installmentAmount ? moneyField(debt.installmentAmount.amount) : "");
    setRateText(debt.interestRateMonthly ? String(debt.interestRateMonthly).replace(".", ",") : "");
    setCetText(debt.cetAnnual ? String(debt.cetAnnual).replace(".", ",") : "");
    setFeesText(debt.monthlyFees ? moneyField(debt.monthlyFees.amount) : "");
    setInsuranceText(debt.monthlyInsurance ? moneyField(debt.monthlyInsurance.amount) : "");
    setFirstDueDate(debt.firstDueDate);
    setAlreadyPaid(String(debt.installmentsPaidBeforeTracking ?? 0));
    setStatus(debt.status);
    setMemberId(debt.responsibleMemberId ?? "");
  }, [open, debt, asOf]);

  /**
   * Preenche o formulário com o que o contrato disse.
   *
   * Só os campos que a leitura trouxe são tocados — o que ela não achou fica
   * como estava, para que a leitura nunca apague algo que a pessoa digitou.
   */
  function applyContract(reading: ContractSuggestion) {
    if (reading.description) setDescription(reading.description);
    if (isDebtKind(reading.kind)) setKind(reading.kind);
    if (reading.institution) setInstitution(reading.institution);
    if (reading.principalContracted !== null)
      setPrincipalText(moneyField(reading.principalContracted));
    if (reading.amountDisbursed !== null) setDisbursedText(moneyField(reading.amountDisbursed));
    if (reading.disbursementDate) setDisbursementDate(reading.disbursementDate);
    if (reading.installmentCount !== null) setInstallments(String(reading.installmentCount));
    if (reading.installmentAmount !== null)
      setInstallmentText(moneyField(reading.installmentAmount));
    if (reading.interestRateMonthly !== null)
      setRateText(String(reading.interestRateMonthly).replace(".", ","));
    if (reading.cetAnnual !== null) setCetText(String(reading.cetAnnual).replace(".", ","));
    if (reading.monthlyFees !== null) setFeesText(moneyField(reading.monthlyFees));
    if (reading.monthlyInsurance !== null) setInsuranceText(moneyField(reading.monthlyInsurance));
    if (reading.firstDueDate) setFirstDueDate(reading.firstDueDate);
  }

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

    if (rate !== undefined && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
      setError("A taxa de juros ao mês precisa ser um percentual entre 0 e 100.");
      return;
    }
    if (cet !== undefined && (!Number.isFinite(cet) || cet < 0 || cet > 1000)) {
      setError("O CET anual precisa ser um percentual entre 0 e 1000.");
      return;
    }
    const installmentAmount = installmentText ? fromDecimalString(installmentText) : null;

    const paidBefore = alreadyPaid.trim() === "" ? 0 : Number(alreadyPaid);
    if (!Number.isInteger(paidBefore) || paidBefore < 0 || paidBefore > count) {
      setError(`As parcelas já pagas precisam estar entre 0 e ${count}.`);
      return;
    }

    const fields = {
      kind,
      description: description.trim(),
      institution: institution.trim() || undefined,
      principalContracted: principal,
      amountDisbursed: fromDecimalString(disbursedText || principalText) ?? principal,
      disbursementDate: disbursementDate as never,
      amortisationSystem: rate && rate > 0 ? ("PRICE" as const) : ("SIMPLE" as const),
      interestRateMonthly: rate && rate > 0 ? rate : undefined,
      cetAnnual: cet && cet > 0 ? cet : undefined,
      installmentCount: count,
      installmentAmount: installmentAmount ?? undefined,
      firstDueDate: firstDueDate as never,
      installmentsPaidBeforeTracking: paidBefore > 0 ? paidBefore : undefined,
      monthlyFees: feesText ? (fromDecimalString(feesText) ?? undefined) : undefined,
      monthlyInsurance: insuranceText ? (fromDecimalString(insuranceText) ?? undefined) : undefined,
      status,
      visibility: "HOUSEHOLD",
      responsibleMemberId: memberId || undefined,
    };

    setSaving(true);
    try {
      if (debt) {
        // Um campo apagado no formulário precisa sair do documento, e não
        // continuar com o valor antigo: `undefined` é removido antes de chegar
        // ao Firestore, então quem apaga a taxa aqui ficaria com a taxa de
        // antes. `null` apaga o campo de verdade.
        await collections.debts.update(debt.id, blankToNull(fields) as never);
      } else {
        await collections.debts.create({ householdId: household.id, ...fields } as never);
      }
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!debt) return;
    setError(null);
    setSaving(true);
    try {
      await collections.debts.remove(debt.id);
      onClose();
    } catch (deleteError) {
      console.error(deleteError);
      setError("Não foi possível excluir agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar dívida" : "Nova dívida"}
      description={
        editing
          ? "Corrija o que estiver errado. Parcela, taxa e prazo mudam a projeção e a ordem de quitação recomendada."
          : "Se você não souber a taxa de juros, deixe em branco: o sistema trabalha com os dados que você tiver."
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <ContractImportButton onRead={applyContract} />

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
          help={<HelpTip term="VALOR_DESEMBOLSADO" />}
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
            help={<HelpTip term="JUROS_AO_MES" />}
            inputMode="decimal"
            value={rateText}
            onChange={(event) => setRateText(event.target.value)}
            placeholder="2,79"
            hint="Opcional. Com a taxa, o sistema separa juros de amortização."
          />
          <TextField
            label="CET ao ano (%)"
            help={<HelpTip term="CET" />}
            inputMode="decimal"
            value={cetText}
            onChange={(event) => setCetText(event.target.value)}
            placeholder="38,90"
            hint="O Custo Efetivo Total é o número que compara propostas de verdade: inclui juros, tarifas e seguros."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <MoneyField
            label="Tarifas por parcela"
            value={feesText}
            onChange={(event) => setFeesText(event.target.value)}
            hint="Opcional. Só o que é cobrado todo mês, dentro da parcela."
          />
          <MoneyField
            label="Seguro por parcela"
            value={insuranceText}
            onChange={(event) => setInsuranceText(event.target.value)}
            hint="Seguro prestamista, quando vem junto com a parcela."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <DateField
            label="Data da contratação"
            required
            value={disbursementDate}
            onChange={(event) => setDisbursementDate(event.target.value)}
            hint="O dia em que o dinheiro caiu na conta."
          />
          <DateField
            label="Primeiro vencimento"
            required
            value={firstDueDate}
            onChange={(event) => setFirstDueDate(event.target.value)}
            hint="Mesmo que já tenha passado."
          />
        </div>

        <TextField
          label="Parcelas que você já pagou"
          help={<HelpTip term="PARCELAS_JA_PAGAS" />}
          type="number"
          min={0}
          max={600}
          value={alreadyPaid}
          onChange={(event) => setAlreadyPaid(event.target.value)}
          hint="Quantas parcelas já saíram antes de você cadastrar aqui. Sem isso o app acha que você deve tudo de novo — e avisa de atraso que não existe."
        />

        {editing ? (
          <SelectField
            label="Situação do contrato"
            value={status}
            onChange={(event) => setStatus(event.target.value as DebtStatus)}
            options={[
              { value: "ACTIVE", label: "Em dia / pagando" },
              { value: "IN_DEFAULT", label: "Em atraso" },
              { value: "RENEGOTIATED", label: "Renegociada" },
              { value: "SETTLED", label: "Quitada" },
            ]}
            hint="Marcar como quitada tira a dívida da lista sem apagar o histórico."
          />
        ) : null}

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

        {editing && canAdminister ? (
          <div className="border-t border-[color:var(--card-border)] pt-4">
            {confirmingDelete ? (
              <Callout tone="critical" title="Excluir este contrato?">
                <p className="text-sm">
                  As parcelas já pagas continuam registradas nos lançamentos, mas deixam de ter um
                  contrato a que pertencer. Se a dívida acabou, marque como <strong>quitada</strong>{" "}
                  em vez de excluir.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onDelete()}
                    disabled={saving}
                  >
                    Excluir mesmo assim
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={saving}
                  >
                    Manter
                  </Button>
                </div>
              </Callout>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
              >
                Excluir dívida
              </Button>
            )}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

/** Centavos no formato que o campo de dinheiro espera. */
function moneyField(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function isDebtKind(value: string): value is DebtKind {
  return value in DEBT_KIND_LABELS;
}

/**
 * Campos vazios viram `null` na atualização.
 *
 * `undefined` é removido do payload antes de chegar ao Firestore, o que faria
 * o valor antigo permanecer no documento. `null` apaga o campo de verdade, que
 * é o que "apaguei este campo no formulário" significa.
 */
function blankToNull(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value === undefined ? null : value]),
  );
}
