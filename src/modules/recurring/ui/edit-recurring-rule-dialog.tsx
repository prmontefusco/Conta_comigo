"use client";

import { useEffect, useState } from "react";
import { deleteField } from "firebase/firestore";
import { fromDecimalString } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { FREQUENCY_LABELS, type RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import { MemberField } from "@/modules/household/ui/member-field";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Corrigindo a regra, não uma ocorrência.
 *
 * "Contas que se repetem" só oferecia "Paguei" em cada ocorrência prevista —
 * quem errou o valor, o dia ou a descrição ao criar a regra não tinha para
 * onde ir. A frequência em si não é editável aqui: trocar de "todo mês" para
 * "a cada N dias" muda que campos a regra usa para se ancorar, e isso é
 * recriar a regra, não corrigi-la.
 */

const MONTHLY_FAMILY: readonly RecurringRule["frequency"][] = [
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
];

export function EditRecurringRuleDialog({
  rule,
  onClose,
}: {
  rule: RecurringRule | null;
  onClose: () => void;
}) {
  const { categories } = useFinance();
  const collections = useCollections();

  const [direction, setDirection] = useState<"OUTFLOW" | "INFLOW">("OUTFLOW");
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [dayOfMonthText, setDayOfMonthText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [expenseNature, setExpenseNature] = useState("FIXED");
  const [confidence, setConfidence] = useState("CONFIRMED");
  const [visibility, setVisibility] = useState("HOUSEHOLD");
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!rule) return;
    setError(null);
    setConfirmingDelete(false);
    setDirection(rule.direction);
    setDescription(rule.description);
    setAmountText((rule.amount.amount / 100).toFixed(2).replace(".", ","));
    setDayOfMonthText(rule.dayOfMonth ? String(rule.dayOfMonth) : "");
    setCategoryId(rule.categoryId ?? "");
    setExpenseNature(rule.expenseNature);
    setConfidence(rule.confidence);
    setVisibility(rule.visibility);
    setMemberId(rule.responsibleMemberId ?? "");
  }, [rule]);

  if (!rule) return null;

  const editsDayOfMonth = MONTHLY_FAMILY.includes(rule.frequency);
  const relevantCategories = categories.filter((category) =>
    direction === "INFLOW" ? category.kind === "INCOME" : category.kind === "EXPENSE",
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!rule) return;

    const amount = fromDecimalString(amountText);
    if (!amount || amount.amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (description.trim().length < 2) {
      setError("Dê um nome para esta conta.");
      return;
    }

    let dayOfMonth: number | undefined;
    if (editsDayOfMonth) {
      dayOfMonth = Number(dayOfMonthText);
      if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        setError("Informe um dia entre 1 e 31.");
        return;
      }
    }

    setSaving(true);
    try {
      await collections.recurringRules.update(rule.id, {
        direction,
        description: description.trim(),
        amount,
        ...(editsDayOfMonth ? { dayOfMonth } : {}),
        categoryId: categoryId || deleteField(),
        expenseNature: expenseNature as never,
        confidence: confidence as never,
        visibility: visibility as never,
        responsibleMemberId: memberId || deleteField(),
      } as never);
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!rule) return;
    setError(null);
    setSaving(true);
    try {
      await collections.recurringRules.remove(rule.id);
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
      open={rule !== null}
      onClose={onClose}
      title="Editar conta recorrente"
      description={`Repete ${FREQUENCY_LABELS[rule.frequency].toLowerCase()}. A correção vale para as próximas ocorrências — o que já foi confirmado como pago ou recebido não muda.`}
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

        <TextField
          label="Descrição"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <MoneyField
          label={direction === "INFLOW" ? "Valor líquido a receber" : "Valor"}
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          placeholder="0,00"
        />

        {editsDayOfMonth ? (
          <TextField
            label="Dia do vencimento"
            type="number"
            min={1}
            max={31}
            required
            value={dayOfMonthText}
            onChange={(event) => setDayOfMonthText(event.target.value)}
            hint="Em meses mais curtos que esse dia, a conta cai no último dia do mês."
          />
        ) : (
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Frequência: {FREQUENCY_LABELS[rule.frequency]}. Para mudar a frequência, exclua esta
            regra e crie outra — os campos que ela usa são diferentes.
          </p>
        )}

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

        <div className="border-t border-[color:var(--card-border)] pt-4">
          {confirmingDelete ? (
            <Callout tone="critical" title="Excluir esta regra recorrente?">
              <p className="text-sm">
                Nenhuma ocorrência futura entra mais na projeção. O que já foi confirmado como pago
                ou recebido continua nos lançamentos. Não dá para desfazer.
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
              Excluir regra
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
