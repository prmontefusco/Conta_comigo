import { describe, expect, it } from "vitest";
import { fromDecimal, sum, zero } from "@/core/money/money";
import { computeBalance, totalCash } from "@/modules/accounts/domain/account";
import {
  anAccount,
  aTransfer,
  anExpense,
  anIncome,
  brl,
  on,
} from "@/modules/shared/testing/builders";
import {
  cashEffect,
  debtEffect,
  incomeEffect,
  netCashEffect,
  netWorthEffect,
  spendingEffect,
  type Transaction,
} from "./transaction";

/**
 * The mandatory financial correctness cases (docs/PRODUCT.md section 40).
 *
 * These are not ordinary unit tests. Each one encodes a principle that, if
 * broken, would make the app lie to someone about their money.
 */

const audit = { createdAt: "x" as never, updatedAt: "x" as never, createdBy: "user-1" };

describe("a transfer is neither income nor expense", () => {
  const transfer = aTransfer({ amount: brl(1000) });

  it("moves money between accounts without changing net worth", () => {
    expect(netWorthEffect(transfer)).toEqual(zero());
  });

  it("nets to zero across accounts", () => {
    expect(netCashEffect(transfer)).toEqual(zero());
  });

  it("debits one account and credits the other by the same amount", () => {
    const deltas = cashEffect(transfer);
    expect(deltas).toHaveLength(2);
    expect(deltas[0]?.amount.amount).toBe(-100000);
    expect(deltas[1]?.amount.amount).toBe(100000);
  });

  it("never appears as spending", () => {
    expect(spendingEffect(transfer)).toBeNull();
  });

  it("never appears as income", () => {
    expect(incomeEffect(transfer)).toBeNull();
  });

  it("leaves total cash across the household unchanged", () => {
    const source = anAccount({ id: "account-1", openingBalance: brl(3000) });
    const target = anAccount({ id: "account-2", openingBalance: brl(500) });
    const accounts = [source, target];

    const before = totalCash(accounts, new Map(accounts.map((a) => [a.id, computeBalance(a, [])])));
    const after = totalCash(
      accounts,
      new Map(accounts.map((a) => [a.id, computeBalance(a, [transfer])])),
    );

    expect(after).toEqual(before);
    expect(computeBalance(source, [transfer])).toEqual(brl(2000));
    expect(computeBalance(target, [transfer])).toEqual(brl(1500));
  });
});

describe("a loan disbursement is not income", () => {
  const disbursement: Transaction = {
    ...audit,
    id: "tx-loan",
    householdId: "household-a",
    kind: "LOAN_DISBURSEMENT",
    amount: brl(10000),
    transactionDate: on("2026-08-01"),
    competenceDate: on("2026-08-01"),
    description: "Empréstimo pessoal",
    visibility: "HOUSEHOLD",
    accountId: "account-1",
    debtId: "debt-1",
  };

  it("increases available cash", () => {
    expect(cashEffect(disbursement)[0]?.amount).toEqual(brl(10000));
  });

  it("increases debt by the same amount", () => {
    expect(debtEffect(disbursement)).toEqual({ debtId: "debt-1", amount: brl(10000) });
  });

  it("is not counted as income", () => {
    expect(incomeEffect(disbursement)).toBeNull();
  });

  it("is not counted as spending", () => {
    expect(spendingEffect(disbursement)).toBeNull();
  });

  it("leaves net worth unchanged: cash up, obligation up", () => {
    expect(netWorthEffect(disbursement)).toEqual(zero());
  });
});

describe("a debt payment is only an expense in its interest", () => {
  const payment: Transaction = {
    ...audit,
    id: "tx-debt-payment",
    householdId: "household-a",
    kind: "DEBT_PAYMENT",
    amount: brl(1000),
    transactionDate: on("2026-09-01"),
    competenceDate: on("2026-09-01"),
    description: "Parcela 1/10",
    visibility: "HOUSEHOLD",
    accountId: "account-1",
    debtId: "debt-1",
    breakdown: {
      principal: brl(820),
      interest: brl(150),
      fees: brl(20),
      insurance: brl(10),
    },
  };

  it("takes the whole installment out of the account", () => {
    expect(cashEffect(payment)[0]?.amount).toEqual(brl(-1000));
  });

  it("counts only interest, fees and insurance as consumption", () => {
    expect(spendingEffect(payment)?.amount).toEqual(brl(180));
  });

  it("reduces the debt only by the principal portion", () => {
    expect(debtEffect(payment)).toEqual({ debtId: "debt-1", amount: brl(-820) });
  });

  it("reduces net worth only by the cost of borrowing", () => {
    expect(netWorthEffect(payment)).toEqual(brl(-180));
  });

  it("treats the whole payment as amortisation when the lender gave no breakdown", () => {
    const simplified = { ...payment } as Transaction & { breakdown?: unknown };
    delete simplified.breakdown;
    expect(spendingEffect(simplified as Transaction)).toBeNull();
    expect(debtEffect(simplified as Transaction)?.amount).toEqual(brl(-1000));
  });
});

