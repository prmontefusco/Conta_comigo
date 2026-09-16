import { describe, expect, it } from "vitest";
import { anAccount, aCreditCard, aDebt, aRecurringRule } from "@/modules/shared/testing/builders";
import type { UserProfile } from "./household";
import { initialSetupProgress } from "./setup-progress";

const profile = {
  onboardingCompletedSteps: [],
  financialGoal: "ORGANIZATION",
} as unknown as UserProfile;

describe("initialSetupProgress", () => {
  it("follows the five setup stages using real registered data", () => {
    const progress = initialSetupProgress(profile, {
      accounts: [anAccount()],
      cards: [aCreditCard()],
      recurringRules: [aRecurringRule({ direction: "OUTFLOW", active: true })],
      debts: [aDebt()],
    });
    expect(progress.done).toBe(true);
    expect(progress.completed).toBe(5);
  });

  it("accepts explicit not-applicable choices for cards and debts", () => {
    const progress = initialSetupProgress(
      {
        ...profile,
        onboardingCompletedSteps: ["ADD_CARDS", "ADD_DEBTS"],
      },
      {
        accounts: [anAccount()],
        cards: [],
        recurringRules: [aRecurringRule({ direction: "OUTFLOW", active: true })],
        debts: [],
      },
    );
    expect(progress.steps.cards).toBe(true);
    expect(progress.steps.debts).toBe(true);
    expect(progress.done).toBe(true);
  });

  it("does not count one-off bills as monthly setup", () => {
    const progress = initialSetupProgress(profile, {
      accounts: [anAccount()],
      cards: [aCreditCard()],
      recurringRules: [],
      debts: [aDebt()],
    });
    expect(progress.steps.monthlyBills).toBe(false);
    expect(progress.done).toBe(false);
  });
});
