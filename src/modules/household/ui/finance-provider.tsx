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
import { settledInstallmentNumbers, type Debt } from "@/modules/debts/domain/debt";
import { sortDecisions, type Decision } from "@/modules/decisions/domain/decision";
import { forecast } from "@/modules/forecast/domain/forecast";
import { forecastImportedInvoices } from "@/modules/cards/domain/invoice-forecast";
import { paidCardInvoicePlanInstallments } from "@/modules/cards/domain/card-invoice-plan";
import type { ForecastInput, ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import { recurringRulesWithHistoricalAverages } from "@/modules/recurring/domain/variable-expense-estimator";
import { protectedTotal, type Goal, type Reserve } from "@/modules/reserves/domain/reserve";
import { computeBalances, totalCash } from "@/modules/accounts/domain/account";
import type { Transaction } from "@/modules/transactions/domain/transaction";
import { parseDocument } from "@/modules/shared/infrastructure/codecs";
import {
  accountSchema,
  budgetSchema,
  cardPurchaseSchema,
  cardInvoiceSchema,
  categorySchema,
  creditCardSchema,
  debtSchema,
  decisionSchema,
  goalSchema,
  irpfRecordSchema,
  obligationSchema,
  propertySchema,
  recurringRuleSchema,
  reserveSchema,
  transactionSchema,
  vehicleSchema,
  type PropertyDoc,
  type IrpfRecordDoc,
  type VehicleDoc,
  type CardInvoiceDoc,
} from "@/modules/shared/infrastructure/schemas";
import { limitsFor } from "@/modules/billing/domain/plan-limits";
import type { UserPlan } from "@/modules/billing/domain/subscription";
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

/**
 * Até onde os dados são derivados, sempre.
 *
 * Faturas de cartão são projetadas para todo esse intervalo independente do
 * plano: o horizonte do plano decide o que a tela **mostra**, não o que o
 * aplicativo sabe. Cortar os dados na origem faria o total de dívida do
 * gratuito ficar menor que o real, que é mentira de outro tipo.
 */
const DATA_HORIZON_MONTHS = 24;

/**
 * Até onde a projeção vai, por plano.
 *
 * Três meses no gratuito é o bastante para ver o mês virar e o seguinte
 * chegar — que é a pergunta de quem está apertado. Treze meses é o que
 * responde "quando isso acaba", e é o que o Premium acrescenta.
 */
function forecastHorizonMonths(plan: UserPlan): number {
  return limitsFor(plan).forecastMonths;
}

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
  readonly cardInvoices: readonly CardInvoiceDoc[];
  readonly importedInvoiceForecast: ReturnType<typeof forecastImportedInvoices>;
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
  readonly vehicles: readonly VehicleDoc[];
  readonly properties: readonly PropertyDoc[];
  readonly irpfRecords: readonly IrpfRecordDoc[];
  /**
   * O que a família registrou ter decidido, do mais recente para o mais
   * antigo. Não entra em nenhum cálculo: uma anotação nunca move um saldo.
   */
  readonly decisions: readonly Decision[];
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
  cardInvoices?: CardInvoiceDoc[];
  debts: Debt[];
  recurringRules: RecurringRule[];
  reserves: Reserve[];
  goals: Goal[];
  budgets: Budget[];
  decisions: Decision[];
  vehicles: VehicleDoc[];
  properties: PropertyDoc[];
  irpfRecords: IrpfRecordDoc[];
};

const EMPTY_STATE: CollectionState = {
  accounts: [],
  categories: [],
  transactions: [],
  obligations: [],
  creditCards: [],
  cardPurchases: [],
  cardInvoices: [],
  debts: [],
  recurringRules: [],
  reserves: [],
  goals: [],
  budgets: [],
  decisions: [],
  vehicles: [],
  properties: [],
  irpfRecords: [],
};

