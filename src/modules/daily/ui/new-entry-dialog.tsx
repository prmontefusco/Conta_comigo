"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  addMonthsToKey,
  calendarDate,
  dayOfWeek,
  formatMonthKey,
  partsOf,
  type CalendarDate,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { allocate, fromDecimalString } from "@/core/money/money";
import { Button, Callout } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { dueDateFor, statementMonthForPurchase } from "@/modules/cards/domain/credit-card";
import type { DailyEntry } from "@/modules/daily/domain/daily-entries";
import { MemberField } from "@/modules/household/ui/member-field";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  ReceiptScanButton,
  type ReceiptSuggestion,
} from "@/modules/receipts/ui/receipt-scan-button";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Recording — and correcting — what actually happened.
 *
 * One dialog for both directions because the questions are almost the same,
 * and because the household's day is one sequence of events, not two screens.
 *
 * Three decisions are worth stating:
 *
 * - Paying with a card does not create an expense transaction. It creates a
 *   purchase, which is consumption today and cash on a fatura later. Writing
 *   both would count the money twice (docs/DOMAIN.md).
 * - Money already received is recorded as a transaction. When the person says
 *   it repeats, the rule that feeds the projection starts at the *next*
 *   occurrence, never at this one - otherwise today's salary would be
 *   projected again as if it were still to come.
 * - Corrigir usa este mesmo formulário. Um valor digitado errado vira saldo
 *   errado no mesmo instante, e o conserto precisa estar onde a pessoa
 *   percebeu o erro: na própria lista do dia a dia. O que a edição **não**
 *   faz é trocar dinheiro em conta por compra no crédito — são dois
 *   documentos diferentes, e converter um no outro em silêncio é a forma mais
 *   fácil de duplicar um gasto. Para isso, a tela pede para excluir e lançar
 *   de novo.
 */

type Mode = "EXPENSE" | "INCOME";

const REPEAT_OPTIONS = [
  { value: "NONE", label: "Não se repete" },
  { value: "EVERY_N_DAYS", label: "Todo dia" },
  { value: "WEEKLY", label: "Toda semana" },
  { value: "BIWEEKLY", label: "A cada quinze dias" },
  { value: "MONTHLY", label: "Todo mês" },
  { value: "ANNUAL", label: "Uma vez por ano" },
] as const;

type Repeat = (typeof REPEAT_OPTIONS)[number]["value"];

