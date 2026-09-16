import type { UserProfile } from "./household";
import type { Account } from "@/modules/accounts/domain/account";
import type { CreditCard } from "@/modules/cards/domain/credit-card";
import type { Debt } from "@/modules/debts/domain/debt";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";

export interface InitialSetupData {
  readonly accounts: readonly Account[];
  readonly cards: readonly CreditCard[];
  readonly recurringRules: readonly RecurringRule[];
  readonly debts: readonly Debt[];
}

export function initialSetupProgress(profile: UserProfile | null, data: InitialSetupData) {
  const completed = new Set(profile?.onboardingCompletedSteps ?? []);
  const personalData = Boolean(
    profile?.cpf ||
    profile?.phone ||
    profile?.birthDate ||
    profile?.occupation ||
    profile?.address?.city ||
    profile?.financialGoal,
  );
  const steps = {
    personalData,
    bankAccounts: data.accounts.some((account) => !account.archived),
    cards: data.cards.some((card) => !card.archived) || completed.has("ADD_CARDS"),
    monthlyBills: data.recurringRules.some((rule) => rule.active && rule.direction === "OUTFLOW"),
    debts: data.debts.length > 0 || completed.has("ADD_DEBTS"),
  };
  const values = Object.values(steps);
  return {
    steps,
    completed: values.filter(Boolean).length,
    total: values.length,
    done: values.every(Boolean),
  };
}
