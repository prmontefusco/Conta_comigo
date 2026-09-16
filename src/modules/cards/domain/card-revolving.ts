import { deterministicId } from "@/core/id/id";
import { type Money, add, money } from "@/core/money/money";

export function cardRevolvingDebtId(statementId: string): string {
  return deterministicId("card-revolving", statementId);
}

export function estimateRevolvingCycle(input: {
  readonly principal: Money;
  readonly monthlyRatePercent: number;
  readonly days: number;
  readonly iofDailyPercent?: number;
  readonly iofAdditionalPercent?: number;
}) {
  const interest = money(
    Math.round(input.principal.amount * (input.monthlyRatePercent / 100)),
    input.principal.currency,
  );
  const dailyIof = money(
    Math.round(
      input.principal.amount * ((input.iofDailyPercent ?? 0) / 100) * Math.max(input.days, 0),
    ),
    input.principal.currency,
  );
  const additionalIof = money(
    Math.round(input.principal.amount * ((input.iofAdditionalPercent ?? 0) / 100)),
    input.principal.currency,
  );
  const estimatedNextCharge = add(add(add(input.principal, interest), dailyIof), additionalIof);
  return { interest, dailyIof, additionalIof, estimatedNextCharge };
}