export function NewEntryDialog({
  mode,
  entry = null,
  onClose,
}: {
  /** `EXPENSE` ou `INCOME` para um lançamento novo; `null` quando o diálogo está fechado ou editando. */
  mode: Mode | null;
  /** O lançamento sendo corrigido, quando houver. */
  entry?: DailyEntry | null;
  onClose: () => void;
}) {
  const { accounts, cards, categories, asOf } = useFinance();
  const { household } = useSession();
  const collections = useCollections();

  const editing = entry !== null;
  const open = mode !== null || editing;

  // Ao editar, a direção vem do próprio lançamento.
  const effectiveMode: Mode = entry
    ? entry.direction === "IN"
      ? "INCOME"
      : "EXPENSE"
    : (mode ?? "EXPENSE");
  const isIncome = effectiveMode === "INCOME";
  const editingCardPurchase = entry?.kind === "CARD_PURCHASE";

  const openAccounts = useMemo(() => accounts.filter((account) => !account.archived), [accounts]);
  const openCards = useMemo(() => cards.filter((card) => !card.archived), [cards]);

  const relevantCategories = categories.filter((category) =>
    isIncome ? category.kind === "INCOME" : category.kind === "EXPENSE",
  );

  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState<string>(asOf);
  // "conta:<id>" or "cartao:<id>", so one control answers "paid with what".
  const [paidWith, setPaidWith] = useState("");
  const [installments, setInstallments] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [visibility, setVisibility] = useState("HOUSEHOLD");
  const [repeat, setRepeat] = useState<Repeat>("NONE");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const defaultPaidWith = isIncome
    ? openAccounts[0]
      ? `conta:${openAccounts[0].id}`
      : ""
    : (openAccounts[0] && `conta:${openAccounts[0].id}`) ||
      (openCards[0] && `cartao:${openCards[0].id}`) ||
      "";

  useEffect(() => {
    if (!open) return;

    setError(null);
    setConfirmingDelete(false);

    if (!entry) {
      setDescription("");
      setAmountText("");
      setDate(asOf);
      setPaidWith(defaultPaidWith);
      setInstallments("1");
      setCategoryId("");
      setMemberId("");
      setVisibility("HOUSEHOLD");
      setRepeat("NONE");
      return;
    }

    setDescription(entry.description);
    setAmountText((entry.amount.amount / 100).toFixed(2).replace(".", ","));
    setDate(entry.date);
    setPaidWith(
      entry.creditCardId ? `cartao:${entry.creditCardId}` : `conta:${entry.accountId ?? ""}`,
    );
    setInstallments(String(entry.installmentCount ?? 1));
    setCategoryId(entry.categoryId ?? "");
    setMemberId(entry.responsibleMemberId ?? "");
    setVisibility(entry.visibility);
    setRepeat("NONE");
  }, [open, entry, asOf, defaultPaidWith]);

  const card = paidWith.startsWith("cartao:")
    ? openCards.find((item) => item.id === paidWith.slice("cartao:".length))
    : undefined;
  const accountId = paidWith.startsWith("conta:") ? paidWith.slice("conta:".length) : undefined;

  const amount = fromDecimalString(amountText);
  const parts = card ? Math.max(Number(installments) || 1, 1) : 1;
  const purchaseDate = tryDate(date);

  const preview =
    card && purchaseDate && amount && amount.amount > 0 && parts > 1
      ? allocate(amount, parts).map((value, index) => {
          const month = addMonthsToKey(statementMonthForPurchase(card, purchaseDate), index);
          return { month, amount: value, dueDate: dueDateFor(card, month) };
        })
      : null;

  if (!open) return null;

  const hasSomewhereToPutIt = isIncome ? openAccounts.length > 0 : paidWithOptions().length > 0;

  /** A data escolhida ainda não chegou: o que se está registrando é um plano. */
  const planning = !editing && purchaseDate !== null && purchaseDate > asOf;

  /**
   * Este lançamento nasceu da confirmação de uma conta.
   *
   * Editá-lo aqui mexeria só na transação e deixaria a obrigação dizendo que
   * foi paga por um valor que não existe mais. Excluí-lo deixaria a conta
   * quitada e o dinheiro fora do saldo, sem nada apontando o erro.
   */
  const fromSettlement = Boolean(entry?.settlesObligationId);

  /**
   * Onde o dinheiro pode estar.
   *
   * Ao corrigir, a lista fica restrita ao tipo do próprio lançamento: uma
   * compra no crédito e uma saída de conta são documentos diferentes, e trocar
   * um pelo outro aqui criaria uma segunda forma de gravar o mesmo gasto.
   */
  function paidWithOptions() {
    const accountOptions = openAccounts.map((account) => ({
      value: `conta:${account.id}`,
      label: isIncome ? account.name : `${account.name} (dinheiro em conta)`,
    }));
    const cardOptions = openCards.map((item) => ({
      value: `cartao:${item.id}`,
      label: `${item.name} (crédito)`,
    }));

    if (editing) return editingCardPurchase ? cardOptions : accountOptions;
    return isIncome ? accountOptions : [...accountOptions, ...cardOptions];
  }

  /**
   * Fills the form from a photo.
   *
   * Only fields the reading is sure about are touched, and nothing is saved:
   * the person sees the filled form and confirms it. A card is preselected
   * only when the household has exactly one - guessing between three would be
   * a wrong fatura, which is worse than one more tap.
   */
  function applyReading(reading: ReceiptSuggestion) {
    if (reading.description) setDescription(reading.description);
    if (reading.amount !== null) setAmountText(reading.amount.toFixed(2).replace(".", ","));
    if (reading.date) setDate(reading.date);
    if (reading.categoryId) setCategoryId(reading.categoryId);

    const parcelado = (reading.installments ?? 1) > 1;
    const noCredito = parcelado || reading.paymentMethod === "CREDITO";

    if (parcelado) setInstallments(String(reading.installments));
    if (noCredito && openCards.length === 1 && !paidWith.startsWith("cartao:")) {
      setPaidWith(`cartao:${openCards[0]!.id}`);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    if (!amount || amount.amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (description.trim().length < 2) {
      setError(isIncome ? "Descreva o que você recebeu." : "Descreva o gasto.");
      return;
    }
    const when = tryDate(date);
    if (!when) {
      setError("Informe uma data válida.");
      return;
    }
    // Corrigir a data para o futuro transformaria um fato em plano, e são
    // documentos diferentes — o mesmo motivo pelo qual não se troca conta por
    // cartão aqui.
    if (editing && when > asOf) {
      setError(
        "A data não pode ficar no futuro. Se este lançamento ainda não aconteceu, exclua e registre como planejado.",
      );
      return;
    }
    if (!isIncome && !card && !accountId) {
      setError("Escolha de onde saiu o dinheiro.");
      return;
    }
    if (isIncome && !accountId) {
      setError("Escolha em qual conta o dinheiro entrou.");
      return;
    }
    if (!isIncome && !categoryId) {
      setError("Escolha uma categoria para o gasto.");
      return;
    }
    if (card && (parts < 1 || parts > 120)) {
      setError("O número de parcelas precisa estar entre 1 e 120.");
      return;
    }
    // Uma compra no crédito com data futura não tem como virar compromisso
    // genérico: ela pertence a uma fatura, e uma obrigação avulsa seria paga de
    // uma conta — contando o mesmo gasto duas vezes quando a fatura chegasse.
    if (!editing && card && when > asOf) {
      setError(
        "Ainda não dá para registrar uma compra futura no cartão. Registre no dia em que ela acontecer.",
      );
      return;
    }

    setSaving(true);
    try {
      if (editing && entry) {
        await saveCorrection(entry, when);
      } else if (when > asOf) {
        // Ainda não aconteceu, então ainda não é dinheiro.
        //
        // Gravar uma transação com data futura produzia a contradição que esta
        // mudança existe para desfazer: o valor entrava nos totais do mês como
        // realizado, ficava fora do saldo — que corta por data — e era
        // invisível para a projeção, que não lê transações. Vira compromisso,
        // que é o que o aplicativo já sabe representar e projetar.
        //
        // `ESTIMATED` e `OCCASIONAL` porque é um plano avulso, não renda fixa:
        // o cálculo da capacidade de pagamento oferecida a credores só pode
        // contar com o que se repete.
        await collections.obligations.create({
          householdId: household.id,
          direction: isIncome ? "INFLOW" : "OUTFLOW",
          origin: "MANUAL",
          description: description.trim(),
          amount,
          dueDate: when,
          competenceDate: when,
          ...(categoryId ? { categoryId } : {}),
          ...(accountId ? { expectedAccountId: accountId } : {}),
          expenseNature: "OCCASIONAL",
          confidence: "ESTIMATED",
          visibility: visibility as never,
          ...(memberId ? { responsibleMemberId: memberId } : {}),
          status: "SCHEDULED",
          settledAmount: { amount: 0, currency: amount.currency },
          settlementTransactionIds: [],
        } as never);
      } else if (card) {
        await collections.cardPurchases.create({
          householdId: household.id,
          creditCardId: card.id,
          description: description.trim(),
          totalAmount: amount,
          purchaseDate: when,
          // The consumption belongs to the day it happened; the instalments
          // move cash later. Two views of the same purchase.
          competenceDate: when,
          categoryId,
          installmentCount: parts,
          visibility: visibility as never,
          ...(memberId ? { responsibleMemberId: memberId } : {}),
        } as never);
      } else {
        await collections.transactions.create({
          householdId: household.id,
          kind: isIncome ? "INCOME" : "EXPENSE",
          amount,
          transactionDate: when,
          competenceDate: when,
          description: description.trim(),
          visibility: visibility as never,
          accountId,
          ...(categoryId ? { categoryId } : {}),
          ...(memberId ? { responsibleMemberId: memberId } : {}),
        } as never);
      }

      if (!editing && isIncome && repeat !== "NONE") {
        const nextStart = nextOccurrenceAfter(when, repeat);
        const { day, month } = partsOf(nextStart);

        await collections.recurringRules.create({
          householdId: household.id,
          direction: "INFLOW",
          description: description.trim(),
          amount,
          frequency: repeat as never,
          interval: 1,
          ...(repeat === "MONTHLY" || repeat === "ANNUAL" ? { dayOfMonth: day } : {}),
          ...(repeat === "WEEKLY" || repeat === "BIWEEKLY"
            ? { dayOfWeek: dayOfWeek(nextStart) }
            : {}),
          ...(repeat === "ANNUAL" ? { monthOfYear: month } : {}),
          startDate: nextStart,
          weekendPolicy: "KEEP",
          ...(categoryId ? { categoryId } : {}),
          expectedAccountId: accountId,
          expenseNature: "FIXED",
          confidence: "CONFIRMED",
          visibility: visibility as never,
          ...(memberId ? { responsibleMemberId: memberId } : {}),
          active: true,
        } as never);
      }

      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Grava a correção no documento que já existe.
   *
   * A data de competência acompanha a data do lançamento: quem corrige o dia
   * de um gasto está dizendo em que mês ele deveria estar, e deixar a
   * competência para trás manteria o gasto no mês errado dos relatórios.
   */
  async function saveCorrection(current: DailyEntry, when: CalendarDate) {
    if (!amount) return;

    if (current.kind === "CARD_PURCHASE") {
      await collections.cardPurchases.update(current.id, {
        ...(card ? { creditCardId: card.id } : {}),
        description: description.trim(),
        totalAmount: amount,
        purchaseDate: when,
        competenceDate: when,
        categoryId,
        installmentCount: parts,
        visibility: visibility as never,
        responsibleMemberId: memberId || null,
      } as never);
      return;
    }

    await collections.transactions.update(current.id, {
      amount,
      transactionDate: when,
      competenceDate: when,
      description: description.trim(),
      visibility: visibility as never,
      ...(accountId ? { accountId } : {}),
      // Uma receita pode legitimamente ficar sem categoria, e `null` é o que
      // apaga o campo — `undefined` deixaria a categoria antiga no documento.
      // Numa despesa este valor nunca é vazio: a validação acima exige uma.
      categoryId: categoryId || null,
      responsibleMemberId: memberId || null,
    } as never);
  }

  async function onDelete() {
    if (!entry) return;
    setError(null);
    setSaving(true);
    try {
      if (entry.kind === "CARD_PURCHASE") await collections.cardPurchases.remove(entry.id);
      else await collections.transactions.remove(entry.id);
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
      title={
        editing
          ? isIncome
            ? "Corrigir recebimento"
            : "Corrigir gasto"
          : planning
            ? isIncome
              ? "Planejar recebimento"
              : "Planejar gasto"
            : isIncome
              ? "Registrar recebimento"
              : "Registrar gasto"
      }
      description={
        editing
          ? "Ajuste o que estiver errado. A correção vale na hora para saldo, relatórios e projeção."
          : planning
            ? "A data escolhida ainda não chegou, então isto entra como plano."
            : isIncome
              ? "O valor líquido que efetivamente caiu na conta: salário, diária, comissão ou benefício."
              : "Mercado, combustível, farmácia, estacionamento — o que você gastou hoje."
      }
    >
      {fromSettlement ? (
        <div className="space-y-4">
          <Callout tone="attention" title="Este lançamento veio de uma conta">
            Ele foi criado quando você confirmou {isIncome ? "o recebimento" : "o pagamento"} de{" "}
            <strong>{entry?.description}</strong>. Corrigir ou excluir por aqui mexeria só na metade
            do registro e deixaria a conta dizendo que foi {isIncome ? "recebida" : "paga"} por um
            valor que não existe mais.
          </Callout>
          <div className="flex gap-2">
            <Link href="/app/contas" className="flex-1">
              <Button className="w-full">Abrir Contas</Button>
            </Link>
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : !hasSomewhereToPutIt ? (
        <div className="space-y-4">
          <Callout tone="attention" title="Falta cadastrar onde o dinheiro está">
            Para registrar {isIncome ? "um recebimento" : "um gasto"} é preciso ter ao menos uma
            conta {isIncome ? "" : "ou um cartão "}cadastrada. Uma carteira de dinheiro vivo também
            vale: cadastre uma conta do tipo Carteira.
          </Callout>
          <div className="flex gap-2">
            <Link href="/app/contas-bancarias" className="flex-1">
              <Button className="w-full">Cadastrar conta</Button>
            </Link>
            <Button type="button" variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <FormError>{error}</FormError> : null}

          {!isIncome && !editing ? <ReceiptScanButton onRead={applyReading} /> : null}

          <TextField
            label="Descrição"
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={isIncome ? "Salário líquido na conta" : "Mercado"}
          />

          <MoneyField
            label={
              card && parts > 1 ? "Valor total" : isIncome ? "Valor líquido recebido" : "Valor"
            }
            required
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="0,00"
            hint={
              card && parts > 1
                ? "O valor cheio da compra, não o da parcela."
                : isIncome
                  ? "Informe o valor líquido que caiu na sua conta (não o valor bruto do holerite)."
                  : undefined
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <DateField
              label={isIncome ? "Data em que recebeu" : "Data do gasto"}
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            {card ? (
              <TextField
                label="Parcelas"
                type="number"
                min={1}
                max={120}
                required
                value={installments}
                onChange={(event) => setInstallments(event.target.value)}
              />
            ) : null}
          </div>

          <SelectField
            label={isIncome ? "Caiu em" : "Pago com"}
            required
            value={paidWith}
            onChange={(event) => setPaidWith(event.target.value)}
            options={paidWithOptions()}
            hint={
              editing
                ? editingCardPurchase
                  ? "Para mover esta compra para uma conta, exclua aqui e registre de novo — são registros diferentes."
                  : "Para mover este lançamento para o cartão de crédito, exclua aqui e registre de novo — são registros diferentes."
                : card
                  ? "Compras no crédito entram na fatura; o dinheiro sai só no pagamento dela."
                  : undefined
            }
          />

          <SelectField
            label="Categoria"
            required={!isIncome}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            options={[
              { value: "", label: isIncome ? "Sem categoria" : "Escolha uma categoria" },
              ...relevantCategories.map((category) => ({
                value: category.id,
                label: `${category.icon ?? ""} ${category.name}`.trim(),
              })),
            ]}
          />

          {isIncome && !editing ? (
            <SelectField
              label="Esse recebimento se repete?"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value as Repeat)}
              hint="A projeção passa a contar as próximas ocorrências. Esta, você já recebeu."
              options={REPEAT_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          ) : null}

          <MemberField
            label="Quem"
            hint="Serve para o grupo ver quanto cada pessoa recebeu e gastou."
            value={memberId}
            onChange={setMemberId}
            emptyLabel="Do grupo (ninguém em especial)"
          />

          <SelectField
            label={isIncome ? "Esta receita é" : "Este gasto é"}
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
            options={[
              { value: "HOUSEHOLD", label: "Do grupo" },
              { value: "PERSONAL", label: "Pessoal" },
            ]}
          />

          {preview ? (
            <Callout tone="info" title="Como isso vai cair nas faturas">
              <ul className="mt-1 space-y-0.5 text-sm">
                {preview.slice(0, 6).map((item) => (
                  <li key={item.month} className="tabular">
                    {formatMonthKey(item.month)}: {formatMoney(item.amount)} · vence{" "}
                    {item.dueDate.split("-").reverse().join("/")}
                  </li>
                ))}
                {preview.length > 6 ? (
                  <li style={{ color: "var(--muted-fg)" }}>
                    e mais {preview.length - 6} {preview.length - 6 === 1 ? "parcela" : "parcelas"},
                    até {formatMonthKey(preview[preview.length - 1]!.month)}
                  </li>
                ) : null}
              </ul>
            </Callout>
          ) : null}

          {planning ? (
            <Callout
              tone="info"
              title={
                isIncome ? "Isto ainda não é dinheiro em conta" : "Isto ainda não saiu da conta"
              }
            >
              <span className="text-sm">
                {isIncome
                  ? "Vai entrar como previsto: aparece na projeção e em Contas a receber, mas não no saldo nem em “Entrou”. Quando cair, você confirma o valor que realmente entrou — que pode ser diferente deste."
                  : "Vai entrar como conta a pagar: aparece na projeção e em Contas, mas não sai do saldo. Quando pagar, você confirma o valor real."}
              </span>
            </Callout>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Salvando…" : planning ? "Planejar" : "Salvar"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>

          {editing ? (
            <div className="border-t border-[color:var(--card-border)] pt-4">
              {confirmingDelete ? (
                <Callout tone="critical" title="Excluir este lançamento?">
                  <p className="text-sm">
                    Ele sai do saldo, dos relatórios e da projeção na mesma hora. Não dá para
                    desfazer.
                    {entry?.kind === "CARD_PURCHASE" && (entry.installmentCount ?? 1) > 1
                      ? " Todas as parcelas desta compra saem junto."
                      : ""}
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
                  Excluir lançamento
                </Button>
              )}
            </div>
          ) : null}
        </form>
      )}
    </Modal>
  );
}

function tryDate(value: string): CalendarDate | null {
  try {
    return calendarDate(value);
  } catch {
    return null;
  }
}

/**
 * When the rule should start.
 *
 * One period after the payment just recorded, so the money already in the
 * account is never projected a second time.
 */
function nextOccurrenceAfter(date: CalendarDate, repeat: Repeat): CalendarDate {
  switch (repeat) {
    case "EVERY_N_DAYS":
      return addDays(date, 1);
    case "WEEKLY":
      return addDays(date, 7);
    case "BIWEEKLY":
      return addDays(date, 14);
    case "MONTHLY":
      return addMonths(date, 1);
    case "ANNUAL":
      return addMonths(date, 12);
    case "NONE":
      return date;
  }
}
