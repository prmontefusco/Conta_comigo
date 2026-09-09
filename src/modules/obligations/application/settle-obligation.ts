import { collection, doc, writeBatch, type Firestore } from "firebase/firestore";
import { instant, type CalendarDate } from "@/core/date/calendar-date";
import { isPositive, type Money } from "@/core/money/money";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import { remainingAmount, settle, settleAndClose } from "@/modules/obligations/domain/obligation";
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
  /**
   * Encerra a obrigação mesmo tendo entrado menos do que o previsto.
   *
   * É a diferença entre "recebi menos" e "ainda vou receber o resto" — a
   * primeira encerra, a segunda deixa o resto na projeção. Só quem está
   * olhando o extrato sabe qual das duas é, então a tela pergunta.
   */
  readonly closeRemainder?: boolean;
  /**
   * Autoriza registrar mais do que estava previsto.
   *
   * O excesso é legítimo com frequência — décimo terceiro, hora extra, uma
   * conta que veio maior. O que ele também é, com a mesma frequência, é um
   * zero a mais digitado sem querer. Por isso a rota recusa por padrão e a
   * tela confirma explicitamente, mostrando a diferença.
   */
  readonly allowOverpayment?: boolean;
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
  const overpaying = input.amount.amount > outstanding.amount;

  if (overpaying && !input.allowOverpayment) {
    return err(
      validationError(
        "O valor informado é maior do que o previsto para esta conta. " +
          "Confirme que é isso mesmo, ou ajuste o valor.",
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

  // O domínio decide o estado final; aqui só se escreve o que ele devolveu.
  // Duplicar a regra de "quando fica quitada" seria abrir espaço para as duas
  // cópias divergirem — e uma delas é a que grava.
  const settled = input.closeRemainder
    ? settleAndClose(obligation, {
        transactionId: transactionRef.id,
        amount: input.amount,
        at: now,
      })
    : settle(obligation, { transactionId: transactionRef.id, amount: input.amount, at: now });

  batch.update(doc(input.db, `households/${input.householdId}/obligations/${obligation.id}`), {
    settledAmount: settled.settledAmount,
    status: settled.status,
    settlementTransactionIds: settled.settlementTransactionIds,
    ...(settled.settledAt ? { settledAt: settled.settledAt } : {}),
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
