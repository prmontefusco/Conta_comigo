import { differenceInDays, type CalendarDate } from "@/core/date/calendar-date";
import { type Money, add, money, multiply } from "@/core/money/money";
import { remainingAmount, type Obligation } from "./obligation";

/**
 * Quanto o atraso está custando.
 *
 * O aplicativo dizia "regularize para estancar juros de mora" e nunca dizia
 * quanto era. Para quem está endividado, esse é o número que move: "esta conta
 * custa R$ 4,20 por dia parada" decide uma ação hoje, "pague suas contas" não
 * decide nada.
 *
 * ## De onde vêm as taxas
 *
 * O padrão brasileiro para dívida de consumo, quando o contrato não diz outra
 * coisa: **multa de 2%** sobre o valor devido, cobrada uma vez, mais **juros de
 * mora de 1% ao mês**, proporcionais aos dias (Código Civil art. 406 e CDC
 * art. 52 §1º, que limita a multa a 2%). Correção monetária fica de fora: ela
 * depende de índice e de contrato, e um palpite aqui viraria número na tela.
 *
 * É estimativa, e é rotulada como tal em toda tela que a mostra. O objetivo
 * não é reproduzir o boleto do credor — é dar ordem de grandeza suficiente
 * para decidir o que pagar primeiro.
 *
 * ## O que este módulo deliberadamente não faz
 *
 * Não estima rotativo de cartão nem cheque especial. Essas taxas são uma
 * ordem de grandeza maior e variam demais entre instituições; tratá-las com a
 * mesma fórmula produziria um número confiante e errado. O cartão tem o
 * próprio caminho, com a taxa marcada como estimativa de mercado.
 */

/** Multa única sobre o valor em atraso. Teto legal para relação de consumo. */
export const DEFAULT_LATE_PENALTY_RATE = 0.02;

/** Juros de mora ao mês, proporcionais aos dias de atraso. */
export const DEFAULT_MONTHLY_ARREARS_RATE = 0.01;

const DAYS_IN_MONTH = 30;

export interface LateFeeEstimate {
  readonly daysLate: number;
  /** Valor original ainda em aberto. */
  readonly principal: Money;
  /** Multa de 2%, cobrada uma vez. */
  readonly penalty: Money;
  /** Juros de mora acumulados até hoje. */
  readonly arrears: Money;
  /** Multa mais juros. O que o atraso já custou. */
  readonly totalCharges: Money;
  /** Principal mais encargos: o que provavelmente será cobrado. */
  readonly totalDue: Money;
  /** Quanto cresce a cada dia que passa. É o número que move alguém. */
  readonly dailyCost: Money;
}

export interface EstimateLateFeesInput {
  readonly amount: Money;
  readonly dueDate: CalendarDate;
  readonly asOf: CalendarDate;
  readonly penaltyRate?: number;
  readonly monthlyArrearsRate?: number;
}

/**
 * Estima multa e juros de uma conta vencida.
 *
 * Devolve tudo zerado quando a conta não venceu — assim a tela pode chamar
 * sem ramificar, e nunca inventa encargo sobre conta em dia.
 */
export function estimateLateFees(input: EstimateLateFeesInput): LateFeeEstimate {
  const currency = input.amount.currency;
  const daysLate = Math.max(0, differenceInDays(input.dueDate, input.asOf));

  if (daysLate === 0 || input.amount.amount <= 0) {
    const nothing = money(0, currency);
    return {
      daysLate: 0,
      principal: input.amount,
      penalty: nothing,
      arrears: nothing,
      totalCharges: nothing,
      totalDue: input.amount,
      dailyCost: nothing,
    };
  }

  const penaltyRate = input.penaltyRate ?? DEFAULT_LATE_PENALTY_RATE;
  const monthlyRate = input.monthlyArrearsRate ?? DEFAULT_MONTHLY_ARREARS_RATE;

  const penalty = multiply(input.amount, penaltyRate);
  const arrears = multiply(input.amount, (monthlyRate / DAYS_IN_MONTH) * daysLate);
  const totalCharges = add(penalty, arrears);

  // O custo por dia é só a parcela de juros: a multa não se repete.
  const dailyCost = multiply(input.amount, monthlyRate / DAYS_IN_MONTH);

  return {
    daysLate,
    principal: input.amount,
    penalty,
    arrears,
    totalCharges,
    totalDue: add(input.amount, totalCharges),
    dailyCost,
  };
}

/** A mesma estimativa, a partir de uma obrigação em aberto. */
export function estimateObligationLateFees(
  obligation: Obligation,
  asOf: CalendarDate,
): LateFeeEstimate {
  return estimateLateFees({
    amount: remainingAmount(obligation),
    dueDate: obligation.dueDate,
    asOf,
  });
}

export interface LateFeeTotals {
  readonly count: number;
  readonly principal: Money;
  readonly charges: Money;
  readonly totalDue: Money;
  /** Quanto o conjunto de atrasos custa por dia, somado. */
  readonly dailyCost: Money;
}

/** O custo agregado de tudo que está vencido. */
export function totalLateFees(
  obligations: readonly Obligation[],
  asOf: CalendarDate,
  currency: Money["currency"] = "BRL",
): LateFeeTotals {
  let principal = money(0, currency);
  let charges = money(0, currency);
  let dailyCost = money(0, currency);
  let count = 0;

  for (const obligation of obligations) {
    const estimate = estimateObligationLateFees(obligation, asOf);
    if (estimate.daysLate === 0) continue;
    count += 1;
    principal = add(principal, estimate.principal);
    charges = add(charges, estimate.totalCharges);
    dailyCost = add(dailyCost, estimate.dailyCost);
  }

  return { count, principal, charges, totalDue: add(principal, charges), dailyCost };
}
