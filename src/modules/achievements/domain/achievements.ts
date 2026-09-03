import type { CalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { type Money, subtract } from "@/core/money/money";
import type { CardStatement } from "@/modules/cards/domain/credit-card";
import { outstandingPrincipal, type Debt } from "@/modules/debts/domain/debt";
import type { Reserve } from "@/modules/reserves/domain/reserve";
import { starterReserveStatus } from "@/modules/reserves/domain/starter-reserve";
import type { DebtId, MemberId } from "@/modules/shared/domain/common";

/**
 * What the household has already achieved, and what it is closest to.
 *
 * Getting out of debt takes months in which nothing visible happens. The
 * milestones here exist so that something does: a quarter of a financing
 * amortised, a fatura back in the green, the first R$ 500 put aside. They are
 * derived from the same records as every other number - nothing is awarded,
 * stored or gamified, and there is no streak to lose.
 *
 * Two rules keep it honest:
 *
 * - Every milestone states the fact behind it. "Vocês quitaram o empréstimo"
 *   is only shown when the balance really is zero.
 * - Nothing is congratulated twice, and nothing scolds. A missed month is not
 *   a milestone lost; it simply is not one gained.
 */

export type AchievementKind =
  | "DEBT_PAID"
  | "DEBT_PROGRESS"
  | "STATEMENTS_CLEAR"
  | "STARTER_RESERVE"
  | "POSITIVE_MONTH"
  | "NO_OVERDUE_BILLS";

export interface Achievement {
  readonly id: string;
  readonly kind: AchievementKind;
  readonly title: string;
  /** The fact behind it, in one sentence. */
  readonly detail: string;
  readonly achieved: boolean;
  /** 0 to 1. Always 1 when achieved. */
  readonly progress: number;
  /** What is still missing, when it has not happened yet. */
  readonly remaining?: string;
  /** Whoever is recorded as responsible, when the milestone belongs to one person. */
  readonly memberId?: MemberId;
}

export interface ComputeAchievementsInput {
  readonly asOf: CalendarDate;
  readonly debts: readonly Debt[];
  readonly paidDebtInstallments: ReadonlyMap<DebtId, readonly number[]>;
  readonly cardStatements: readonly CardStatement[];
  readonly reserves: readonly Reserve[];
  /** Monthly living costs, for the starter reserve target. */
  readonly monthlyEssentials: Money;
  readonly overdueBillsCount: number;
  /** The month that just closed, when there is one to look back on. */
  readonly lastMonth?: { readonly received: Money; readonly spent: Money };
}

export interface AchievementsResult {
  readonly unlocked: readonly Achievement[];
  /** Not there yet, closest first. */
  readonly next: readonly Achievement[];
}

/** Quarters, because a 48-month financing needs something before month 48. */
const PROGRESS_STEPS = [0.25, 0.5, 0.75] as const;

export function computeAchievements(input: ComputeAchievementsInput): AchievementsResult {
  const all: Achievement[] = [];

  /* --- Debts --------------------------------------------------------- */

  for (const debt of input.debts) {
    const paid = input.paidDebtInstallments.get(debt.id) ?? [];
    const outstanding = outstandingPrincipal(debt, paid);
    const contracted = debt.principalContracted.amount;
    const ratio = contracted === 0 ? 1 : 1 - outstanding.amount / contracted;
    const settled = debt.status === "SETTLED" || outstanding.amount <= 0;
    const remainingInstallments = Math.max(debt.installmentCount - paid.length, 0);

    all.push({
      id: `debt-paid-${debt.id}`,
      kind: "DEBT_PAID",
      // Neutral wording on purpose: "quitada" would disagree with half the
      // descriptions people write ("Empréstimo pessoal quitada").
      title: settled ? `${debt.description} sem saldo devedor` : `Zerar ${debt.description}`,
      detail: settled
        ? `${debt.description} não tem mais saldo devedor.`
        : `Faltam ${formatMoney(outstanding)} para zerar ${debt.description}.`,
      achieved: settled,
      progress: clamp(ratio),
      ...(settled
        ? {}
        : {
            remaining:
              remainingInstallments === 1
                ? "falta 1 parcela"
                : `faltam ${remainingInstallments} parcelas`,
          }),
      ...(debt.responsibleMemberId ? { memberId: debt.responsibleMemberId } : {}),
    });

    if (settled) continue;

    // Only the next quarter is offered. Listing every step at once turns a
    // milestone into a checklist, which is the opposite of the point.
    const nextStep = PROGRESS_STEPS.find((step) => ratio < step);
    if (nextStep !== undefined) {
      const target = Math.round(contracted * nextStep);
      const missing = Math.max(target - (contracted - outstanding.amount), 0);

      all.push({
        id: `debt-progress-${debt.id}-${nextStep}`,
        kind: "DEBT_PROGRESS",
        title: `${Math.round(nextStep * 100)}% de ${debt.description} amortizados`,
        detail: `Já foram amortizados ${Math.round(ratio * 100)}% do valor contratado.`,
        achieved: false,
        progress: clamp(ratio / nextStep),
        remaining: `faltam ${formatMoney({ amount: missing, currency: debt.principalContracted.currency })}`,
        ...(debt.responsibleMemberId ? { memberId: debt.responsibleMemberId } : {}),
      });
    }

    for (const step of PROGRESS_STEPS) {
      if (ratio < step) continue;
      all.push({
        id: `debt-progress-${debt.id}-${step}-done`,
        kind: "DEBT_PROGRESS",
        title: `${Math.round(step * 100)}% de ${debt.description} amortizados`,
        detail: `Já foram amortizados ${Math.round(ratio * 100)}% do valor contratado.`,
        achieved: true,
        progress: 1,
        ...(debt.responsibleMemberId ? { memberId: debt.responsibleMemberId } : {}),
      });
    }
  }

  /* --- Cards --------------------------------------------------------- */

  const openStatements = input.cardStatements.filter(
    (statement) => statement.remainingAmount.amount > 0,
  );
  const overdueStatements = openStatements.filter((statement) => statement.dueDate < input.asOf);

  if (input.cardStatements.length > 0) {
    all.push({
      id: "statements-clear",
      kind: "STATEMENTS_CLEAR",
      title: "Nenhuma fatura atrasada",
      detail:
        overdueStatements.length === 0
          ? "Todas as faturas fechadas estão pagas ou dentro do prazo."
          : `${overdueStatements.length} ${overdueStatements.length === 1 ? "fatura venceu" : "faturas venceram"} e continuam em aberto.`,
      achieved: overdueStatements.length === 0,
      progress: overdueStatements.length === 0 ? 1 : 0,
      ...(overdueStatements.length === 0
        ? {}
        : {
            remaining:
              overdueStatements.length === 1
                ? "1 fatura a regularizar"
                : `${overdueStatements.length} faturas a regularizar`,
          }),
    });
  }

  /* --- Bills --------------------------------------------------------- */

  all.push({
    id: "no-overdue-bills",
    kind: "NO_OVERDUE_BILLS",
    title: "Nenhuma conta vencida",
    detail:
      input.overdueBillsCount === 0
        ? "Não há contas em atraso hoje."
        : `${input.overdueBillsCount} ${input.overdueBillsCount === 1 ? "conta está" : "contas estão"} em atraso.`,
    achieved: input.overdueBillsCount === 0,
    progress: input.overdueBillsCount === 0 ? 1 : 0,
    ...(input.overdueBillsCount === 0
      ? {}
      : {
          remaining:
            input.overdueBillsCount === 1
              ? "1 conta a regularizar"
              : `${input.overdueBillsCount} contas a regularizar`,
        }),
  });

  /* --- Reserve ------------------------------------------------------- */

  const starter = starterReserveStatus(input.reserves, input.monthlyEssentials);

  all.push({
    id: "starter-reserve",
    kind: "STARTER_RESERVE",
    title: "Reserva de partida formada",
    detail: starter.isComplete
      ? `A reserva de emergência chegou a ${formatMoney(starter.current)}.`
      : `A reserva está em ${formatMoney(starter.current)} de ${formatMoney(starter.target)}.`,
    achieved: starter.isComplete,
    progress: clamp(starter.ratio),
    ...(starter.isComplete ? {} : { remaining: `faltam ${formatMoney(starter.missing)}` }),
  });

  /* --- The month that closed ----------------------------------------- */

  if (input.lastMonth) {
    const result = subtract(input.lastMonth.received, input.lastMonth.spent);
    const positive = result.amount >= 0 && input.lastMonth.received.amount > 0;

    all.push({
      id: "positive-month",
      kind: "POSITIVE_MONTH",
      title: "Mês fechado no azul",
      detail: positive
        ? `No mês passado sobrou ${formatMoney(result)}.`
        : `No mês passado faltaram ${formatMoney({ amount: Math.abs(result.amount), currency: result.currency })}.`,
      achieved: positive,
      progress: positive ? 1 : 0,
      ...(positive ? {} : { remaining: "gastar menos do que entra em um mês" }),
    });
  }

  const unlocked = all.filter((achievement) => achievement.achieved);
  const next = all
    .filter((achievement) => !achievement.achieved)
    .sort((a, b) => b.progress - a.progress);

  return { unlocked, next };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
