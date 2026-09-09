"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, todayIn, type CalendarDate, calendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { allocate, fromDecimalString, type Money } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import { MemberField } from "@/modules/household/ui/member-field";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";
import { FREQUENCY_LABELS } from "@/modules/recurring/domain/recurring-rule";
import { estimateVariableExpense } from "@/modules/recurring/domain/variable-expense-estimator";

/**
 * Creating a bill or an expected receipt - and correcting one.
 *
 * Three shapes are offered because they behave differently in the projection:
 * a one-off lands on a single date, an installment plan creates one obligation
 * per instalment, and a recurring bill becomes a rule the forecast expands on
 * demand rather than hundreds of stored documents.
 *
 * Corrigir usa o mesmo formulário, sem a escolha de formato: o formato decide
 * quantos documentos nascem, e isso já aconteceu. Uma parcela lançada com o
 * valor errado se conserta sozinha; trocar o formato de um documento que já
 * existe criaria outros, que é o oposto de corrigir.
 */

type Shape = "ONE_OFF" | "INSTALLMENTS" | "RECURRING";

export function NewObligationDialog({
  open,
  obligation = null,
  onClose,
  defaultDirection = "OUTFLOW",
}: {
  open: boolean;
  /** A conta sendo corrigida, quando houver. */
  obligation?: Obligation | null;
  onClose: () => void;
  defaultDirection?: "OUTFLOW" | "INFLOW";
}) {
  const { categories, transactions, obligations, asOf } = useFinance();
  const { household, user } = useSession();
  const collections = useCollections();

  const editing = obligation !== null;

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Abrir o diálogo é o que traz os dados: sem isto, corrigir uma conta depois
  // de outra mostraria os valores da anterior.
  useEffect(() => {
    if (!open) return;

    setError(null);
    setConfirmingDelete(false);

    if (!obligation) {
      setShape("ONE_OFF");
      setDirection(defaultDirection);
      setDescription("");
      setAmountText("");
      setInstallments(2);
      setCategoryId("");
      setExpenseNature("FIXED");
      setConfidence("CONFIRMED");
      setVisibility("HOUSEHOLD");
      setMemberId("");
      return;
    }

    setDirection(obligation.direction);
    setDescription(obligation.description);
    setAmountText((obligation.amount.amount / 100).toFixed(2).replace(".", ","));
    setDueDate(obligation.dueDate);
    setCategoryId(obligation.categoryId ?? "");
    setExpenseNature(obligation.expenseNature);
    setConfidence(obligation.confidence);
    setVisibility(obligation.visibility);
    setMemberId(obligation.responsibleMemberId ?? "");
  }, [open, obligation, defaultDirection]);

  const relevantCategories = categories.filter((category) =>
    direction === "INFLOW" ? category.kind === "INCOME" : category.kind === "EXPENSE",
  );

  const variableEstimate = useMemo(() => {
    if (direction !== "OUTFLOW") return null;
    if (!categoryId && description.trim().length < 2) return null;
    return estimateVariableExpense({
      transactions,
      obligations,
      asOf,
      categoryId: categoryId || undefined,
      searchTerms: description.trim().length >= 2 ? [description.trim()] : undefined,
      lookbackMonths: 3,
    });
  }, [transactions, obligations, asOf, categoryId, description, direction]);

  function onCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId);
    const cat = categories.find((c) => c.id === newCategoryId);
    if (cat?.defaultExpenseNature) {
      setExpenseNature(cat.defaultExpenseNature);
    }
  }

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
      if (obligation) {
        // A competência acompanha o vencimento: quem corrige a data está
        // dizendo em que mês esta conta deveria estar, e deixar a competência
        // para trás manteria o compromisso no mês errado da projeção.
        await collections.obligations.update(obligation.id, {
          direction,
          description: description.trim(),
          amount,
          dueDate: due,
          competenceDate: due,
          categoryId: categoryId || null,
          expenseNature: expenseNature as never,
          confidence: confidence as never,
          visibility: visibility as never,
          responsibleMemberId: memberId || null,
        } as never);
      } else if (shape === "RECURRING") {
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

  async function onDelete() {
    if (!obligation) return;
    setError(null);
    setSaving(true);
    try {
      await collections.obligations.remove(obligation.id);
      onClose();
    } catch (deleteError) {
      console.error(deleteError);
      setError("Não foi possível excluir agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const alreadySettled = obligation ? obligation.settledAmount.amount > 0 : false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Corrigir conta" : "Nova conta"}
      description={
        editing
          ? "Ajuste valor, vencimento ou categoria. A correção vale na hora para a projeção e para os avisos de vencimento."
          : "Uma conta a pagar, uma receita esperada, um parcelamento ou uma despesa que se repete."
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        {alreadySettled ? (
          <Callout tone="attention" title="Esta conta já tem pagamento registrado">
            Corrigir o valor aqui não mexe no que já foi pago — o pagamento é um lançamento
            separado, no dia a dia. Se o erro foi no pagamento, corrija por lá.
          </Callout>
        ) : null}

        <SelectField
          label="Tipo"
          value={direction}
          onChange={(event) => setDirection(event.target.value as "OUTFLOW" | "INFLOW")}
          options={[
            { value: "OUTFLOW", label: "Vou pagar" },
            { value: "INFLOW", label: "Vou receber" },
          ]}
        />

        {editing ? null : (
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
        )}

        <TextField
          label="Descrição"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={
            direction === "INFLOW" ? "Salário líquido, benefício, comissão" : "Conta de energia"
          }
        />

        <MoneyField
          label={
            direction === "INFLOW"
              ? "Valor líquido a receber"
              : shape === "INSTALLMENTS"
                ? "Valor total"
                : "Valor"
          }
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          placeholder="0,00"
          hint={
            shape === "INSTALLMENTS"
              ? "O valor total será dividido entre as parcelas, sem perder centavos."
              : direction === "INFLOW"
                ? "Informe o valor líquido que efetivamente cai na conta (não utilize o valor bruto do holerite). É esse valor real que garante a projeção correta de saldo."
                : undefined
          }
        />

        {variableEstimate && variableEstimate.hasSufficientData ? (
          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-brand-50)]/60 p-3 text-xs dark:bg-[color:var(--color-brand-950)]/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-[color:var(--color-brand-700)] dark:text-[color:var(--color-brand-300)]">
                  💡 Média histórica ({variableEstimate.sampleCount}{" "}
                  {variableEstimate.sampleCount === 1 ? "mês anterior" : "meses anteriores"}):{" "}
                </span>
                <span className="font-bold text-[color:var(--fg)]">
                  {formatMoney(variableEstimate.average)}
                </span>
                {variableEstimate.lowest.amount !== variableEstimate.highest.amount ? (
                  <span className="ml-1 text-[color:var(--muted-fg)]">
                    (mín {formatMoney(variableEstimate.lowest)} · máx{" "}
                    {formatMoney(variableEstimate.highest)})
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAmountText(
                      (variableEstimate.average.amount / 100).toFixed(2).replace(".", ","),
                    );
                    setExpenseNature("VARIABLE");
                    setConfidence("ESTIMATED");
                  }}
                  className="rounded-lg bg-[color:var(--color-brand-600)] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[color:var(--color-brand-700)]"
                >
                  Usar média
                </button>
                <button
                  type="button"
                  title="Média com margem de segurança de +10% para bandeiras tarifárias e picos sazonais"
                  onClick={() => {
                    setAmountText(
                      (variableEstimate.withSafetyMargin.amount / 100).toFixed(2).replace(".", ","),
                    );
                    setExpenseNature("VARIABLE");
                    setConfidence("ESTIMATED");
                  }}
                  className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2.5 py-1 text-xs font-medium transition hover:bg-[color:var(--card-border)]"
                >
                  Média +10%
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {shape === "INSTALLMENTS" && !editing ? (
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

        {shape === "RECURRING" && !editing ? (
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
            editing
              ? "Vencimento"
              : shape === "RECURRING"
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
          onChange={(event) => onCategoryChange(event.target.value)}
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

        {editing ? (
          <div className="border-t border-[color:var(--card-border)] pt-4">
            {confirmingDelete ? (
              <Callout tone="critical" title="Excluir esta conta?">
                <p className="text-sm">
                  Ela sai da projeção e dos avisos de vencimento na mesma hora. Não dá para
                  desfazer.
                  {alreadySettled ? " Os pagamentos já registrados continuam nos lançamentos." : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void onDelete()}
                    disabled={saving}
                  >
                    Excluir
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
                Excluir conta
              </Button>
            )}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
