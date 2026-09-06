import { describe, expect, it } from "vitest";
import { calendarDate, dateRange } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import { calculateRecoveryTimeline } from "./recovery-calculator";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { Debt } from "@/modules/debts/domain/debt";

describe("calculateRecoveryTimeline", () => {
  const dummyForecast: ForecastResult = {
    asOf: calendarDate("2026-09-01"),
    horizon: dateRange(calendarDate("2026-09-01"), calendarDate("2027-09-01")),
    openingBalance: money(100000),
    protectedReserve: money(0),
    days: [],
    months: [],
    events: [],
    summary: {
      projectedCashBalance: money(150000),
      protectedReserve: money(0),
      freeProjectedBalance: money(150000),
      committedOutflows: money(300000),
      expectedInflows: money(350000),
      debtCommitment: money(40000),
      overdueAmount: money(0),
      upcomingAmount: money(150000),
      lowestProjectedBalance: money(50000),
      lowestProjectedBalanceDate: calendarDate("2026-09-15"),
    },
  };

  /**
   * Uma família cujo mês fecha: R$ 5.000 entram, R$ 4.000 saem e R$ 300 disso
   * já é parcela, então sobram R$ 1.300 por mês para atacar a dívida.
   *
   * O `dummyForecast` acima não tem meses, e sem meses não há renda conhecida
   * — o que hoje devolve, corretamente, um plano sem data.
   */
  const viableForecast: ForecastResult = {
    ...dummyForecast,
    months: Array.from({ length: 12 }, (_unused, index) => ({
      month: `2026-${String(index + 1).padStart(2, "0")}` as never,
      expectedInflows: money(500000),
      committedOutflows: money(400000),
      debtCommitment: money(30000),
      net: money(100000),
      openingCashBalance: money(0),
      endingCashBalance: money(0),
      freeEndingBalance: money(0),
      lowestBalance: money(0),
      lowestBalanceDate: calendarDate("2026-09-01"),
      isDeficit: false,
      deficitAmount: money(0),
      isPartial: false,
    })),
  };

  it("calcula marcos e tempo de quitação para dívidas ativas", () => {
    const mockDebt = {
      id: "debt-1",
      householdId: "h1",
      kind: "PERSONAL_LOAN",
      description: "Empréstimo Caixa",
      principalContracted: money(240000),
      amountDisbursed: money(240000),
      disbursementDate: calendarDate("2026-01-01"),
      amortisationSystem: "PRICE",
      interestRateMonthly: 2.0,
      installmentCount: 12,
      installmentAmount: money(20000),
      firstDueDate: calendarDate("2026-02-01"),
      status: "ACTIVE",
      visibility: "HOUSEHOLD",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
    } as unknown as Debt;

    const result = calculateRecoveryTimeline({
      asOf: calendarDate("2026-09-01"),
      openingBalance: money(100000),
      totalCash: money(100000),
      protectedReserve: money(0),
      // R$ 5.000 entram, R$ 4.000 saem, R$ 300 já são parcela: sobram R$ 1.300
      // por mês para a dívida. O `dummyForecast` original não tinha meses, e
      // sem meses não há renda conhecida — o que hoje, corretamente, devolve
      // um plano sem data.
      forecast: viableForecast,
      debts: [mockDebt],
      cardStatements: [],
      reserves: [],
    });

    expect(result.feasibility.viability).not.toBe("NOT_VIABLE");
    expect(result.monthsToDebtFree ?? 0).toBeGreaterThan(0);
    expect(result.debtFreeDate).toBeDefined();
    expect(result.milestones.length).toBeGreaterThanOrEqual(3);
    expect(result.snowballPlan.strategy).toBe("SNOWBALL");
    expect(result.avalanchePlan.strategy).toBe("AVALANCHE");
  });

  it("identifica usuário sem dívidas e projeta formação de reserva e estabilidade", () => {
    const result = calculateRecoveryTimeline({
      asOf: calendarDate("2026-09-01"),
      openingBalance: money(500000),
      totalCash: money(500000),
      protectedReserve: money(200000),
      forecast: dummyForecast,
      debts: [],
      cardStatements: [],
      reserves: [],
    });

    expect(result.monthsToDebtFree).toBe(0);
    expect(result.totalDebtAmount.amount).toBe(0);
    expect(result.milestones.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * The numbers the plan stands on.
 *
 * These cover the three ways this module used to lie: a monthly surplus taken
 * from horizon totals, a balance that ignored every payment already made, and
 * an "economia" that was a fixed 20% of the interest.
 */
describe("what the plan is built from", () => {
  const asOf = calendarDate("2026-09-01");

  function forecastWithMonths(inflow: number, outflow: number, debtPart = 0): ForecastResult {
    const months = Array.from({ length: 12 }, (_unused, index) => ({
      month: `2026-${String(index + 1).padStart(2, "0")}` as never,
      expectedInflows: money(inflow),
      committedOutflows: money(outflow),
      debtCommitment: money(debtPart),
      net: money(inflow - outflow),
      openingCashBalance: money(0),
      endingCashBalance: money(0),
      freeEndingBalance: money(0),
      lowestBalance: money(0),
      lowestBalanceDate: asOf,
      isDeficit: outflow > inflow,
      deficitAmount: money(Math.max(0, outflow - inflow)),
      isPartial: false,
    }));

    return {
      asOf,
      horizon: dateRange(asOf, calendarDate("2027-09-01")),
      openingBalance: money(0),
      protectedReserve: money(0),
      days: [],
      months,
      events: [],
      summary: {
        // Horizon totals: twelve times the monthly figures. Using these as if
        // they were monthly is exactly the bug these tests guard.
        projectedCashBalance: money(0),
        protectedReserve: money(0),
        freeProjectedBalance: money(0),
        committedOutflows: money(outflow * 12),
        expectedInflows: money(inflow * 12),
        debtCommitment: money(0),
        overdueAmount: money(0),
        upcomingAmount: money(0),
        lowestProjectedBalance: money(0),
        lowestProjectedBalanceDate: asOf,
      },
    } as ForecastResult;
  }

  const debt = {
    id: "debt-1",
    householdId: "h1",
    kind: "PERSONAL_LOAN",
    description: "Empréstimo",
    principalContracted: money(1200000),
    amountDisbursed: money(1200000),
    disbursementDate: calendarDate("2026-01-01"),
    amortisationSystem: "PRICE",
    interestRateMonthly: 2,
    installmentCount: 24,
    installmentAmount: money(63000),
    firstDueDate: calendarDate("2026-02-01"),
    status: "ACTIVE",
    visibility: "HOUSEHOLD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  } as unknown as Debt;

  it("takes the surplus from a month, not from the whole horizon", () => {
    const result = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [],
      cardStatements: [],
      reserves: [],
    });

    // R$ 5.000 in, R$ 4.000 out: R$ 1.000 a month, not R$ 12.000.
    expect(result.monthlySurplus).toEqual(money(100000));
  });

  it("counts only what is still owed", () => {
    const untouched = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [debt],
      cardStatements: [],
      reserves: [],
    });

    const halfPaid = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [debt],
      cardStatements: [],
      reserves: [],
      paidDebtInstallments: new Map([["debt-1", Array.from({ length: 12 }, (_u, i) => i + 1)]]),
    });

    expect(halfPaid.totalDebtAmount.amount).toBeLessThan(untouched.totalDebtAmount.amount);
    expect(halfPaid.monthsToDebtFree).not.toBeNull();
    expect(untouched.monthsToDebtFree).not.toBeNull();
    expect(halfPaid.monthsToDebtFree!).toBeLessThanOrEqual(untouched.monthsToDebtFree!);
  });

  it("measures the interest saved instead of assuming a fraction of it", () => {
    const result = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [debt],
      cardStatements: [],
      reserves: [],
    });

    const plan = result.avalanchePlan;
    // Paying extra every month cannot cost more interest than paying minimums.
    expect(plan.interestSavedVsMinimum.amount).toBeGreaterThanOrEqual(0);
    expect(plan.interestSavedVsMinimum.amount).not.toBe(
      Math.round(plan.totalInterestPaid.amount * 0.2),
    );
  });

  it("puts the starter reserve before the payoff milestone", () => {
    const result = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastWithMonths(500000, 400000),
      debts: [debt],
      cardStatements: [],
      reserves: [],
    });

    const categories = result.milestones.map((milestone) => milestone.category);
    expect(categories.indexOf("STARTER_RESERVE")).toBeLessThan(categories.indexOf("DEBT_FREE"));
    expect(result.starterReserve.isComplete).toBe(false);
    // Half of R$ 4.000 of monthly expenses, capped at R$ 1.000.
    expect(result.starterReserve.target).toEqual(money(100000));
  });
});

