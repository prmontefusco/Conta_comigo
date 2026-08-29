"use client";

import { useMemo } from "react";
import { getDb } from "@/lib/firebase/client";
import { useSession } from "@/modules/household/ui/session-provider";
import { householdCollection, type HouseholdCollection } from "../infrastructure/collection";
import {
  accountSchema,
  budgetSchema,
  cardPurchaseSchema,
  categorySchema,
  creditCardSchema,
  debtSchema,
  goalSchema,
  obligationSchema,
  recurringRuleSchema,
  reserveSchema,
  transactionSchema,
  vehicleSchema,
  type AccountDoc,
  type BudgetDoc,
  type CardPurchaseDoc,
  type CategoryDoc,
  type CreditCardDoc,
  type DebtDoc,
  type GoalDoc,
  type ObligationDoc,
  type RecurringRuleDoc,
  type ReserveDoc,
  type TransactionDoc,
  type VehicleDoc,
} from "../infrastructure/schemas";

/**
 * Typed write access to the current household's collections.
 *
 * Reads come from the finance provider's live subscriptions; this hook is for
 * writing. Both go through the same schemas, so a document can never be written
 * in a shape the reader would reject.
 */

export interface HouseholdCollections {
  readonly ready: boolean;
  readonly householdId: string | null;
  readonly accounts: HouseholdCollection<AccountDoc>;
  readonly categories: HouseholdCollection<CategoryDoc>;
  readonly transactions: HouseholdCollection<TransactionDoc>;
  readonly obligations: HouseholdCollection<ObligationDoc>;
  readonly creditCards: HouseholdCollection<CreditCardDoc>;
  readonly cardPurchases: HouseholdCollection<CardPurchaseDoc>;
  readonly debts: HouseholdCollection<DebtDoc>;
  readonly recurringRules: HouseholdCollection<RecurringRuleDoc>;
  readonly budgets: HouseholdCollection<BudgetDoc>;
  readonly reserves: HouseholdCollection<ReserveDoc>;
  readonly goals: HouseholdCollection<GoalDoc>;
  readonly vehicles: HouseholdCollection<VehicleDoc>;
}

export function useCollections(): HouseholdCollections {
  const { household, user } = useSession();

  return useMemo(() => {
    const context = {
      db: getDb(),
      householdId: household?.id ?? "",
      uid: user?.uid ?? "",
    };

    return {
      ready: Boolean(household && user),
      householdId: household?.id ?? null,
      accounts: householdCollection(context, "accounts", accountSchema),
      categories: householdCollection(context, "categories", categorySchema),
      transactions: householdCollection(context, "transactions", transactionSchema),
      obligations: householdCollection(context, "obligations", obligationSchema),
      creditCards: householdCollection(context, "creditCards", creditCardSchema),
      cardPurchases: householdCollection(context, "cardPurchases", cardPurchaseSchema),
      debts: householdCollection(context, "debts", debtSchema),
      recurringRules: householdCollection(context, "recurringRules", recurringRuleSchema),
      budgets: householdCollection(context, "budgets", budgetSchema),
      reserves: householdCollection(context, "reserves", reserveSchema),
      goals: householdCollection(context, "goals", goalSchema),
      vehicles: householdCollection(context, "vehicles", vehicleSchema),
    };
  }, [household, user]);
}
