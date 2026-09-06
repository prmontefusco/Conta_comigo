import {
  addMonthsToKey,
  monthKeyOf,
  type CalendarDate,
  type MonthKey,
} from "@/core/date/calendar-date";
import { type Money, money, subtract } from "@/core/money/money";
import { buildSchedule, outstandingPrincipal, type Debt } from "@/modules/debts/domain/debt";

/**
 * A dívida caindo.
 *
 * Vinte e dois meses de parcela em dia é muito tempo para não ver nada
 * acontecer. O aplicativo sabia dizer o total devido e a data de quitação, e
 * não sabia dizer a única coisa que sustenta alguém no meio do caminho:
 * **está diminuindo, e quanto**.
 *
 * Não é ornamento. Para o público deste produto, o abandono raramente vem de
 * não conseguir pagar — vem de não enxergar diferença entre pagar e não pagar.
 *
 * ## O que este módulo não faz
 *
 * Não comemora o que não aconteceu. Se a dívida cresceu no período, ele diz
 * que cresceu; se não há histórico suficiente para comparar, devolve `null` em
 * vez de um zero que pareceria estagnação. Um progresso inventado seria pior
 * que nenhum: a pessoa confere com o extrato e perde a confiança no resto.
 */

export interface DebtCountdown {
  /** O que se deve hoje. */
  readonly current: Money;
  /** O que se devia no início da janela comparada. */
  readonly before: Money | null;
  /** Quanto caiu no período. Negativo quando cresceu. Null sem comparação. */
  readonly paidDown: Money | null;
  /** Fração já amortizada do total contratado, de 0 a 1. */
  readonly progress: number;
  /** Parcelas que faltam, somadas entre as dívidas. */
  readonly installmentsLeft: number;
  /** Parcelas já pagas, somadas. */
  readonly installmentsPaid: number;
  /** A dívida mais perto de acabar, para dar um alvo próximo. */
  readonly nextToClear: {
    readonly description: string;
    readonly installmentsLeft: number;
    readonly outstanding: Money;
  } | null;
}

export interface BuildDebtCountdownInput {
  readonly asOf: CalendarDate;
  readonly debts: readonly Debt[];
  readonly paidDebtInstallments: ReadonlyMap<string, readonly number[]>;
  /** Quantos meses atrás comparar. */
  readonly lookbackMonths?: number;
}

const DEFAULT_LOOKBACK = 3;

export function buildDebtCountdown(input: BuildDebtCountdownInput): DebtCountdown {
  const active = input.debts.filter((debt) => debt.status !== "SETTLED");

  let current = 0;
  let contracted = 0;
  let installmentsLeft = 0;
  let installmentsPaid = 0;
  let nextToClear: DebtCountdown["nextToClear"] = null;

  for (const debt of active) {
    const paid = input.paidDebtInstallments.get(debt.id) ?? [];
    const outstanding = outstandingPrincipal(debt, paid);

    current += outstanding.amount;
    contracted += debt.principalContracted.amount;
    installmentsPaid += paid.length;

    const left = Math.max(0, debt.installmentCount - paid.length);
    installmentsLeft += left;

    if (outstanding.amount > 0 && (nextToClear === null || left < nextToClear.installmentsLeft)) {
      nextToClear = {
        description: debt.description,
        installmentsLeft: left,
        outstanding,
      };
    }
  }

  const before = outstandingAsOfMonthsAgo(input, DEFAULT_LOOKBACK);

  return {
    current: money(current),
    before,
    paidDown: before ? subtract(before, money(current)) : null,
    progress: contracted === 0 ? 0 : clampFraction((contracted - current) / contracted),
    installmentsLeft,
    installmentsPaid,
    nextToClear,
  };
}

/**
 * O saldo devedor de alguns meses atrás.
 *
 * Reconstruído a partir do cronograma, não de um histórico gravado: as
 * parcelas com vencimento dentro da janela ainda não tinham sido pagas
 * naquele momento, então voltam ao saldo. É exato para o caso ordinário — o
 * pagamento em dia — e é o mesmo cronograma que todas as outras telas usam.
 *
 * Devolve null quando não há parcela nenhuma no período: sem movimento não há
 * comparação honesta a fazer, e um zero pareceria estagnação.
 */
function outstandingAsOfMonthsAgo(input: BuildDebtCountdownInput, months: number): Money | null {
  const lookback = input.lookbackMonths ?? months;
  const cutoff: MonthKey = addMonthsToKey(monthKeyOf(input.asOf), -lookback);

  let total = 0;
  let movement = 0;

  for (const debt of input.debts) {
    if (debt.status === "SETTLED") continue;
    const paid = input.paidDebtInstallments.get(debt.id) ?? [];
    const paidSet = new Set(paid);

    // Parcelas pagas cujo vencimento caiu depois do corte ainda estavam em
    // aberto naquela data.
    const schedule = buildSchedule(debt);
    const reinstated = schedule.filter(
      (item) => paidSet.has(item.number) && item.competenceMonth > cutoff,
    );

    movement += reinstated.length;
    total +=
      outstandingPrincipal(debt, paid).amount +
      reinstated.reduce((sofar, item) => sofar + item.principal.amount, 0);
  }

  return movement === 0 ? null : money(total);
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** O que sobra da fração, em pontos percentuais inteiros. */
export function progressPercent(countdown: DebtCountdown): number {
  return Math.round(countdown.progress * 100);
}

/** Verdadeiro quando há algo verdadeiro e positivo a dizer sobre o período. */
export function hasProgressToShow(countdown: DebtCountdown): boolean {
  return countdown.paidDown !== null && countdown.paidDown.amount > 0;
}
