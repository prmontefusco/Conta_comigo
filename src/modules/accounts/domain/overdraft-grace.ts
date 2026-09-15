import { addDays, differenceInDays, isBefore, type CalendarDate } from "@/core/date/calendar-date";
import type { Transaction } from "@/modules/transactions/domain/transaction";
import { computeBalance, type Account } from "./account";

/**
 * Alguns bancos (ex.: Santander) não cobram juros do cheque especial nos
 * primeiros dias de uso dentro do mês. `overdraftGraceDays`, em `Account`,
 * guarda quantos dias são esses.
 *
 * A contagem não é um intervalo fixo do calendário (ex.: "dias 1 a 10"): ela
 * começa no dia em que o saldo entrou no negativo e some assim que ele volta
 * para zero ou mais. Foi assim que cada banco descreveu o benefício, e é o
 * que faz a pergunta certa: "há quantos dias estou usando o limite agora?".
 */

export interface OverdraftGraceStatus {
  readonly graceDays: number;
  /** Dias corridos, incluindo hoje, com o saldo negativo. */
  readonly daysUsed: number;
  readonly daysRemaining: number;
  readonly withinGracePeriod: boolean;
  readonly sinceDate: CalendarDate;
}

// Nenhuma conta real fica negativa por mais de um ano sem virar outra coisa
// (renegociação, dívida). O teto existe só para o laço abaixo nunca rodar
// indefinidamente numa conta com histórico de anos.
const MAX_LOOKBACK_DAYS = 366;

/**
 * `null` quando a conta não tem período de carência configurado, ou quando
 * o saldo de hoje não está negativo — não há limite em uso para acompanhar.
 */
export function overdraftGraceStatus(
  account: Account,
  transactions: readonly Transaction[],
  asOf: CalendarDate,
): OverdraftGraceStatus | null {
  if (!account.overdraftGraceDays || account.overdraftGraceDays <= 0) return null;

  const balanceToday = computeBalance(account, transactions, asOf);
  if (balanceToday.amount >= 0) return null;

  let sinceDate = asOf;
  for (let step = 0; step < MAX_LOOKBACK_DAYS; step++) {
    const previous = addDays(sinceDate, -1);
    if (isBefore(previous, account.openingBalanceDate)) break;
    if (computeBalance(account, transactions, previous).amount >= 0) break;
    sinceDate = previous;
  }

  const daysUsed = differenceInDays(sinceDate, asOf) + 1;
  const graceDays = account.overdraftGraceDays;

  return {
    graceDays,
    daysUsed,
    daysRemaining: Math.max(graceDays - daysUsed, 0),
    withinGracePeriod: daysUsed <= graceDays,
    sinceDate,
  };
}
