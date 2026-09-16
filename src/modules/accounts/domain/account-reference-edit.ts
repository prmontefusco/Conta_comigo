import type { CalendarDate } from "@/core/date/calendar-date";
import type { Money } from "@/core/money/money";
import type { Account } from "./account";

/** Ordinary metadata edits must never re-write the balance baseline. */
export function accountReferencePatch(
  account: Account | null,
  correctingReference: boolean,
  openingBalance: Money,
  openingBalanceDate: CalendarDate,
): { openingBalance?: Money; openingBalanceDate?: CalendarDate } {
  return account && !correctingReference ? {} : { openingBalance, openingBalanceDate };
}
