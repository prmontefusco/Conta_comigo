import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import type { Account } from "./account";
import { accountReferencePatch } from "./account-reference-edit";

const account = {
  openingBalance: money(150100),
  openingBalanceDate: "2026-09-14",
} as Account;

describe("account reference correction", () => {
  it("does not write the baseline during an ordinary account edit", () => {
    expect(accountReferencePatch(account, false, money(0), "2026-09-15" as never)).toEqual({});
  });

  it("writes the baseline only when explicitly correcting it", () => {
    expect(accountReferencePatch(account, true, money(160000), "2026-09-15" as never)).toEqual({
      openingBalance: money(160000),
      openingBalanceDate: "2026-09-15",
    });
  });

  it("uses the balance supplied when creating a new account", () => {
    expect(accountReferencePatch(null, false, money(10000), "2026-09-15" as never)).toEqual({
      openingBalance: money(10000),
      openingBalanceDate: "2026-09-15",
    });
  });
});
