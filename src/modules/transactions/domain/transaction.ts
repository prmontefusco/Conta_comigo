import type { CalendarDate } from "@/core/date/calendar-date";
import { type Money, add, isPositive, negate, sum, zero } from "@/core/money/money";
import type {
  AccountId,
  AuditFields,
  CardStatementId,
  CategoryId,
  CreditCardId,
  DebtId,
  HouseholdId,
  MemberId,
  ObligationId,
  ReserveId,
  TransactionId,
  VehicleId,
  Visibility,
} from "@/modules/shared/domain/common";

/**
 * A Transaction is money that actually moved.
 *
 * If nothing left or entered an account, it is not a Transaction - it is an
 * Obligation (see modules/obligations). Keeping the two apart is what stops
 * the app from telling someone they "spent" money that is merely scheduled.
 *
 * `amount` is always positive. Direction is a consequence of `kind`, not of a
 * sign, so a mistyped minus can never silently invert a balance.
 */

export type TransactionKind =
  /** Money genuinely earned and received. Increases net worth. */
  | "INCOME"
  /** Consumption paid from an account. Decreases net worth. */
  | "EXPENSE"
  /** Money moved between two accounts of the household. Net worth unchanged. */
  | "TRANSFER"
  /** Paying a credit card statement. The spending was already recorded at purchase time. */
  | "CARD_STATEMENT_PAYMENT"
  /** Loan proceeds landing in an account. Cash up, debt up, income unchanged. */
  | "LOAN_DISBURSEMENT"
  /** Paying a loan or financing installment. Only interest and fees are consumption. */
  | "DEBT_PAYMENT"
  /** Earmarking money as a protected reserve. Not an expense. */
  | "RESERVE_ALLOCATION"
  /** Releasing money back from a reserve. Not income. */
  | "RESERVE_RELEASE"
  /** Reconciling a balance against the real bank statement. */
  | "ADJUSTMENT";

interface TransactionBase extends AuditFields {
  readonly id: TransactionId;
  readonly householdId: HouseholdId;
  readonly kind: TransactionKind;
  /** Always positive. */
  readonly amount: Money;
  /** When the money actually moved. Drives the cash-flow view. */
  readonly transactionDate: CalendarDate;
  /** Which month this belongs to economically. Drives the spending view. */
  readonly competenceDate: CalendarDate;
  readonly description: string;
  readonly visibility: Visibility;
  readonly responsibleMemberId?: MemberId;
  readonly notes?: string;
  readonly tags?: readonly string[];
  readonly vehicleId?: VehicleId;
}

export interface IncomeTransaction extends TransactionBase {
  readonly kind: "INCOME";
  readonly accountId: AccountId;
  readonly categoryId?: CategoryId;
  /** The receivable this settles, when the money was expected. */
  readonly settlesObligationId?: ObligationId;
}

export interface ExpenseTransaction extends TransactionBase {
  readonly kind: "EXPENSE";
  readonly accountId: AccountId;
  readonly categoryId: CategoryId;
  readonly settlesObligationId?: ObligationId;
}

export interface TransferTransaction extends TransactionBase {
  readonly kind: "TRANSFER";
  readonly fromAccountId: AccountId;
  readonly toAccountId: AccountId;
}

export interface CardStatementPaymentTransaction extends TransactionBase {
  readonly kind: "CARD_STATEMENT_PAYMENT";
  readonly accountId: AccountId;
  readonly creditCardId: CreditCardId;
  readonly statementId: CardStatementId;
}

export interface LoanDisbursementTransaction extends TransactionBase {
  readonly kind: "LOAN_DISBURSEMENT";
  readonly accountId: AccountId;
  readonly debtId: DebtId;
}

/**
 * How a debt installment splits.
 *
 * When the lender does not disclose the breakdown, only `principal` is filled
 * and the rest is zero. The model supports the decomposition from day one even
 * though data entry may start simplified (docs/DOMAIN.md).
 */
export interface DebtPaymentBreakdown {
  readonly principal: Money;
  readonly interest: Money;
  readonly fees: Money;
  readonly insurance: Money;
}

