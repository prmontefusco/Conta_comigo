import { type Money, clampToZero, money, multiply, subtract } from "@/core/money/money";
import {
  effectiveMonthlyRate,
  outstandingPrincipal,
  upcomingInstallments,
  type Debt,
  type RateSource,
} from "@/modules/debts/domain/debt";
import type { CalendarDate } from "@/core/date/calendar-date";

/**
 * Qual prazo pedir.
 *
 * O aplicativo passou a dizer, com todas as letras, que um plano não fecha e
 * que o caminho é alongar prazo em vez de apertar mais o mês. Dizia isso e
 * parava — a pessoa chegava ao credor sabendo que precisava de mais prazo e
 * sem saber **quanto**. Quem liga sem número aceita o que ofereceram.
 *
 * Este módulo responde a pergunta que ficou: com o que sobra, qual parcela
 * cabe, e quantos meses são precisos para pagar o saldo devedor nessa parcela.
 *
 * ## As duas verdades que precisam aparecer juntas
 *
 * Alongar prazo **resolve o mês e encarece a dívida**. As duas coisas são
 * verdade ao mesmo tempo, e um produto honesto não pode mostrar só a que
 * convém. Por isso todo resultado traz o custo adicional ao lado do alívio
 * mensal: quem decide vê os dois números.
 *
 * ## O limite que nenhum prazo vence
 *
 * Existe uma parcela abaixo da qual a dívida **nunca** é paga: quando ela não
 * cobre nem os juros do mês, o saldo cresce mesmo pagando em dia, e não há
 * prazo que resolva. Devolver "480 meses" nesse caso seria pior que devolver
 * nada — o caminho ali é abatimento do saldo, não prazo.
 */

/** Prazo acima do qual a proposta deixa de ser realista para dívida de consumo. */
export const MAX_REALISTIC_TERM_MONTHS = 96;

export type TermExtensionOutcome =
  /** Existe um prazo que faz a parcela caber. */
  | "FEASIBLE"
  /** A parcela que cabe não cobre nem os juros: nenhum prazo resolve. */
  | "NEVER_AMORTISES"
  /** O prazo necessário passa do que qualquer credor aceitaria. */
  | "TERM_TOO_LONG"
  /** Já cabe: não há o que renegociar nesta dívida. */
  | "ALREADY_FITS"
  /** Não sobra nada para oferecer, nem alongando. */
  | "NOTHING_TO_OFFER";

export interface TermExtensionPlan {
  readonly debtId: string;
  readonly description: string;
  readonly outcome: TermExtensionOutcome;

  readonly outstanding: Money;
  readonly monthlyRate: number;
  readonly rateSource: RateSource;

  /** O que a dívida cobra hoje, por mês. */
  readonly currentInstallment: Money;
  readonly currentRemainingCount: number;
  /** Tudo o que ainda seria pago mantendo o contrato como está. */
  readonly currentTotalRemaining: Money;

  /** A parcela que o mês comporta para esta dívida. */
  readonly affordableInstallment: Money;
  /** Quantos meses seriam precisos nessa parcela. Null quando não há resposta. */
  readonly requiredMonths: number | null;
  readonly newTotalPaid: Money | null;
  /** Quanto o alongamento custa a mais no total. Null quando não há plano. */
  readonly extraCost: Money | null;
  /** Quanto o mês respira por mês. */
  readonly monthlyRelief: Money;
}

export interface PlanTermExtensionInput {
  readonly asOf: CalendarDate;
  readonly debt: Debt;
  readonly paidInstallmentNumbers?: readonly number[];
  /**
   * Quanto falta por mês para o orçamento fechar.
   *
   * O mesmo `monthlyShortfall` que o motor de recuperação calcula. Zero
   * quando o mês já fecha — e aí não há renegociação a propor.
   */
  readonly monthlyShortfall: Money;
}

/**
 * Resolve a Tabela Price para o prazo.
 *
 * `n = -ln(1 - P·i / PMT) / ln(1 + i)`. O termo dentro do logaritmo fica
 * negativo ou nulo exatamente quando a parcela não cobre os juros — que é o
 * caso em que a resposta honesta é "nenhum prazo", não um número grande.
 */
export function monthsToAmortise(
  balance: Money,
  monthlyRatePercent: number,
  installment: Money,
): number | null {
  if (balance.amount <= 0) return 0;
  if (installment.amount <= 0) return null;

  const rate = monthlyRatePercent / 100;

  // Sem juros conhecidos, o prazo é a divisão simples.
  if (rate <= 0) return Math.ceil(balance.amount / installment.amount);

  const interestOnly = balance.amount * rate;
  if (installment.amount <= interestOnly) return null;

  const months = -Math.log(1 - (balance.amount * rate) / installment.amount) / Math.log(1 + rate);
  return Number.isFinite(months) ? Math.max(1, Math.ceil(months)) : null;
}

