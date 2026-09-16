import { describe, expect, it } from "vitest";
import type { Debt } from "./debt";
import { legacyCardAgreements, loanContracts } from "./debt-sections";

const items = [
  { id: "loan", kind: "PERSONAL_LOAN" },
  { id: "linked-card", kind: "CARD_RENEGOTIATION", sourceCardStatementId: "card_2026-09" },
  { id: "older-card", kind: "CARD_RENEGOTIATION" },
] as Debt[];

describe("debt screen separation", () => {
  it("keeps cards out of the loan analysis", () => {
    expect(loanContracts(items).map((item) => item.id)).toEqual(["loan"]);
  });
  it("retains older manually entered card agreements for correction", () => {
    expect(legacyCardAgreements(items).map((item) => item.id)).toEqual(["older-card"]);
  });
});
