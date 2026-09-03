"use client";

import { useState } from "react";
import { addMonths, todayIn, type CalendarDate, calendarDate } from "@/core/date/calendar-date";
import { allocate, fromDecimalString, type Money } from "@/core/money/money";
import { Button } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { MemberField } from "@/modules/household/ui/member-field";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";
import { FREQUENCY_LABELS } from "@/modules/recurring/domain/recurring-rule";

/**
 * Creating a bill or an expected receipt.
 *
 * Three shapes are offered because they behave differently in the projection:
 * a one-off lands on a single date, an installment plan creates one obligation
 * per instalment, and a recurring bill becomes a rule the forecast expands on
 * demand rather than hundreds of stored documents.
 */

type Shape = "ONE_OFF" | "INSTALLMENTS" | "RECURRING";

export function NewObligationDialog({
  open,
  onClose,
  defaultDirection = "OUTFLOW",
}: {
  open: boolean;
  onClose: () => void;
  defaultDirection?: "OUTFLOW" | "INFLOW";
}) {
  const { categories } = useFinance();
  const { household, user } = useSession();
  const collections = useCollections();

  const [shape, setShape] = useState<Shape>("ONE_OFF");
  const [direction, setDirection] = useState(defaultDirection);
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [dueDate, setDueDate] = useState<string>(
    todayIn(household?.settings.timezone ?? "America/Sao_Paulo"),
  );
  const [categoryId, setCategoryId] = useState("");
  const [installments, setInstallments] = useState(2);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [expenseNature, setExpenseNature] = useState("FIXED");
  const [confidence, setConfidence] = useState("CONFIRMED");
  const [visibility, setVisibility] = useState("HOUSEHOLD");
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const relevantCategories = categories.filter((category) =>
    direction === "INFLOW" ? category.kind === "INCOME" : category.kind === "EXPENSE",
  );

  function reset() {
    setDescription("");
    setAmountText("");
    setInstallments(2);
    setMemberId("");
    setError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!household || !user) return;

    const amount = fromDecimalString(amountText);
    if (!amount || amount.amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (description.trim().length < 2) {
      setError("Dê um nome para esta conta.");
      return;
    }

    let due: CalendarDate;
    try {
      due = calendarDate(dueDate);
    } catch {
      setError("Informe uma data de vencimento válida.");
      return;
    }

    setSaving(true);
    try {
      if (shape === "RECURRING") {
        await collections.recurringRules.create({
          householdId: household.id,
          direction,
          description: description.trim(),
          amount,
          frequency: frequency as never,
          interval: 1,
          dayOfMonth: Number(due.slice(8, 10)),
          startDate: due,
          weekendPolicy: "KEEP",
          categoryId: categoryId || undefined,
          expenseNature: expenseNature as never,
          confidence: confidence as never,
          visibility: visibility as never,
          ...(memberId ? { responsibleMemberId: memberId } : {}),
          active: true,
        } as never);
      } else {
        const parts: Money[] = shape === "INSTALLMENTS" ? allocate(amount, installments) : [amount];

        for (const [index, part] of parts.entries()) {
          const partDue = addMonths(due, index);
          await collections.obligations.create({
            householdId: household.id,
            direction,
            origin: shape === "INSTALLMENTS" ? "INSTALLMENT_PLAN" : "MANUAL",
            description:
              shape === "INSTALLMENTS"
                ? `${description.trim()} (${index + 1}/${parts.length})`
                : description.trim(),
            amount: part,
            dueDate: partDue,
            competenceDate: partDue,
            categoryId: categoryId || undefined,
            expenseNature: expenseNature as never,
            confidence: confidence as never,
            visibility: visibility as never,
            status: "SCHEDULED",
            ...(memberId ? { responsibleMemberId: memberId } : {}),
            settledAmount: { amount: 0, currency: "BRL" },
            settlementTransactionIds: [],
            ...(shape === "INSTALLMENTS"
              ? {
                  source: { installmentNumber: index + 1, installmentCount: parts.length },
                }
              : {}),
          } as never);
        }
      }

      reset();
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
      title="Nova conta"
      description="Uma conta a pagar, uma receita esperada, um parcelamento ou uma despesa que se repete."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <SelectField
          label="Tipo"
          value={direction}
          onChange={(event) => setDirection(event.target.value as "OUTFLOW" | "INFLOW")}
          options={[
            { value: "OUTFLOW", label: "Vou pagar" },
            { value: "INFLOW", label: "Vou receber" },
          ]}
        />

        <SelectField
          label="Como se repete"
          value={shape}
          onChange={(event) => setShape(event.target.value as Shape)}
          hint={
            shape === "RECURRING"
              ? "Vira uma regra: a projeção calcula as ocorrências futuras sozinha."
              : shape === "INSTALLMENTS"
                ? "Cria uma obrigação por parcela, com vencimentos mensais."
                : undefined
          }
          options={[
            { value: "ONE_OFF", label: "Uma vez só" },
            { value: "INSTALLMENTS", label: "Parcelado" },
            { value: "RECURRING", label: "Todo mês (ou outra frequência)" },
          ]}
        />

        <TextField
          label="Descrição"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Conta de energia"
        />

        <MoneyField
          label={shape === "INSTALLMENTS" ? "Valor total" : "Valor"}
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          placeholder="0,00"
          hint={
            shape === "INSTALLMENTS"
              ? "O valor total será dividido entre as parcelas, sem perder centavos."
              : undefined
          }
        />

        {shape === "INSTALLMENTS" ? (
          <TextField
            label="Número de parcelas"
            type="number"
            min={2}
            max={120}
            required
            value={String(installments)}
            onChange={(event) => setInstallments(Math.max(2, Number(event.target.value) || 2))}
          />
        ) : null}

        {shape === "RECURRING" ? (
          <SelectField
            label="Frequência"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value)}
            options={Object.entries(FREQUENCY_LABELS)
              .filter(([value]) => value !== "EVERY_N_DAYS")
              .map(([value, label]) => ({ value, label }))}
          />
        ) : null}

        <DateField
          label={
            shape === "RECURRING"
              ? "Primeiro vencimento"
              : shape === "INSTALLMENTS"
                ? "Vencimento da primeira parcela"
                : "Vencimento"
          }
          required
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />

        <SelectField
          label="Categoria"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          options={[
            { value: "", label: "Sem categoria" },
            ...relevantCategories.map((category) => ({
              value: category.id,
              label: `${category.icon ?? ""} ${category.name}`.trim(),
            })),
          ]}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Natureza"
            value={expenseNature}
            onChange={(event) => setExpenseNature(event.target.value)}
            hint="Você decide. Nada é classificado automaticamente."
            options={[
              { value: "FIXED", label: "Fixa" },
              { value: "VARIABLE", label: "Variável" },
              { value: "OCCASIONAL", label: "Eventual" },
            ]}
          />

          <SelectField
            label="Certeza do valor"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
            hint="Estimado entra na projeção, mas não é dinheiro garantido."
            options={[
              { value: "CONFIRMED", label: "Confirmado" },
              { value: "ESTIMATED", label: "Estimado" },
            ]}
          />
        </div>

        <MemberField
          label="Quem responde por ela"
          hint="Serve para o grupo dividir o que é de cada um."
          value={memberId}
          onChange={setMemberId}
          emptyLabel="Do grupo"
        />

        <SelectField
          label="Esta conta é"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value)}
          options={[
            { value: "HOUSEHOLD", label: "Do grupo" },
            { value: "PERSONAL", label: "Pessoal" },
          ]}
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