export interface DebtPaymentTransaction extends TransactionBase {
  readonly kind: "DEBT_PAYMENT";
  readonly accountId: AccountId;
  readonly debtId: DebtId;
  readonly breakdown?: DebtPaymentBreakdown;
  readonly settlesObligationId?: ObligationId;
}

export interface ReserveAllocationTransaction extends TransactionBase {
  readonly kind: "RESERVE_ALLOCATION" | "RESERVE_RELEASE";
  readonly reserveId: ReserveId;
  /** Where the money sits. A reserve may or may not have its own account. */
  readonly accountId: AccountId;
  /** Set when the reserve lives in a different account than the source. */
  readonly counterAccountId?: AccountId;
}

export interface AdjustmentTransaction extends TransactionBase {
  readonly kind: "ADJUSTMENT";
  readonly accountId: AccountId;
  readonly direction: "INCREASE" | "DECREASE";
  readonly reason: string;
}

export type Transaction =
  | IncomeTransaction
  | ExpenseTransaction
  | TransferTransaction
  | CardStatementPaymentTransaction
  | LoanDisbursementTransaction
  | DebtPaymentTransaction
  | ReserveAllocationTransaction
  | AdjustmentTransaction;

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

/** A signed change to one account's balance. */
export interface AccountDelta {
  readonly accountId: AccountId;
  readonly amount: Money;
}

/**
 * How a transaction changes account balances.
 *
 * This is the *only* place account balances are derived from. A transfer
 * produces two deltas that cancel out; a statement payment produces one.
 */
export function cashEffect(transaction: Transaction): AccountDelta[] {
  switch (transaction.kind) {
    case "INCOME":
      return [{ accountId: transaction.accountId, amount: transaction.amount }];

    case "EXPENSE":
    case "CARD_STATEMENT_PAYMENT":
    case "DEBT_PAYMENT":
      return [{ accountId: transaction.accountId, amount: negate(transaction.amount) }];

    case "LOAN_DISBURSEMENT":
      return [{ accountId: transaction.accountId, amount: transaction.amount }];

    case "TRANSFER":
      return [
        { accountId: transaction.fromAccountId, amount: negate(transaction.amount) },
        { accountId: transaction.toAccountId, amount: transaction.amount },
      ];

    case "RESERVE_ALLOCATION":
    case "RESERVE_RELEASE": {
      // Earmarking inside a single account moves no cash at all.
      if (!transaction.counterAccountId) return [];
      const from =
        transaction.kind === "RESERVE_ALLOCATION"
          ? transaction.counterAccountId
          : transaction.accountId;
      const to =
        transaction.kind === "RESERVE_ALLOCATION"
          ? transaction.accountId
          : transaction.counterAccountId;
      return [
        { accountId: from, amount: negate(transaction.amount) },
        { accountId: to, amount: transaction.amount },
      ];
    }

    case "ADJUSTMENT":
      return [
        {
          accountId: transaction.accountId,
          amount:
            transaction.direction === "INCREASE" ? transaction.amount : negate(transaction.amount),
        },
      ];
  }
}

/** A consumption event: money the household no longer has, and what it bought. */
export interface SpendingEffect {
  readonly amount: Money;
  readonly categoryId?: CategoryId;
  readonly competenceDate: CalendarDate;
  readonly visibility: Visibility;
  readonly responsibleMemberId?: MemberId;
}

/**
 * Whether a transaction is consumption, and how much.
 *
 * The rules that matter, all of which exist to avoid double counting:
 *
 * - A TRANSFER is not spending. Money changed pockets.
 * - A CARD_STATEMENT_PAYMENT is not spending. The purchases behind the
 *   statement were already counted when they were made.
 * - A LOAN_DISBURSEMENT is not spending, and not income either.
 * - A RESERVE_ALLOCATION is not spending. The money is still yours.
 * - A DEBT_PAYMENT is spending only in its interest, fees and insurance part.
 *   The principal portion converts cash into a smaller debt: net worth is
 *   unchanged by it.
 */
