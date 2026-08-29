import { type CalendarDate, calendarDate, instant, type Instant } from "@/core/date/calendar-date";
import { fromDecimal, type Money, zero } from "@/core/money/money";
import type { Account } from "@/modules/accounts/domain/account";
import type { CardPurchase, CreditCard } from "@/modules/cards/domain/credit-card";
import type { Debt } from "@/modules/debts/domain/debt";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import type { Reserve } from "@/modules/reserves/domain/reserve";
import type { Transaction } from "@/modules/transactions/domain/transaction";

/**
 * Test builders.
 *
 * Every builder fills in sensible defaults so a test states only what it is
 * actually about. A test that reads "a purchase of R$ 1.200 in 6x" should not
 * be buried in twenty irrelevant fields.
 */

export const HOUSEHOLD = "household-a";
export const OTHER_HOUSEHOLD = "household-b";
const NOW: Instant = instant("2026-08-28T12:00:00.000Z");

const audit = {
  createdAt: NOW,
  updatedAt: NOW,
  createdBy: "user-1",
};

export const brl = (value: number): Money => fromDecimal(value);
export const on = (value: string): CalendarDate => calendarDate(value);

export function anAccount(overrides: Partial<Account> = {}): Account {
  return {
    ...audit,
    id: "account-1",
    householdId: HOUSEHOLD,
    name: "Conta corrente",
    type: "CHECKING",
    openingBalance: brl(0),
    openingBalanceDate: on("2026-01-01"),
    visibility: "HOUSEHOLD",
    includeInTotals: true,
    archived: false,
    ...overrides,
  };
}

export function anIncome(overrides: Partial<Transaction> = {}): Transaction {
  return {
    ...audit,
    id: "tx-income",
    householdId: HOUSEHOLD,
    kind: "INCOME",
    amount: brl(5000),
    transactionDate: on("2026-08-05"),
    competenceDate: on("2026-08-05"),
    description: "Salário",
    visibility: "HOUSEHOLD",
    accountId: "account-1",
    ...overrides,
  } as Transaction;
}

export function anExpense(overrides: Partial<Transaction> = {}): Transaction {
  return {
    ...audit,
    id: "tx-expense",
    householdId: HOUSEHOLD,
    kind: "EXPENSE",
    amount: brl(200),
    transactionDate: on("2026-08-10"),
    competenceDate: on("2026-08-10"),
    description: "Supermercado",
    visibility: "HOUSEHOLD",
    accountId: "account-1",
    categoryId: "category-food",
    ...overrides,
  } as Transaction;
}

export function aTransfer(overrides: Partial<Transaction> = {}): Transaction {
  return {
    ...audit,
    id: "tx-transfer",
    householdId: HOUSEHOLD,
    kind: "TRANSFER",
    amount: brl(1000),
    transactionDate: on("2026-08-10"),
    competenceDate: on("2026-08-10"),
    description: "Transferência entre contas",
    visibility: "HOUSEHOLD",
    fromAccountId: "account-1",
    toAccountId: "account-2",
    ...overrides,
  } as Transaction;
}

export function anObligation(overrides: Partial<Obligation> = {}): Obligation {
  return {
    ...audit,
    id: "obligation-1",
    householdId: HOUSEHOLD,
    direction: "OUTFLOW",
    origin: "MANUAL",
    description: "Conta de energia",
    amount: brl(300),
    dueDate: on("2026-09-10"),
    competenceDate: on("2026-09-01"),
    expenseNature: "FIXED",
    confidence: "CONFIRMED",
    visibility: "HOUSEHOLD",
    status: "SCHEDULED",
    settledAmount: zero(),
    settlementTransactionIds: [],
    ...overrides,
  };
}

export function aRecurringRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    ...audit,
    id: "rule-1",
    householdId: HOUSEHOLD,
    direction: "OUTFLOW",
    description: "Internet",
    amount: brl(120),
    frequency: "MONTHLY",
    interval: 1,
    dayOfMonth: 10,
    startDate: on("2026-01-10"),
    weekendPolicy: "KEEP",
    expenseNature: "FIXED",
    confidence: "CONFIRMED",
    visibility: "HOUSEHOLD",
    active: true,
    ...overrides,
  };
}

export function aCreditCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    ...audit,
    id: "card-1",
    householdId: HOUSEHOLD,
    name: "Cartão principal",
    creditLimit: brl(5000),
    closingDay: 25,
    dueDay: 5,
    visibility: "HOUSEHOLD",
    archived: false,
    ...overrides,
  };
}

export function aCardPurchase(overrides: Partial<CardPurchase> = {}): CardPurchase {
  return {
    ...audit,
    id: "purchase-1",
    householdId: HOUSEHOLD,
    creditCardId: "card-1",
    description: "Geladeira",
    totalAmount: brl(1200),
    purchaseDate: on("2026-08-10"),
    competenceDate: on("2026-08-10"),
    categoryId: "category-home",
    installmentCount: 6,
    visibility: "HOUSEHOLD",
    ...overrides,
  };
}

export function aDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    ...audit,
    id: "debt-1",
    householdId: HOUSEHOLD,
    kind: "PERSONAL_LOAN",
    description: "Empréstimo pessoal",
    principalContracted: brl(10000),
    amountDisbursed: brl(10000),
    disbursementDate: on("2026-08-01"),
    amortisationSystem: "SIMPLE",
    installmentCount: 10,
    installmentAmount: brl(1000),
    firstDueDate: on("2026-09-01"),
    status: "ACTIVE",
    visibility: "HOUSEHOLD",
    ...overrides,
  };
}

export function aReserve(overrides: Partial<Reserve> = {}): Reserve {
  return {
    ...audit,
    id: "reserve-1",
    householdId: HOUSEHOLD,
    name: "Reserva de emergência",
    purpose: "EMERGENCY",
    currentAmount: brl(6000),
    isProtected: true,
    visibility: "HOUSEHOLD",
    archived: false,
    ...overrides,
  };
}
