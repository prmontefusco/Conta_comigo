"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot, type FirestoreError } from "firebase/firestore";
import type { z } from "zod";
import {
  addMonths,
  dateRange,
  monthKeyOf,
  todayIn,
  type CalendarDate,
} from "@/core/date/calendar-date";
import { getDb } from "@/lib/firebase/client";
import type { Account } from "@/modules/accounts/domain/account";
import { buildAlerts, type Alert } from "@/modules/alerts/domain/alerts";
import {
  computeBudgetStatus,
  type Budget,
  type BudgetStatus,
} from "@/modules/budget/domain/budget";
import {
  projectStatements,
  type CardPurchase,
  type CardStatement,
  type CreditCard,
  type StatementPayment,
} from "@/modules/cards/domain/credit-card";
import type { Category } from "@/modules/categories/domain/category";
import { buildOverview, type DashboardOverview } from "@/modules/dashboard/domain/overview";
import type { Debt } from "@/modules/debts/domain/debt";
import { forecast } from "@/modules/forecast/domain/forecast";
import type { ForecastInput, ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import { protectedTotal, type Goal, type Reserve } from "@/modules/reserves/domain/reserve";
import { computeBalances, totalCash } from "@/modules/accounts/domain/account";
import type { Transaction } from "@/modules/transactions/domain/transaction";
import { parseDocument } from "@/modules/shared/infrastructure/codecs";
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
} from "@/modules/shared/infrastructure/schemas";
import { useSession } from "./session-provider";

/**
 * The household's financial data, and everything derived from it.
 *
 * All calculation happens here, in memory, from plain domain objects. Firestore
 * only supplies documents; it never computes a balance, a statement or a
 * projection. That is what makes the numbers testable without a database
 * (docs/ARCHITECTURE.md).
 *
 * A household's document count is small - thousands, not millions - so loading
 * the whole set and deriving from it is both simpler and cheaper than a fleet
 * of aggregate queries. The day that stops being true is the day to revisit it,
 * and the boundary is right here.
 */

const FORECAST_HORIZON_MONTHS = 13;

export interface FinanceData {
  readonly loading: boolean;
  readonly error: string | null;
  readonly asOf: CalendarDate;

  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly obligations: readonly Obligation[];
  readonly cards: readonly CreditCard[];
  readonly cardPurchases: readonly CardPurchase[];
  readonly cardStatements: readonly CardStatement[];
  readonly debts: readonly Debt[];
  /**
   * Which instalments of each debt are already paid.
   *
   * Derived from the recorded payments, and needed wherever a debt's real
   * balance is shown: a screen that omits it reports the contracted amount
   * for ever, as if nothing had been paid.
   */
  readonly paidDebtInstallments: ReadonlyMap<string, readonly number[]>;
  readonly recurringRules: readonly RecurringRule[];
  readonly reserves: readonly Reserve[];
  readonly goals: readonly Goal[];
  readonly budgets: readonly Budget[];
  /**
   * This month's budget standing, when there is a budget for it.
   *
   * Computed once here so the budget screen, the alerts and the guidance can
   * never disagree about whether a category is over its ceiling.
   */
  readonly budgetStatus: BudgetStatus | null;

  readonly totalCash: ReturnType<typeof totalCash>;
  readonly protectedReserve: ReturnType<typeof protectedTotal>;
  readonly forecast: ForecastResult;
  readonly overview: DashboardOverview;
  readonly alerts: readonly Alert[];
  readonly forecastInput: ForecastInput;
}

const FinanceContext = createContext<FinanceData | null>(null);

type CollectionState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  obligations: Obligation[];
  creditCards: CreditCard[];
  cardPurchases: CardPurchase[];
  debts: Debt[];
  recurringRules: RecurringRule[];
  reserves: Reserve[];
  goals: Goal[];
  budgets: Budget[];
};

const EMPTY_STATE: CollectionState = {
  accounts: [],
  categories: [],
  transactions: [],
  obligations: [],
  creditCards: [],
  cardPurchases: [],
  debts: [],
  recurringRules: [],
  reserves: [],
  goals: [],
  budgets: [],
};