const SUBSCRIPTIONS = [
  ["accounts", accountSchema],
  ["categories", categorySchema],
  ["transactions", transactionSchema],
  ["obligations", obligationSchema],
  ["creditCards", creditCardSchema],
  ["cardPurchases", cardPurchaseSchema],
  ["cardInvoices", cardInvoiceSchema],
  ["debts", debtSchema],
  ["recurringRules", recurringRuleSchema],
  ["reserves", reserveSchema],
  ["goals", goalSchema],
  ["budgets", budgetSchema],
  ["decisions", decisionSchema],
  ["vehicles", vehicleSchema],
  ["properties", propertySchema],
  ["irpfRecords", irpfRecordSchema],
] as const satisfies ReadonlyArray<readonly [keyof CollectionState, z.ZodType]>;

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { household, effectivePlan } = useSession();
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
    return deriveFinanceData(state, asOf, pending > 0, error, effectivePlan);
  }, [state, timezone, pending, error, effectivePlan]);

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
  /** Decide até onde a projeção é exibida. Os dados vão sempre até o fim. */
  plan: UserPlan = "PREMIUM",
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
  const toMonth = monthKeyOf(addMonths(asOf, DATA_HORIZON_MONTHS));
  const financedStatementIds = new Set(
    state.debts.flatMap((debt) => (debt.sourceCardStatementId ? [debt.sourceCardStatementId] : [])),
  );

  const cardStatements = state.creditCards.flatMap((card) =>
    projectStatements(
      card,
      state.cardPurchases,
      statementPayments,
      fromMonth,
      toMonth,
      asOf,
      state.cardInvoices ?? [],
      financedStatementIds,
    ),
  );
  const importedInvoiceForecast = forecastImportedInvoices(
    state.cardInvoices ?? [],
    fromMonth,
    toMonth,
  );

  /* --- Balances ------------------------------------------------------- */

  const balances = computeBalances(state.accounts, state.transactions, asOf);
  const cash = totalCash(state.accounts, balances);
  const reserved = protectedTotal(state.reserves);

  /* --- Projection ----------------------------------------------------- */

  // Card-invoice plans carry explicit installment numbers, so correcting a
  // payment cannot silently mark another installment paid by count alone.
  // Ordinary debt schedules retain their historical count-based convention.
  const paidDebtInstallments = new Map(
    state.debts.map((debt) => {
      const payments = state.transactions.filter(
        (transaction): transaction is Extract<Transaction, { kind: "DEBT_PAYMENT" }> =>
          transaction.kind === "DEBT_PAYMENT" && transaction.debtId === debt.id,
      );
      return [
        debt.id,
        debt.sourceCardInvoiceId
          ? paidCardInvoicePlanInstallments(payments, debt.id)
          : settledInstallmentNumbers(debt, payments.length),
      ];
    }),
  );
  const effectiveDebts: Debt[] = state.debts.map((debt) =>
    debt.sourceCardInvoiceId
      ? {
          ...debt,
          status:
            (paidDebtInstallments.get(debt.id)?.length ?? 0) >= debt.installmentCount
              ? "SETTLED"
              : "ACTIVE",
        }
      : debt,
  );

  const forecastRecurringRules = recurringRulesWithHistoricalAverages({
    rules: state.recurringRules,
    transactions: state.transactions,
    obligations: state.obligations,
    asOf,
    lookbackMonths: 3,
  });

  const forecastInput: ForecastInput = {
    asOf,
    horizon: dateRange(asOf, addMonths(asOf, forecastHorizonMonths(plan))),
    openingBalance: cash,
    protectedReserve: reserved,
    obligations: state.obligations,
    recurringRules: forecastRecurringRules,
    cardStatements,
    debts: effectiveDebts,
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
    debts: effectiveDebts,
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
    accounts: state.accounts,
    transactions: state.transactions,
    cards: state.creditCards,
    cardStatements,
    reserves: state.reserves,
    debts: effectiveDebts,
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
    cardInvoices: state.cardInvoices ?? [],
    importedInvoiceForecast,
    cardStatements,
    debts: effectiveDebts,
    paidDebtInstallments,
    recurringRules: state.recurringRules,
    reserves: state.reserves,
    goals: state.goals,
    budgets: state.budgets,
    vehicles: state.vehicles,
    properties: state.properties,
    irpfRecords: state.irpfRecords,
    decisions: sortDecisions(state.decisions),
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
