import type { CalendarDate } from "@/core/date/calendar-date";
import { isOnOrBefore } from "@/core/date/calendar-date";
import { type Money, add, sum, zero } from "@/core/money/money";
import { cashEffect, type Transaction } from "@/modules/transactions/domain/transaction";
import type {
  AccountId,
  AuditFields,
  HouseholdId,
  MemberId,
  Visibility,
} from "@/modules/shared/domain/common";

/**
 * An Account is a place where money physically sits.
 *
 * A credit card is deliberately *not* an account: it holds no money, it holds
 * debt. Modelling it as an account is the usual source of "my balance went up
 * when I bought something" bugs.
 */

export type AccountType =
  "CHECKING" | "SAVINGS" | "WALLET" | "CASH" | "DIGITAL" | "INVESTMENT" | "OTHER";

export interface Account extends AuditFields {
  readonly id: AccountId;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly type: AccountType;
  readonly institution?: string;
  /**
   * The balance on the day the account entered the app.
   *
   * Everything before that day is out of scope: people should not have to
   * type years of history to get value on day one (docs/PRODUCT.md).
   */
  readonly openingBalance: Money;
  readonly openingBalanceDate: CalendarDate;
  readonly visibility: Visibility;
  readonly ownerMemberId?: MemberId;
  /** Overdraft limit ("cheque especial"). Available funds, but borrowed ones. */
  readonly overdraftLimit?: Money;
  /** Excluded accounts still record movements but stay out of the headline totals. */
  readonly includeInTotals: boolean;
  readonly archived: boolean;
  readonly color?: string;
  readonly icon?: string;
}

/**
 * Balance derived purely from the opening balance plus every movement.
 *
 * Derivation is the source of truth. Firestore also stores a cached balance so
 * lists stay cheap, but that cache is written inside the same transaction as
 * the movement and can always be rebuilt from here (docs/FIRESTORE_MODEL.md).
 */
export function computeBalance(
  account: Account,
  transactions: readonly Transaction[],
  asOf?: CalendarDate,
): Money {
  const relevant = transactions.filter(
    (transaction) =>
      isOnOrBefore(account.openingBalanceDate, transaction.transactionDate) &&
      (asOf === undefined || isOnOrBefore(transaction.transactionDate, asOf)),
  );

  const deltas = relevant
    .flatMap(cashEffect)
    .filter((delta) => delta.accountId === account.id)
    .map((delta) => delta.amount);

  return add(account.openingBalance, sum(deltas, account.openingBalance.currency));
}

export function computeBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  asOf?: CalendarDate,
): Map<AccountId, Money> {
  return new Map(
    accounts.map((account) => [account.id, computeBalance(account, transactions, asOf)]),
  );
}

/** Money physically available across accounts that count towards totals. */
export function totalCash(
  accounts: readonly Account[],
  balances: ReadonlyMap<AccountId, Money>,
): Money {
  return sum(
    accounts
      .filter((account) => account.includeInTotals && !account.archived)
      .map((account) => balances.get(account.id) ?? zero()),
  );
}

/**
 * Overdraft is not money the household owns.
 *
 * It is reported separately so nobody mistakes an available limit for savings.
 */
export function totalOverdraftLimit(accounts: readonly Account[]): Money {
  return sum(
    accounts
      .filter((account) => !account.archived && account.overdraftLimit)
      .map((account) => account.overdraftLimit ?? zero()),
  );
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  WALLET: "Carteira digital",
  CASH: "Dinheiro",
  DIGITAL: "Conta digital",
  INVESTMENT: "Investimento",
  OTHER: "Outra",
};