/**
 * O caso que motivou a reescrita.
 *
 * Antes disto, uma familia com deficit mensal recebia data de quitacao: a
 * sobra era grampeada em zero e a simulacao seguia pagando todas as parcelas
 * minimas com dinheiro que nao existia. Era o numero mais reconfortante da
 * tela, e o unico falso.
 */
describe("quando o mes nao fecha", () => {
  const asOf = calendarDate("2026-09-01");

  function forecastOf(inflow: number, outflow: number, debtPart: number): ForecastResult {
    const months = Array.from({ length: 6 }, (_unused, index) => ({
      month: `2026-${String(index + 4).padStart(2, "0")}` as never,
      expectedInflows: money(inflow),
      committedOutflows: money(outflow),
      debtCommitment: money(debtPart),
      net: money(inflow - outflow),
      openingCashBalance: money(0),
      endingCashBalance: money(0),
      freeEndingBalance: money(0),
      lowestBalance: money(0),
      lowestBalanceDate: asOf,
      isDeficit: outflow > inflow,
      deficitAmount: money(Math.max(0, outflow - inflow)),
      isPartial: false,
    }));

    return {
      asOf,
      horizon: dateRange(asOf, calendarDate("2027-09-01")),
      openingBalance: money(0),
      protectedReserve: money(0),
      days: [],
      months,
      events: [],
      summary: {
        projectedCashBalance: money(0),
        protectedReserve: money(0),
        freeProjectedBalance: money(0),
        committedOutflows: money(outflow * 6),
        expectedInflows: money(inflow * 6),
        debtCommitment: money(debtPart * 6),
        overdueAmount: money(0),
        upcomingAmount: money(0),
        lowestProjectedBalance: money(0),
        lowestProjectedBalanceDate: asOf,
      },
    } as unknown as ForecastResult;
  }

  // Renda 3.000, essenciais 1.800, parcelas exigem 2.000: faltam 800 por mes.
  const emprestimo = {
    id: "d1",
    householdId: "h1",
    kind: "PERSONAL_LOAN",
    description: "Emprestimo",
    principalContracted: money(1200000),
    amountDisbursed: money(1200000),
    disbursementDate: calendarDate("2026-01-01"),
    amortisationSystem: "SIMPLE",
    installmentCount: 24,
    installmentAmount: money(200000),
    firstDueDate: calendarDate("2026-10-01"),
    status: "ACTIVE",
    visibility: "HOUSEHOLD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  } as unknown as Debt;

  const deficitario = () =>
    calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastOf(300000, 380000, 200000),
      debts: [emprestimo],
      cardStatements: [],
      reserves: [],
    });

  it("classifica o plano como inviavel em vez de inventar uma data", () => {
    const result = deficitario();

    expect(result.feasibility.viability).toBe("NOT_VIABLE");
    expect(result.monthsToDebtFree).toBeNull();
    expect(result.debtFreeDate).toBeNull();
  });

  it("diz de quanto e o buraco, por mes", () => {
    const result = deficitario();

    // Capacidade: 3.000 menos (3.800 menos 2.000) = 1.200. Minimos: 2.000.
    expect(result.feasibility.monthlyCapacity).toEqual(money(120000));
    expect(result.feasibility.requiredMinimums).toEqual(money(200000));
    expect(result.feasibility.monthlyShortfall).toEqual(money(80000));
  });

  it("nao promete reserva de emergencia nem quitacao", () => {
    const result = deficitario();

    expect(result.monthsToEmergencyFund).toBeNull();
    expect(result.stabilityDate).toBeNull();
    const categorias = result.milestones.map((milestone) => milestone.category);
    expect(categorias).not.toContain("EMERGENCY_RESERVE");
    expect(categorias).not.toContain("DEBT_FREE");
  });

  it("mantem o deficit visivel em vez de grampear a sobra em zero", () => {
    expect(deficitario().monthlySurplus.amount).toBe(-80000);
  });

  it("um aporte extra nao conjura uma data para um plano que nao fecha", () => {
    const result = deficitario();

    expect(result.acceleratedPayoffEstimate.extraAporte50.monthsReduced).toBe(0);
    expect(result.acceleratedPayoffEstimate.extraAporte100.monthsReduced).toBe(0);
  });
});

