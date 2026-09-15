import {
  buildInstallments,
  statementId,
  type CardPurchase,
  type CardStatement,
  type CreditCard,
} from "./credit-card";
import type { MonthKey } from "@/core/date/calendar-date";

export function isImportedCardPurchase(purchase: CardPurchase): boolean {
  return purchase.notes?.startsWith("Importado de fatura do cartão.") ?? false;
}

export function affectedStatements(
  purchases: readonly CardPurchase[],
  card: CreditCard,
  statements: readonly CardStatement[],
): CardStatement[] {
  const months = new Set(affectedStatementMonths(purchases, card));
  return statements.filter(
    (statement) => statement.creditCardId === card.id && months.has(statement.referenceMonth),
  );
}

export function affectedStatementMonths(
  purchases: readonly CardPurchase[],
  card: CreditCard,
): MonthKey[] {
  return [
    ...new Set(
      purchases.flatMap((purchase) =>
        buildInstallments(purchase, card).map((part) => part.statementMonth),
      ),
    ),
  ].sort();
}

export function canUndoImportedPurchases(
  purchases: readonly CardPurchase[],
  card: CreditCard,
  statements: readonly CardStatement[],
  payments: readonly { statementId: string }[] = [],
): boolean {
  const ids = new Set(
    affectedStatementMonths(purchases, card).map((month) => statementId(card.id, month)),
  );
  return (
    purchases.length > 0 &&
    purchases.every(
      (purchase) => purchase.creditCardId === card.id && isImportedCardPurchase(purchase),
    ) &&
    affectedStatements(purchases, card, statements).every(
      (statement) => statement.paymentTransactionIds.length === 0,
    ) &&
    payments.every((payment) => !ids.has(payment.statementId))
  );
}