const SUBSCRIPTIONS = [
  ["accounts", accountSchema],
  ["categories", categorySchema],
  ["transactions", transactionSchema],
  ["obligations", obligationSchema],
  ["creditCards", creditCardSchema],
  ["cardPurchases", cardPurchaseSchema],
  ["debts", debtSchema],
  ["recurringRules", recurringRuleSchema],
  ["reserves", reserveSchema],
  ["goals", goalSchema],
  ["budgets", budgetSchema],
] as const satisfies ReadonlyArray<readonly [keyof CollectionState, z.ZodType]>;

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { household } = useSession();
  const [state, setState] = useState<CollectionState>(EMPTY_STATE);
  const [pending, setPending] = useState<number>(SUBSCRIPTIONS.length);
  const [error, setError] = useState<string | null>(null);

  const householdId = household?.id ?? null;
  const timezone = household?.settings.timezone ?? "America/Sao_Paulo";

  useEffect(() => {
    if (!householdId) {
      setState(EMPTY_STATE);
      setPending(SUBSCRIPTIONS.length);
      return;
    }

    setState(EMPTY_STATE);
    setPending(SUBSCRIPTIONS.length);
    setError(null);

    const seen = new Set<string>();

    const unsubscribes = SUBSCRIPTIONS.map(([name, schema]) => {
      const path = `households/${householdId}/${name}`;

      return onSnapshot(
        collection(getDb(), path),
        (snapshot) => {
          try {
            const items = snapshot.docs.map((document) =>
              parseDocument(schema, document.id, document.data(), path),
            );
            setState((current) => ({ ...current, [name]: items }) as CollectionState);
          } catch (parseError) {
            // One malformed document must not blank out the whole screen.
            console.error(`[conta-comigo] ${(parseError as Error).message}`);
            setError(
              "Alguns registros não puderam ser lidos. Os demais valores continuam corretos.",
            );
          } finally {
            if (!seen.has(name)) {
              seen.add(name);
              setPending((count) => Math.max(count - 1, 0));
            }
          }
        },
        (snapshotError: FirestoreError) => {
          console.error(`[conta-comigo] ${path}: ${snapshotError.code}`);
          setError(
            snapshotError.code === "permission-denied"
              ? "Você não tem acesso a estes dados."
              : "Não foi possível carregar os dados agora.",
          );
          if (!seen.has(name)) {
            seen.add(name);
            setPending((count) => Math.max(count - 1, 0));
          }
        },
      );
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [householdId]);

  const value = useMemo<FinanceData>(() => {
    const asOf = todayIn(timezone);
    return deriveFinanceData(state, asOf, pending > 0, error);
  }, [state, timezone, pending, error]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

/**
 * Turns raw collections into every number the app shows.
 *
 * Exported so tests can exercise it directly with fixture data, no React and
 * no Firestore involved.
 */
export function deriveFinanceData(
  state: CollectionState,
  asOf: CalendarDate,
  loading: boolean,
  error: string | null,
): FinanceData {
  /* --- Card statements are derived, never stored ---------------------- */

  const statementPayments: StatementPayment[] = state.transactions
    .filter((transaction) => transaction.kind === "CARD_STATEMENT_PAYMENT")
    .map((transaction) => ({
      transactionId: transaction.id,
      statementId: transaction.statementId,
      amount: transaction.amount,
    }));

  const fromMonth = monthKeyOf(addMonths(asOf, -18));
  const toMonth = monthKeyOf(addMonths(asOf, FORECAST_HORIZON_MONTHS));

  const cardStatements = state.creditCards.flatMap((card) =>
    projectStatements(card, state.cardPurchases, statementPayments, fromMonth, toMonth, asOf),
  );

  /* --- Balances ------------------------------------------------------- */

  const balances = computeBalances(state.accounts, state.transactions, asOf);
  const cash = totalCash(state.accounts, balances);
  const reserved = protectedTotal(state.reserves);

  /* --- Projection ----------------------------------------------------- */

  // Installments are paid in order, so N recorded payments settle installments
  // 1..N. This holds for every ordinary repayment schedule; the day the app
  // supports paying an installment out of order, the payment transaction gains
  // an explicit installment number and this collapses to reading that field.
  const paidDebtInstallments = new Map(
    state.debts.map((debt) => {
      const paymentCount = state.transactions.filter(
        (transaction) => transaction.kind === "DEBT_PAYMENT" && transaction.debtId === debt.id,
      ).length;
      return [debt.id, Array.from({ length: paymentCount }, (_unused, index) => index + 1)];
    }),
  );

  const forecastInput: ForecastInput = {
    asOf,
    horizon: dateRange(asOf, addMonths(asOf, FORECAST_HORIZON_MONTHS)),
    openingBalance: cash,
    protectedReserve: reserved,
    obligations: state.obligations,
    recurringRules: state.recurringRules,
    cardStatements,
    debts: state.debts,
    paidDebtInstallments,
  };

  const projection = forecast(forecastInput);

  const overview = buildOverview({
    asOf,
    accounts: state.accounts,
    transactions: state.transactions,
    obligations: state.obligations,
    reserves: state.reserves,
    cards: state.creditCards,
    cardStatements,
    debts: state.debts,
    forecast: projection,
  });

  /* --- Budget ---------------------------------------------------------- */

  const currentBudget = state.budgets.find((budget) => budget.month === monthKeyOf(asOf)) ?? null;
  const budgetStatus = currentBudget
    ? computeBudgetStatus(currentBudget, state.transactions, state.obligations)
    : null;

  const alerts = buildAlerts({
    asOf,
    overview,
    forecast: projection,
    cards: state.creditCards,
    cardStatements,
    reserves: state.reserves,
    debts: state.debts,
    paidDebtInstallments,
    budgetStatus,
  });

  return {
    loading,
    error,
    asOf,
    accounts: state.accounts,
    categories: state.categories,
    transactions: state.transactions,
    obligations: state.obligations,
    cards: state.creditCards,
    cardPurchases: state.cardPurchases,
    cardStatements,
    debts: state.debts,
    paidDebtInstallments,
    recurringRules: state.recurringRules,
    reserves: state.reserves,
    goals: state.goals,
    budgets: state.budgets,
    budgetStatus,
    totalCash: cash,
    protectedReserve: reserved,
    forecast: projection,
    overview,
    alerts,
    forecastInput,
  };
}

export function useFinance(): FinanceData {
  const value = useContext(FinanceContext);
  if (!value) {
    throw new Error("useFinance precisa estar dentro de <FinanceProvider>.");
  }
  return value;
}
