import { collection, doc, writeBatch, type Firestore } from "firebase/firestore";
import { type CalendarDate, instant } from "@/core/date/calendar-date";
import { err, ok, validationError, type Result } from "@/core/result/result";
import type { HouseholdId, UserId } from "@/modules/shared/domain/common";
import { stripUndefined } from "@/modules/shared/infrastructure/codecs";
import type { Transaction } from "@/modules/transactions/domain/transaction";

/**
 * Transformar em plano os lançamentos futuros que já estão gravados.
 *
 * Antes, um recebimento datado para o fim do mês era gravado como transação.
 * Ele contava como realizado nos totais do mês, ficava fora do saldo — que
 * corta por data — e era invisível para a projeção, que não lê transações. Ou
 * seja, o mesmo dinheiro era certo numa tela e inexistente na outra.
 *
 * Corrigir só o caminho de criação deixaria esses documentos num limbo pior:
 * depois da correção das leituras eles não seriam contados em lugar nenhum. Em
 * vez de um script de migração — que este produto não tem, e que rodaria sobre
 * dados que a pessoa não está vendo — a conversão é oferecida na tela onde os
 * lançamentos estão, e acontece quando ela aceita.
 *
 * Cada lançamento vira uma obrigação e a transação é apagada, no mesmo lote:
 * um lote por lançamento, para que uma falha no meio não deixe metade
 * convertida e metade duplicada.
 */

export interface ConvertFutureTransactionsInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly transactions: readonly Transaction[];
  /** Hoje, no fuso da casa. Define o que é futuro. */
  readonly asOf: CalendarDate;
}

export interface ConversionSummary {
  readonly converted: number;
}

/** Só receita e despesa viram plano; os outros tipos pertencem a outro documento. */
export type PlannableTransaction = Extract<Transaction, { kind: "EXPENSE" | "INCOME" }>;

/**
 * Os lançamentos que ainda não aconteceram.
 *
 * Transferência, pagamento de fatura e amortização de dívida ficam de fora:
 * não são planos que alguém "confirma" depois, e virar obrigação quebraria o
 * vínculo que cada um tem com o seu documento de origem.
 */
export function futureTransactions(
  transactions: readonly Transaction[],
  asOf: CalendarDate,
): PlannableTransaction[] {
  return transactions.filter(
    (transaction): transaction is PlannableTransaction =>
      (transaction.kind === "EXPENSE" || transaction.kind === "INCOME") &&
      transaction.transactionDate > asOf &&
      // Um lançamento que liquidou uma conta não é um plano: ele é a prova de
      // que a conta foi paga. Converter apagaria essa prova.
      transaction.settlesObligationId === undefined,
  );
}

export async function convertFutureTransactions(
  input: ConvertFutureTransactionsInput,
): Promise<Result<ConversionSummary>> {
  const pending = futureTransactions(input.transactions, input.asOf);
  if (pending.length === 0) {
    return err(validationError("Não há lançamentos com data futura para converter."));
  }

  const now = instant();
  const obligations = collection(input.db, `households/${input.householdId}/obligations`);
  let converted = 0;

  for (const transaction of pending) {
    const batch = writeBatch(input.db);

    batch.set(
      doc(obligations),
      stripUndefined({
        householdId: input.householdId,
        direction: transaction.kind === "INCOME" ? "INFLOW" : "OUTFLOW",
        origin: "MANUAL",
        description: transaction.description,
        amount: transaction.amount,
        dueDate: transaction.transactionDate,
        competenceDate: transaction.competenceDate,
        categoryId: transaction.categoryId,
        expectedAccountId: transaction.accountId,
        // Era um plano digitado como se fosse fato; tratá-lo como renda fixa
        // inflaria a capacidade de pagamento calculada para negociação.
        expenseNature: "OCCASIONAL",
        confidence: "ESTIMATED",
        visibility: transaction.visibility,
        responsibleMemberId: transaction.responsibleMemberId,
        status: "SCHEDULED",
        settledAmount: { amount: 0, currency: transaction.amount.currency },
        settlementTransactionIds: [],
        createdAt: now,
        updatedAt: now,
        createdBy: input.uid,
      }),
    );

    batch.delete(doc(input.db, `households/${input.householdId}/transactions/${transaction.id}`));

    await batch.commit();
    converted += 1;
  }

  return ok({ converted });
}
