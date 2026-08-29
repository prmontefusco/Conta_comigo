import { collection, doc, writeBatch, type Firestore } from "firebase/firestore";
import { instant, type CalendarDate } from "@/core/date/calendar-date";
import { add, greaterOrEqual, isPositive, type Money } from "@/core/money/money";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import { remainingAmount } from "@/modules/obligations/domain/obligation";
import { err, ok, validationError, type Result } from "@/core/result/result";
import type { AccountId, HouseholdId, UserId } from "@/modules/shared/domain/common";
import { stripUndefined } from "@/modules/shared/infrastructure/codecs";

/**
 * Settling an obligation.
 *
 * The obligation and the transaction that pays it are written in one batch.
 * Splitting them would let a crash leave a bill marked paid with no money
 * movement behind it, or money moved twice for the same bill - both of which
 * corrupt every figure downstream.
 *
 * The transaction carries `settlesObligationId`, which is what stops the same
 * money being counted as both a pending commitment and a completed expense.
 */

export interface SettleObligationInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly obligation: Obligation;
  readonly accountId: AccountId;
  readonly amount: Money;
  readonly paidOn: CalendarDate;
}

export async function settleObligation(
  input: SettleObligationInput,
): Promise<Result<{ transactionId: string }>> {
  const { obligation } = input;

  if (obligation.status === "CANCELED") {
    return err(validationError("Esta conta foi cancelada e não pode ser paga."));
  }
  if (obligation.status === "SETTLED") {
    return err(validationError("Esta conta já está quitada."));
  }
  if (!isPositive(input.amount)) {
    return err(validationError("Informe um valor maior que zero."));
  }

  const outstanding = remainingAmount(obligation);
  if (input.amount.amount > outstanding.amount) {
    return err(
      validationError(
        "O valor informado é maior do que o saldo em aberto desta conta. " +
          "Ajuste o valor ou edite a conta antes de registrar o pagamento.",
      ),
    );
  }

  const now = instant();
  const batch = writeBatch(input.db);

  const transactionRef = doc(collection(input.db, `households/${input.householdId}/transactions`));

  const isInflow = obligation.direction === "INFLOW";

  batch.set(
    transactionRef,
    stripUndefined({
      householdId: input.householdId,
      kind: isInflow ? "INCOME" : "EXPENSE",
      amount: input.amount,
      transactionDate: input.paidOn,
      // The money belongs to the month the obligation belongs to, not the day
      // it happened to be paid. This is what keeps a bill paid late in the
      // right budget month.
      competenceDate: obligation.competenceDate,
      description: obligation.description,
      visibility: obligation.visibility,
      responsibleMemberId: obligation.responsibleMemberId,
      accountId: input.accountId,
      // An expense must have a category; income may not.
      categoryId: obligation.categoryId ?? (isInflow ? undefined : "outros-gastos"),
      settlesObligationId: obligation.id,
      vehicleId: obligation.vehicleId,
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    }),
  );

  const settledAmount = add(obligation.settledAmount, input.amount);
  const fullySettled = greaterOrEqual(settledAmount, obligation.amount);

  batch.update(doc(input.db, `households/${input.householdId}/obligations/${obligation.id}`), {
    settledAmount,
    status: fullySettled ? "SETTLED" : "PARTIALLY_SETTLED",
    settlementTransactionIds: [...obligation.settlementTransactionIds, transactionRef.id],
    ...(fullySettled ? { settledAt: now } : {}),
    updatedAt: now,
  });

  await batch.commit();

  return ok({ transactionId: transactionRef.id });
}

/**
 * Paying a credit card statement.
 *
 * Recorded as its own kind of transaction so the app can tell that money left
 * an account without any new consumption happening: the purchases behind the
 * statement were counted when they were made (docs/DOMAIN.md).
 */
export interface PayStatementInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly creditCardId: string;
  readonly statementId: string;
  readonly statementMonth: string;
  readonly accountId: AccountId;
  readonly amount: Money;
  readonly paidOn: CalendarDate;
  readonly competenceDate: CalendarDate;
}

export async function payCardStatement(
  input: PayStatementInput,
): Promise<Result<{ transactionId: string }>> {
  if (!isPositive(input.amount)) {
    return err(validationError("Informe um valor maior que zero."));
  }

  const now = instant();
  const ref = doc(collection(input.db, `households/${input.householdId}/transactions`));
  const batch = writeBatch(input.db);

  batch.set(
    ref,
    stripUndefined({
      householdId: input.householdId,
      kind: "CARD_STATEMENT_PAYMENT",
      amount: input.amount,
      transactionDate: input.paidOn,
      competenceDate: input.competenceDate,
      description: `Pagamento da fatura ${input.statementMonth}`,
      visibility: "HOUSEHOLD",
      accountId: input.accountId,
      creditCardId: input.creditCardId,
      statementId: input.statementId,
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    }),
  );

  await batch.commit();
  return ok({ transactionId: ref.id });
}