export function spendingEffect(transaction: Transaction): SpendingEffect | null {
  const attribution = {
    competenceDate: transaction.competenceDate,
    visibility: transaction.visibility,
    ...(transaction.responsibleMemberId
      ? { responsibleMemberId: transaction.responsibleMemberId }
      : {}),
  };

  switch (transaction.kind) {
    case "EXPENSE":
      return { amount: transaction.amount, categoryId: transaction.categoryId, ...attribution };

    case "DEBT_PAYMENT": {
      if (!transaction.breakdown) return null;
      const cost = sum([
        transaction.breakdown.interest,
        transaction.breakdown.fees,
        transaction.breakdown.insurance,
      ]);
      if (!isPositive(cost)) return null;
      return { amount: cost, ...attribution };
    }

    case "INCOME":
    case "TRANSFER":
    case "CARD_STATEMENT_PAYMENT":
    case "LOAN_DISBURSEMENT":
    case "RESERVE_ALLOCATION":
    case "RESERVE_RELEASE":
    case "ADJUSTMENT":
      return null;
  }
}

export interface IncomeEffect {
  readonly amount: Money;
  readonly categoryId?: CategoryId;
  readonly competenceDate: CalendarDate;
  readonly visibility: Visibility;
  readonly responsibleMemberId?: MemberId;
}

/**
 * Whether a transaction is genuine income.
 *
 * Loan proceeds increase what is available to spend but are not earnings: the
 * household simultaneously takes on an obligation. Reporting them as income
 * would make a worsening situation look like a good month.
 */
export function incomeEffect(transaction: Transaction): IncomeEffect | null {
  if (transaction.kind !== "INCOME") return null;
  return {
    amount: transaction.amount,
    ...(transaction.categoryId ? { categoryId: transaction.categoryId } : {}),
    competenceDate: transaction.competenceDate,
    visibility: transaction.visibility,
    ...(transaction.responsibleMemberId
      ? { responsibleMemberId: transaction.responsibleMemberId }
      : {}),
  };
}

/** A signed change to how much the household owes. Positive means more debt. */
export interface DebtEffect {
  readonly debtId?: DebtId;
  readonly creditCardId?: CreditCardId;
  readonly amount: Money;
}

export function debtEffect(transaction: Transaction): DebtEffect | null {
  switch (transaction.kind) {
    case "LOAN_DISBURSEMENT":
      return { debtId: transaction.debtId, amount: transaction.amount };

    case "DEBT_PAYMENT":
      // Only the principal reduces the outstanding balance. When the lender did
      // not break the installment down, we conservatively treat the whole
      // payment as amortisation and flag it in the UI.
      return {
        debtId: transaction.debtId,
        amount: negate(transaction.breakdown?.principal ?? transaction.amount),
      };

    case "CARD_STATEMENT_PAYMENT":
      return { creditCardId: transaction.creditCardId, amount: negate(transaction.amount) };

    default:
      return null;
  }
}

/**
 * How much richer or poorer the household is because of this transaction.
 *
 * Transfers, statement payments, loan disbursements and reserve movements are
 * all exactly zero. This function is the executable form of the product's
 * financial principles and is covered by the mandatory test cases.
 */
export function netWorthEffect(transaction: Transaction): Money {
  const income = incomeEffect(transaction);
  const spending = spendingEffect(transaction);

  let result = zero(transaction.amount.currency);
  if (income) result = add(result, income.amount);
  if (spending) result = add(result, negate(spending.amount));

  if (transaction.kind === "ADJUSTMENT") {
    result = transaction.direction === "INCREASE" ? transaction.amount : negate(transaction.amount);
  }

  return result;
}

/** Net change across every account touched. Zero for transfers. */
export function netCashEffect(transaction: Transaction): Money {
  return sum(
    cashEffect(transaction).map((delta) => delta.amount),
    transaction.amount.currency,
  );
}

/** Which obligation, if any, this transaction settles. */
export function settledObligationId(transaction: Transaction): ObligationId | undefined {
  switch (transaction.kind) {
    case "INCOME":
    case "EXPENSE":
    case "DEBT_PAYMENT":
      return transaction.settlesObligationId;
    default:
      return undefined;
  }
}

/** Accounts a transaction reads or writes, for authorisation and indexing. */
export function involvedAccountIds(transaction: Transaction): AccountId[] {
  return [...new Set(cashEffect(transaction).map((delta) => delta.accountId))];
}
