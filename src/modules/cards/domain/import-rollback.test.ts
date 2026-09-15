import { describe, expect, it } from "vitest";
import { monthKey } from "@/core/date/calendar-date";
import { aCardPurchase, aCreditCard, brl, on } from "@/modules/shared/testing/builders";
import { projectStatements } from "./credit-card";
import {
  affectedStatements,
  canUndoImportedPurchases,
  isImportedCardPurchase,
} from "./import-rollback";

const card = aCreditCard({ closingDay: 12, dueDay: 18 });
const imported = aCardPurchase({
  creditCardId: card.id,
  purchaseDate: on("2025-10-12"),
  installmentCount: 12,
  totalAmount: brl(120),
  notes: "Importado de fatura do cartão. Chave: teste",
});
const manual = aCardPurchase({ creditCardId: card.id, notes: "Compra manual" });
const statements = projectStatements(
  card,
  [imported],
  [],
  monthKey("2025-10"),
  monthKey("2026-09"),
  on("2026-09-15"),
);

describe("desfazer importação de cartão", () => {
  it("identifica somente compras importadas, inclusive registros antigos", () => {
    expect(isImportedCardPurchase(imported)).toBe(true);
    expect(isImportedCardPurchase(manual)).toBe(false);
  });

  it("mostra todos os meses que uma compra parcelada afeta", () => {
    expect(affectedStatements([imported], card, statements)).toHaveLength(12);
  });

  it("não permite remover compras manuais nem faturas com pagamento", () => {
    expect(canUndoImportedPurchases([imported], card, statements)).toBe(true);
    expect(canUndoImportedPurchases([manual], card, statements)).toBe(false);
    expect(canUndoImportedPurchases([], card, statements)).toBe(false);
    const paid = statements.map((statement, index) =>
      index === 0 ? { ...statement, paymentTransactionIds: ["pagamento"] } : statement,
    );
    expect(canUndoImportedPurchases([imported], card, paid)).toBe(false);
    expect(
      canUndoImportedPurchases([imported], card, [], [{ statementId: statements[0]!.id }]),
    ).toBe(false);
  });
});