describe("a reserve allocation is not an expense", () => {
  const allocation: Transaction = {
    ...audit,
    id: "tx-reserve",
    householdId: "household-a",
    kind: "RESERVE_ALLOCATION",
    amount: brl(1000),
    transactionDate: on("2026-08-15"),
    competenceDate: on("2026-08-15"),
    description: "Reserva de emergência",
    visibility: "HOUSEHOLD",
    accountId: "account-1",
    reserveId: "reserve-1",
  };

  it("is never counted as spending", () => {
    expect(spendingEffect(allocation)).toBeNull();
  });

  it("does not change net worth", () => {
    expect(netWorthEffect(allocation)).toEqual(zero());
  });

  it("moves no cash when the reserve lives in the same account", () => {
    expect(cashEffect(allocation)).toEqual([]);
  });

  it("moves cash between accounts when the reserve is kept apart", () => {
    const moved = { ...allocation, counterAccountId: "account-2" } as Transaction;
    const deltas = cashEffect(moved);
    expect(deltas).toEqual([
      { accountId: "account-2", amount: brl(-1000) },
      { accountId: "account-1", amount: brl(1000) },
    ]);
    expect(netCashEffect(moved)).toEqual(zero());
  });
});

describe("a card statement payment is not a second expense", () => {
  const statementPayment: Transaction = {
    ...audit,
    id: "tx-card-payment",
    householdId: "household-a",
    kind: "CARD_STATEMENT_PAYMENT",
    amount: brl(1200),
    transactionDate: on("2026-09-05"),
    competenceDate: on("2026-08-01"),
    description: "Pagamento da fatura",
    visibility: "HOUSEHOLD",
    accountId: "account-1",
    creditCardId: "card-1",
    statementId: "card-1_2026-08",
  };

  it("takes money out of the account", () => {
    expect(cashEffect(statementPayment)[0]?.amount).toEqual(brl(-1200));
  });

  it("is not spending: the purchases were already counted", () => {
    expect(spendingEffect(statementPayment)).toBeNull();
  });

  it("reduces the card debt", () => {
    expect(debtEffect(statementPayment)).toEqual({
      creditCardId: "card-1",
      amount: brl(-1200),
    });
  });

  it("does not change net worth: cash down, debt down", () => {
    expect(netWorthEffect(statementPayment)).toEqual(zero());
  });
});

describe("plain income and expense still behave normally", () => {
  it("income increases cash and net worth", () => {
    const income = anIncome({ amount: brl(5000) });
    expect(cashEffect(income)[0]?.amount).toEqual(brl(5000));
    expect(incomeEffect(income)?.amount).toEqual(brl(5000));
    expect(netWorthEffect(income)).toEqual(brl(5000));
  });

  it("expense decreases cash and net worth", () => {
    const expense = anExpense({ amount: brl(200) });
    expect(cashEffect(expense)[0]?.amount).toEqual(brl(-200));
    expect(spendingEffect(expense)?.amount).toEqual(brl(200));
    expect(netWorthEffect(expense)).toEqual(brl(-200));
  });
});

describe("a month of mixed activity", () => {
  it("reports spending and income without counting money twice", () => {
    const movements: Transaction[] = [
      anIncome({ id: "t1", amount: brl(6000) }),
      anExpense({ id: "t2", amount: brl(450) }),
      aTransfer({ id: "t3", amount: brl(2000) }),
      {
        ...audit,
        id: "t4",
        householdId: "household-a",
        kind: "CARD_STATEMENT_PAYMENT",
        amount: brl(1800),
        transactionDate: on("2026-08-05"),
        competenceDate: on("2026-07-01"),
        description: "Fatura julho",
        visibility: "HOUSEHOLD",
        accountId: "account-1",
        creditCardId: "card-1",
        statementId: "card-1_2026-07",
      },
      {
        ...audit,
        id: "t5",
        householdId: "household-a",
        kind: "LOAN_DISBURSEMENT",
        amount: brl(3000),
        transactionDate: on("2026-08-20"),
        competenceDate: on("2026-08-20"),
        description: "Empréstimo",
        visibility: "HOUSEHOLD",
        accountId: "account-1",
        debtId: "debt-1",
      },
    ];

    const income = sum(movements.map((m) => incomeEffect(m)?.amount ?? zero()));
    const spending = sum(movements.map((m) => spendingEffect(m)?.amount ?? zero()));

    // Only the salary is income; the loan is not, the transfer is not.
    expect(income).toEqual(brl(6000));
    // Only the groceries are spending; the fatura and the transfer are not.
    expect(spending).toEqual(brl(450));

    // Cash reflects everything that actually moved.
    const account = anAccount({ id: "account-1", openingBalance: brl(1000) });
    expect(computeBalance(account, movements)).toEqual(
      fromDecimal(1000 + 6000 - 450 - 2000 - 1800 + 3000),
    );
  });
});