/**
 * Faturas de cartao: uma divida por cartao, nao uma por mes.
 *
 * Antes, cada fatura entrava como divida separada com pagamento minimo igual
 * ao saldo inteiro. Dezesseis faturas apareciam "quitadas no mes 1",
 * duplicadas entre si porque o rotulo nao dizia de qual cartao eram.
 */
describe("divida de cartao", () => {
  const asOf = calendarDate("2026-09-01");

  function forecastOf(inflow: number, outflow: number, debtPart: number): ForecastResult {
    const months = Array.from({ length: 6 }, (_unused, index) => ({
      month: `2026-${String(index + 4).padStart(2, "0")}` as never,
      expectedInflows: money(inflow),
      committedOutflows: money(outflow),
      debtCommitment: money(debtPart),
      net: money(inflow - outflow),
      openingCashBalance: money(0),
      endingCashBalance: money(0),
      freeEndingBalance: money(0),
      lowestBalance: money(0),
      lowestBalanceDate: asOf,
      isDeficit: outflow > inflow,
      deficitAmount: money(Math.max(0, outflow - inflow)),
      isPartial: false,
    }));

    return {
      asOf,
      horizon: dateRange(asOf, calendarDate("2027-09-01")),
      openingBalance: money(0),
      protectedReserve: money(0),
      days: [],
      months,
      events: [],
      summary: {
        projectedCashBalance: money(0),
        protectedReserve: money(0),
        freeProjectedBalance: money(0),
        committedOutflows: money(outflow * 6),
        expectedInflows: money(inflow * 6),
        debtCommitment: money(debtPart * 6),
        overdueAmount: money(0),
        upcomingAmount: money(0),
        lowestProjectedBalance: money(0),
        lowestProjectedBalanceDate: asOf,
      },
    } as unknown as ForecastResult;
  }

  const statement = (id: string, cardId: string, month: string, due: string, amount: number) =>
    ({
      id,
      creditCardId: cardId,
      referenceMonth: month,
      dueDate: calendarDate(due),
      remainingAmount: money(amount),
    }) as never;

  it("agrupa as faturas do mesmo cartao numa divida so, com o nome do cartao", () => {
    const result = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      forecast: forecastOf(800000, 500000, 100000),
      debts: [],
      cardStatements: [
        statement("s1", "card-a", "2026-09", "2026-10-05", 100000),
        statement("s2", "card-a", "2026-10", "2026-11-05", 100000),
        statement("s3", "card-b", "2026-09", "2026-10-20", 50000),
      ],
      cardNames: new Map([
        ["card-a", "Nubank"],
        ["card-b", "Loja"],
      ]),
      reserves: [],
    });

    const nomes = result.avalanchePlan.orderOfPayoff.map((item) => item.name);

    expect(nomes).toHaveLength(2);
    expect(nomes).toContain("Cartão Nubank");
    expect(nomes).toContain("Cartão Loja");
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("nao quita o cartao inteiro no primeiro mes", () => {
    const result = calculateRecoveryTimeline({
      asOf,
      openingBalance: money(0),
      totalCash: money(0),
      protectedReserve: money(0),
      // Capacidade de R$ 400 por mes contra R$ 6.000 de fatura vencida.
      forecast: forecastOf(300000, 300000, 40000),
      debts: [],
      cardStatements: [statement("s1", "card-a", "2026-08", "2026-08-05", 600000)],
      cardNames: new Map([["card-a", "Nubank"]]),
      reserves: [],
    });

    const quitacao = result.avalanchePlan.orderOfPayoff[0];
    expect(quitacao?.payoffMonthIndex ?? 99).toBeGreaterThan(1);
  });
});
