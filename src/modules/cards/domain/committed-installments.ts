import {
  addMonthsToKey,
  monthKeyOf,
  type CalendarDate,
  type MonthKey,
} from "@/core/date/calendar-date";
import { type Money, money } from "@/core/money/money";
import { openInstallmentPlans, type CreditCard, type CardPurchase } from "./credit-card";

/**
 * Quanto dos próximos meses já está vendido.
 *
 * A tela de cartões já lista cada parcelamento em aberto, um por linha. O que
 * ela não dizia é o número que decide: **somando tudo, quanto de cada mês à
 * frente já tem dono** — e em que mês isso finalmente alivia.
 *
 * É o outro lado do "Antes de comprar". Lá, o aplicativo mostra o que uma
 * compra nova faria com os próximos meses; aqui, mostra o que as compras já
 * feitas estão fazendo. O texto educativo da tela de cartões diz há tempos
 * que "cada compra de 10x de R$ 50 consome o fôlego dos seus próximos dez
 * meses sem você perceber". Isto é essa frase virando número.
 *
 * Sem juízo sobre as compras: quem parcelou tinha um motivo, e quase sempre
 * era não ter o dinheiro à vista. O que muda uma decisão futura é enxergar o
 * compromisso somado, não ser lembrado do passado.
 */

export interface CommittedMonth {
  readonly month: MonthKey;
  /** Soma das parcelas que caem neste mês. */
  readonly amount: Money;
  /** Quantas compras diferentes cobram neste mês. */
  readonly purchaseCount: number;
}

export interface CommittedInstallments {
  readonly months: readonly CommittedMonth[];
  /** Tudo o que ainda será cobrado, somado. */
  readonly totalRemaining: Money;
  /** O mês que mais pesa. Null quando não há nada parcelado. */
  readonly heaviestMonth: CommittedMonth | null;
  /** O primeiro mês sem nenhuma parcela. Null quando todos têm. */
  readonly firstFreeMonth: MonthKey | null;
  /** O último mês com parcela: quando o compromisso acaba de vez. */
  readonly lastCommittedMonth: MonthKey | null;
  /** Média mensal enquanto durar o compromisso. */
  readonly averageWhileCommitted: Money;
}

export interface BuildCommittedInstallmentsInput {
  readonly cards: readonly CreditCard[];
  readonly purchases: readonly CardPurchase[];
  readonly asOf: CalendarDate;
  /** Quantos meses à frente montar. */
  readonly horizonMonths?: number;
}

const DEFAULT_HORIZON = 12;

export function buildCommittedInstallments(
  input: BuildCommittedInstallmentsInput,
): CommittedInstallments {
  const horizon = Math.max(1, input.horizonMonths ?? DEFAULT_HORIZON);
  const plans = openInstallmentPlans(input.cards, input.purchases, input.asOf);

  const startMonth = monthKeyOf(input.asOf);
  const totals = new Map<MonthKey, { amount: number; purchases: Set<string> }>();

  for (let index = 0; index < horizon; index += 1) {
    totals.set(addMonthsToKey(startMonth, index), { amount: 0, purchases: new Set() });
  }

  let totalRemaining = 0;

  for (const plan of plans) {
    for (const installment of plan.remainingInstallments) {
      totalRemaining += installment.amount.amount;
      const bucket = totals.get(installment.statementMonth);
      // Parcelas além do horizonte contam no total, mas não no gráfico: a
      // tela mostra doze meses, e inventar uma coluna vazia para o décimo
      // terceiro não ajuda ninguém.
      if (!bucket) continue;
      bucket.amount += installment.amount.amount;
      bucket.purchases.add(plan.purchaseId);
    }
  }

  const months: CommittedMonth[] = [...totals.entries()].map(([month, bucket]) => ({
    month,
    amount: money(bucket.amount),
    purchaseCount: bucket.purchases.size,
  }));

  const committed = months.filter((month) => month.amount.amount > 0);
  const heaviest = committed.reduce<CommittedMonth | null>(
    (best, month) => (best === null || month.amount.amount > best.amount.amount ? month : best),
    null,
  );

  const totalCommitted = committed.reduce((sofar, month) => sofar + month.amount.amount, 0);

  return {
    months,
    totalRemaining: money(totalRemaining),
    heaviestMonth: heaviest,
    firstFreeMonth: months.find((month) => month.amount.amount === 0)?.month ?? null,
    lastCommittedMonth: committed[committed.length - 1]?.month ?? null,
    averageWhileCommitted: money(
      committed.length === 0 ? 0 : Math.round(totalCommitted / committed.length),
    ),
  };
}
