import type { Debt } from "./debt";

/** Card invoice plans are managed with their originating card, not loans. */
export function loanContracts(debts: readonly Debt[]): Debt[] {
  return debts.filter((debt) => debt.kind !== "CARD_RENEGOTIATION");
}

/** Keep manually entered older card agreements editable without mixing analyses. */
export function legacyCardAgreements(debts: readonly Debt[]): Debt[] {
  return debts.filter((debt) => debt.kind === "CARD_RENEGOTIATION" && !debt.sourceCardStatementId);
}
