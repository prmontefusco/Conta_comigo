"use client";

import { useEffect, useState } from "react";
import { deleteField } from "firebase/firestore";
import { fromDecimalString } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  DEBT_KIND_LABELS,
  type Debt,
  type AmortisationSystem,
  type DebtKind,
  type DebtStatus,
} from "@/modules/debts/domain/debt";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { MemberField } from "@/modules/household/ui/member-field";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  ContractImportButton,
  type ContractSuggestion,
} from "@/modules/receipts/ui/contract-import-button";
import { useCollections } from "@/modules/shared/ui/use-collections";
import { HelpTip } from "@/modules/education/ui/help-tip";

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
export function DebtDialog({
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
  const [amortisationSystem, setAmortisationSystem] = useState<AmortisationSystem>("SIMPLE");
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
      setAmortisationSystem("SIMPLE");
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
    setAmortisationSystem(debt.amortisationSystem);
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
    if (isDebtKind(reading.kind) && (debt || reading.kind !== "CARD_RENEGOTIATION"))
      setKind(reading.kind);
    if (reading.institution) setInstitution(reading.institution);
    setAmortisationSystem(reading.amortisationSystem);
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
    if (!debt && kind === "CARD_RENEGOTIATION") {
      setError("Registre um novo parcelamento de fatura na tela Cartões.");
      return;
    }

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
      amortisationSystem,
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
        // Optional schema fields require the field to be absent, not null.
        await collections.debts.update(debt.id, blankToDeleted(fields) as never);
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
    if (debt.sourceCardStatementId) {
      setError("Este acordo está ligado à fatura do cartão e não pode ser excluído separadamente.");
      return;
    }
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

  if (debt?.sourceCardStatementId) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Parcelamento da fatura"
        description="Acordo vinculado à fatura de origem."
      >
        <div className="space-y-3">
          <Callout tone="info">
            Para evitar que a fatura original volte a ser cobrada ou que as parcelas desapareçam da
            projeção, este acordo não pode ser editado ou excluído isoladamente. Os pagamentos das
            parcelas continuam disponíveis na tela Cartões.
          </Callout>
          <p className="text-sm">{debt.description}</p>
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar contrato" : "Novo empréstimo ou financiamento"}
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
          options={Object.entries(DEBT_KIND_LABELS)
            .filter(([value]) => debt || value !== "CARD_RENEGOTIATION")
            .map(([value, label]) => ({ value, label }))}
        />

        <SelectField
          label="Sistema de amortização"
          value={amortisationSystem}
          onChange={(event) => setAmortisationSystem(event.target.value as AmortisationSystem)}
          options={[
            { value: "SIMPLE", label: "Não informado / somente valor das parcelas" },
            { value: "PRICE", label: "Price — parcelas aproximadamente fixas" },
            { value: "SAC", label: "SAC — parcelas diminuem com o tempo" },
          ]}
          hint="Financiamentos habitacionais costumam usar SAC ou Price. Copie exatamente o sistema indicado no contrato."
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
 * Campos vazios são removidos na atualização.
 *
 * `undefined` é removido do payload antes de chegar ao Firestore, o que faria
 * o valor antigo permanecer no documento. O schema aceita ausência, não null.
 */
function blankToDeleted(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value === undefined ? deleteField() : value,
    ]),
  );
}