/**
 * O prazo a pedir para esta dívida, com o que ele custa.
 *
 * Trata uma dívida por vez de propósito. Renegociar tudo ao mesmo tempo não é
 * como a conversa acontece: liga-se para um credor, sobre um contrato, e o
 * roteiro da tela ao lado é para essa ligação.
 */
export function planTermExtension(input: PlanTermExtensionInput): TermExtensionPlan {
  const { debt, asOf } = input;
  const paid = input.paidInstallmentNumbers ?? [];
  const currency = debt.principalContracted.currency;

  const outstanding = outstandingPrincipal(debt, paid);
  const rate = effectiveMonthlyRate(debt);

  const upcoming = upcomingInstallments(debt, asOf, paid);
  const remainingCount = Math.max(upcoming.length, 1);
  const currentInstallment =
    upcoming[0]?.total ??
    debt.installmentAmount ??
    money(Math.round(outstanding.amount / remainingCount), currency);

  const currentTotalRemaining = money(currentInstallment.amount * remainingCount, currency);

  const base: Omit<
    TermExtensionPlan,
    | "outcome"
    | "affordableInstallment"
    | "requiredMonths"
    | "newTotalPaid"
    | "extraCost"
    | "monthlyRelief"
  > = {
    debtId: debt.id,
    description: debt.description,
    outstanding,
    monthlyRate: rate.monthly,
    rateSource: rate.source,
    currentInstallment,
    currentRemainingCount: remainingCount,
    currentTotalRemaining,
  };

  const nothing = money(0, currency);

  if (input.monthlyShortfall.amount <= 0) {
    return {
      ...base,
      outcome: "ALREADY_FITS",
      affordableInstallment: currentInstallment,
      requiredMonths: remainingCount,
      newTotalPaid: currentTotalRemaining,
      extraCost: nothing,
      monthlyRelief: nothing,
    };
  }

  // A parcela que cabe: a de hoje, menos o buraco do mês. Se esta dívida
  // sozinha não dá conta do buraco, o valor fica zero ou negativo e a resposta
  // é que ela não resolve — não um número que finge resolver.
  const affordable = clampToZero(subtract(currentInstallment, input.monthlyShortfall));

  if (affordable.amount <= 0) {
    return {
      ...base,
      outcome: "NOTHING_TO_OFFER",
      affordableInstallment: nothing,
      requiredMonths: null,
      newTotalPaid: null,
      extraCost: null,
      monthlyRelief: nothing,
    };
  }

  const months = monthsToAmortise(outstanding, rate.monthly, affordable);

  if (months === null) {
    return {
      ...base,
      outcome: "NEVER_AMORTISES",
      affordableInstallment: affordable,
      requiredMonths: null,
      newTotalPaid: null,
      extraCost: null,
      monthlyRelief: subtract(currentInstallment, affordable),
    };
  }

  const newTotal = multiply(affordable, months);

  return {
    ...base,
    outcome: months > MAX_REALISTIC_TERM_MONTHS ? "TERM_TOO_LONG" : "FEASIBLE",
    affordableInstallment: affordable,
    requiredMonths: months,
    newTotalPaid: newTotal,
    extraCost: clampToZero(subtract(newTotal, currentTotalRemaining)),
    monthlyRelief: subtract(currentInstallment, affordable),
  };
}

export const OUTCOME_LABELS: Record<TermExtensionOutcome, string> = {
  FEASIBLE: "Existe prazo que resolve",
  NEVER_AMORTISES: "Prazo não resolve esta",
  TERM_TOO_LONG: "Prazo longo demais",
  ALREADY_FITS: "Já cabe no mês",
  NOTHING_TO_OFFER: "Esta sozinha não fecha o mês",
};

/**
 * O que dizer sobre cada desfecho.
 *
 * Mora no domínio, e não na tela, pelo mesmo motivo de `local-advice.ts`: é
 * texto que orienta alguém endividado numa conversa com credor, e no resto
 * deste projeto nada assim entra sem teste.
 */
export function explainOutcome(plan: TermExtensionPlan): string {
  switch (plan.outcome) {
    case "ALREADY_FITS":
      return "O seu mês fecha como está. Não há prazo a pedir nesta dívida.";
    case "NOTHING_TO_OFFER":
      return "Mesmo zerando a parcela desta dívida, o mês continua sem fechar. O buraco é maior que ela — vale repetir a conta nas outras, ou tratar mais de um credor.";
    case "NEVER_AMORTISES":
      return "A parcela que cabe no seu mês não cobre nem os juros desta dívida: o saldo cresceria mesmo pagando em dia. Aqui prazo não resolve — o que resolve é abatimento do saldo ou uma taxa menor. Peça o desconto para quitação, ou a portabilidade para outro banco.";
    case "TERM_TOO_LONG":
      return "O prazo necessário passa do que um credor costuma aceitar em dívida de consumo. Combine com outra coisa: uma entrada, um desconto no saldo, ou dividir o alívio entre mais de um contrato.";
    case "FEASIBLE":
      return "Este é o pedido a fazer. Leve o número pronto para a ligação: quem chega sem valor definido costuma sair com o que o credor ofereceu.";
  }
}
