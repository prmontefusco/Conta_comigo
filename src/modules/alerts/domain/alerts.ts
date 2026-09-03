import {
  type CalendarDate,
  addDays,
  differenceInDays,
  formatCalendarDate,
  formatMonthKey,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { sum, type Money } from "@/core/money/money";
import {
  computeLimitStatus,
  type CardStatement,
  type CreditCard,
} from "@/modules/cards/domain/credit-card";
import type { BudgetStatus } from "@/modules/budget/domain/budget";
import type { DashboardOverview } from "@/modules/dashboard/domain/overview";
import { buildSchedule, type Debt } from "@/modules/debts/domain/debt";
import { classifyDebt, essentialServiceConsequence } from "@/modules/debts/domain/debt-risk";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import { progressOf, type Reserve } from "@/modules/reserves/domain/reserve";

/**
 * Alerts.
 *
 * Every message here states a fact and its consequence. None of them tells
 * someone they did badly, because the people this product is for often already
 * believe that, and it is not the software's place to confirm it
 * (docs/PRODUCT.md section 12).
 *
 * Alerts are computed on read. There is no scheduled job and no notification
 * channel until there is a real reason for one.
 */

export type AlertSeverity = "INFO" | "ATTENTION" | "URGENT";

export type AlertKind =
  | "OVERDUE_BILLS"
  | "DUE_SOON"
  | "STATEMENT_DUE"
  | "PROJECTED_DEFICIT"
  | "NEGATIVE_BALANCE_AHEAD"
  | "CARD_LIMIT_HIGH"
  | "RESERVE_BELOW_TARGET"
  | "INSTALLMENTS_ENDING"
  | "LOW_UNCOMMITTED_CASH"
  /** A debt whose collateral - car, home, equipment - can be taken. */
  | "COLLATERAL_AT_RISK"
  /** An overdue bill whose non-payment removes something the household lives on. */
  | "ESSENTIAL_SERVICE_AT_RISK"
  /** A category has gone past the ceiling the household set for it. */
  | "BUDGET_OVERSPENT";

export interface Alert {
  readonly id: string;
  readonly kind: AlertKind;
  readonly severity: AlertSeverity;
  /** Neutral, factual, in pt-BR. */
  readonly message: string;
  /** Where tapping the alert should take the person. */
  readonly href?: string;
  readonly date?: CalendarDate;
  readonly amount?: Money;
}

export interface AlertInput {
  readonly asOf: CalendarDate;
  readonly overview: DashboardOverview;
  readonly forecast: ForecastResult;
  readonly cards: readonly CreditCard[];
  readonly cardStatements: readonly CardStatement[];
  readonly reserves: readonly Reserve[];
  readonly debts?: readonly Debt[];
  /** This month's budget standing, when there is a budget. */
  readonly budgetStatus?: BudgetStatus | null;
  /** Instalments already paid, per debt. Absent means none recorded. */
  readonly paidDebtInstallments?: ReadonlyMap<string, readonly number[]>;
}

export function buildAlerts(input: AlertInput): Alert[] {
  const alerts: Alert[] = [];
  const { overview, forecast: projection } = input;

  /* --- What is already late ---------------------------------------- */

  if (overview.today.overdue.length > 0) {
    const count = overview.today.overdue.length;
    alerts.push({
      id: "overdue",
      kind: "OVERDUE_BILLS",
      severity: "URGENT",
      message:
        count === 1
          ? `Há 1 conta vencida, somando ${formatMoney(overview.today.payables.overdue)}.`
          : `Há ${count} contas vencidas, somando ${formatMoney(overview.today.payables.overdue)}.`,
      href: "/contas?filtro=vencidas",
      amount: overview.today.payables.overdue,
    });
  }

  /* --- What a late payment actually costs --------------------------- */

  // Ordered before "due soon" on purpose: an amount is not the only thing that
  // makes a bill urgent. Losing the car that takes someone to work, or the
  // electricity, outranks a larger bill with no such consequence.

  const essential = overview.today.overdue
    .map((obligation) => ({
      obligation,
      consequence: essentialServiceConsequence(obligation.categoryId),
    }))
    .filter((item): item is { obligation: (typeof item)["obligation"]; consequence: string } =>
      Boolean(item.consequence),
    );

  if (essential.length > 0) {
    const first = essential[0]!;
    alerts.push({
      id: "essential-service",
      kind: "ESSENTIAL_SERVICE_AT_RISK",
      severity: "URGENT",
      message:
        essential.length === 1
          ? `${first.obligation.description} está em atraso: o risco aqui é ${first.consequence}.`
          : `${essential.length} contas de serviço essencial estão em atraso, entre elas ${first.obligation.description} — risco de ${first.consequence}.`,
      href: "/contas?filtro=vencidas",
      date: first.obligation.dueDate,
    });
  }

  for (const debt of input.debts ?? []) {
    if (debt.status === "SETTLED") continue;
    const risk = classifyDebt(debt);
    if (risk.guarantee !== "COLLATERAL") continue;

    const paidCount = (input.paidDebtInstallments?.get(debt.id) ?? []).length;
    const dueByNow = buildSchedule(debt).filter((item) => item.dueDate <= input.asOf).length;
    const late = dueByNow - paidCount;

    // A debt marked in default is late whatever the payment records say.
    if (late <= 0 && debt.status !== "IN_DEFAULT") continue;

    alerts.push({
      id: `collateral-${debt.id}`,
      kind: "COLLATERAL_AT_RISK",
      severity: "URGENT",
      message:
        late > 0
          ? `${debt.description} está com ${late} ${late === 1 ? "parcela" : "parcelas"} em atraso. ${risk.consequence}`
          : `${debt.description} está marcada como em atraso. ${risk.consequence}`,
      href: "/dividas",
    });
  }

  /* --- What is about to be due ------------------------------------- */

  if (overview.today.dueSoon.length > 0) {
    const count = overview.today.dueSoon.length;
    const nearest = overview.today.dueSoon[0];
    alerts.push({
      id: "due-soon",
      kind: "DUE_SOON",
      severity: "ATTENTION",
      message:
        count === 1
          ? `1 conta vence nos próximos sete dias: ${nearest?.description} em ${formatCalendarDate(nearest!.dueDate)}.`
          : `${count} contas vencem nos próximos sete dias.`,
      href: "/contas",
      ...(nearest ? { date: nearest.dueDate } : {}),
    });
  }

  /* --- Card statements --------------------------------------------- */

  const sevenDaysOut = addDays(input.asOf, 7);
  for (const statement of input.cardStatements) {
    if (statement.remainingAmount.amount <= 0) continue;
    if (statement.dueDate < input.asOf || statement.dueDate > sevenDaysOut) continue;

    const card = input.cards.find((item) => item.id === statement.creditCardId);
    alerts.push({
      id: `statement-${statement.id}`,
      kind: "STATEMENT_DUE",
      severity: "ATTENTION",
      message: `A fatura do ${card?.name ?? "cartão"} vence em ${formatCalendarDate(
        statement.dueDate,
      )}: ${formatMoney(statement.remainingAmount)}.`,
      href: `/cartoes/${statement.creditCardId}`,
      date: statement.dueDate,
      amount: statement.remainingAmount,
    });
  }

  /* --- Months that do not close ------------------------------------ */

  // A partial first month is skipped for the same reason the summary skips it:
  // income already received this month is not in the projection, so its
  // shortfall would be an artefact of when the person happened to open the app.
  const deficitMonth = projection.months.find((month) => month.isDeficit && !month.isPartial);
  if (deficitMonth) {
    alerts.push({
      id: `deficit-${deficitMonth.month}`,
      kind: "PROJECTED_DEFICIT",
      severity: "ATTENTION",
      message: `Os compromissos previstos superam as receitas de ${formatMonthKey(
        deficitMonth.month,
      )} em ${formatMoney(deficitMonth.deficitAmount)}.`,
      href: "/projecao",
      amount: deficitMonth.deficitAmount,
    });
  }

  /* --- The day the money runs out ---------------------------------- */

  if (projection.summary.firstNegativeDate) {
    const days = differenceInDays(input.asOf, projection.summary.firstNegativeDate);
    const when =
      days <= 0
        ? "hoje"
        : days === 1
          ? `amanhã, ${formatCalendarDate(projection.summary.firstNegativeDate)}`
          : `em ${formatCalendarDate(projection.summary.firstNegativeDate)}, daqui a ${days} dias`;

    alerts.push({
      id: "negative-ahead",
      kind: "NEGATIVE_BALANCE_AHEAD",
      severity: days <= 30 ? "URGENT" : "ATTENTION",
      message: `Pela projeção atual, o saldo livre fica negativo ${when}.`,
      href: "/projecao",
      date: projection.summary.firstNegativeDate,
    });
  }

  /* --- Ceilings the household set for itself ------------------------ */

  // Said while the month can still be changed, and phrased as information:
  // a ceiling that turns out to be unrealistic is a number to revise, not a
  // failure to announce.
  const overspent = (input.budgetStatus?.lines ?? [])
    .filter((line) => line.overspend.amount > 0)
    .sort((a, b) => b.overspend.amount - a.overspend.amount);

  if (overspent.length > 0) {
    const worst = overspent[0]!;
    alerts.push({
      id: "budget-overspent",
      kind: "BUDGET_OVERSPENT",
      severity: "ATTENTION",
      message:
        overspent.length === 1
          ? `Uma categoria passou do teto do mês em ${formatMoney(worst.overspend)}.`
          : `${overspent.length} categorias passaram do teto do mês, somando ${formatMoney(
              sum(overspent.map((line) => line.overspend)),
            )}.`,
      href: "/orcamento",
      amount: worst.overspend,
    });
  }

  /* --- Card limit --------------------------------------------------- */

  for (const card of input.cards) {
    if (card.archived) continue;
    if (card.creditLimit.amount === 0) continue;

    // The same function the card screen uses, so the two never disagree.
    const limit = computeLimitStatus(
      card,
      input.cardStatements.filter((statement) => statement.creditCardId === card.id),
    );
    if (limit.utilisation < 0.8) continue;

    alerts.push({
      id: `limit-${card.id}`,
      kind: "CARD_LIMIT_HIGH",
      severity: limit.isOverLimit ? "URGENT" : "ATTENTION",
      message: limit.isOverLimit
        ? `Os compromissos do ${card.name} somam ${formatMoney(limit.committed)}, ` +
          `acima do limite de ${formatMoney(limit.creditLimit)}.`
        : `${Math.round(limit.utilisation * 100)}% do limite do ${card.name} está comprometido.`,
      href: `/cartoes/${card.id}`,
    });
  }

  /* --- Reserves ----------------------------------------------------- */

  for (const reserve of input.reserves) {
    if (reserve.archived || !reserve.targetAmount) continue;
    const progress = progressOf(reserve);
    if (!progress.belowTarget) continue;

    alerts.push({
      id: `reserve-${reserve.id}`,
      kind: "RESERVE_BELOW_TARGET",
      severity: "INFO",
      message: `Faltam ${formatMoney(progress.missing)} para a reserva "${reserve.name}" atingir a meta.`,
      href: "/reservas",
      amount: progress.missing,
    });
  }

  /* --- Installments about to end ------------------------------------ */

  const endingSoon = projection.events.filter(
    (event) =>
      event.source === "DEBT_INSTALLMENT" &&
      /\((\d+)\/\1\)$/.test(event.description) &&
      event.date <= addDays(input.asOf, 60),
  );
  for (const event of endingSoon) {
    alerts.push({
      id: `ending-${event.referenceId}-${event.date}`,
      kind: "INSTALLMENTS_ENDING",
      severity: "INFO",
      message: `A última parcela de "${event.description.replace(/\s*\(\d+\/\d+\)$/, "")}" vence em ${formatCalendarDate(
        event.date,
      )}. A partir daí esse valor deixa de comprometer o mês.`,
      href: "/dividas",
      date: event.date,
      amount: event.amount,
    });
  }

  /* --- Very little room left this month ----------------------------- */

  if (overview.today.uncommittedCash.amount < 0 && overview.today.spendableCash.amount >= 0) {
    alerts.push({
      id: "low-uncommitted",
      kind: "LOW_UNCOMMITTED_CASH",
      severity: "ATTENTION",
      message: `${formatMoney(overview.today.spendableCash)} do saldo atual já está destinado a contas deste mês, e ainda faltam ${formatMoney(
        {
          amount: -overview.today.uncommittedCash.amount,
          currency: overview.today.uncommittedCash.currency,
        },
      )}.`,
      href: "/contas",
    });
  }

  return alerts.sort(bySeverity);
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { URGENT: 0, ATTENTION: 1, INFO: 2 };

function bySeverity(a: Alert, b: Alert): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
}
