import { describe, expect, it } from "vitest";
import { calendarDate } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import type { Debt } from "@/modules/debts/domain/debt";
import {
  MAX_REALISTIC_TERM_MONTHS,
  monthsToAmortise,
  planTermExtension,
  explainOutcome,
} from "./term-extension";

/**
 * O aplicativo passou a dizer "o caminho é alongar prazo" e parava aí. Estes
 * testes guardam a resposta que faltava — quanto prazo pedir — e as duas
 * verdades que precisam sair juntas: o mês respira, e a dívida encarece.
 */
const asOf = calendarDate("2026-09-20");

function debtOf(overrides: Record<string, unknown> = {}): Debt {
  return {
    id: "d1",
    householdId: "h1",
    kind: "PERSONAL_LOAN",
    description: "Empréstimo pessoal",
    principalContracted: money(1200000),
    amountDisbursed: money(1200000),
    disbursementDate: calendarDate("2026-01-01"),
    amortisationSystem: "PRICE",
    interestRateMonthly: 2,
    installmentCount: 24,
    installmentAmount: money(63500),
    firstDueDate: calendarDate("2026-10-01"),
    status: "ACTIVE",
    visibility: "HOUSEHOLD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
    ...overrides,
  } as unknown as Debt;
}

describe("monthsToAmortise", () => {
  it("resolve a Price para o prazo", () => {
    // R$ 10.000 a 2% ao mês, pagando R$ 500: 25,79 meses, ou seja 26.
    // Confere pelo caminho inverso: a parcela Price de 26 meses é R$ 497.
    expect(monthsToAmortise(money(1000000), 2, money(50000))).toBe(26);
  });

  it("sem juros, é divisão simples", () => {
    expect(monthsToAmortise(money(120000), 0, money(20000))).toBe(6);
  });

  it("devolve null quando a parcela não cobre nem os juros", () => {
    // 2% de R$ 10.000 é R$ 200. Pagando R$ 150, o saldo cresce para sempre.
    expect(monthsToAmortise(money(1000000), 2, money(15000))).toBeNull();
  });

  it("devolve null no limite exato, onde só os juros são pagos", () => {
    expect(monthsToAmortise(money(1000000), 2, money(20000))).toBeNull();
  });

  it("saldo zerado não precisa de prazo nenhum", () => {
    expect(monthsToAmortise(money(0), 2, money(50000))).toBe(0);
  });
});

describe("planTermExtension", () => {
  it("diz qual parcela pedir e por quantos meses", () => {
    const plan = planTermExtension({
      asOf,
      debt: debtOf(),
      monthlyShortfall: money(20000), // faltam R$ 200 por mês
    });

    expect(plan.outcome).toBe("FEASIBLE");
    // Parcela de R$ 635 menos o buraco de R$ 200: pedir R$ 435.
    expect(plan.affordableInstallment).toEqual(money(43500));
    expect(plan.requiredMonths).not.toBeNull();
    expect(plan.monthlyRelief).toEqual(money(20000));
  });

  it("mostra o que o alongamento custa a mais, junto com o alívio", () => {
    const plan = planTermExtension({
      asOf,
      debt: debtOf(),
      monthlyShortfall: money(20000),
    });

    // As duas verdades saem juntas: o mês respira e a dívida encarece.
    expect(plan.monthlyRelief.amount).toBeGreaterThan(0);
    expect(plan.extraCost!.amount).toBeGreaterThan(0);
    expect(plan.newTotalPaid!.amount).toBeGreaterThan(plan.currentTotalRemaining.amount);
  });

  it("não propõe nada quando o mês já fecha", () => {
    const plan = planTermExtension({ asOf, debt: debtOf(), monthlyShortfall: money(0) });

    expect(plan.outcome).toBe("ALREADY_FITS");
    expect(plan.extraCost).toEqual(money(0));
    expect(explainOutcome(plan)).toContain("Não há prazo a pedir");
  });

  it("avisa quando prazo nenhum resolve, porque a parcela não cobre os juros", () => {
    const plan = planTermExtension({
      asOf,
      // Saldo alto e juros de 8% ao mês: a parcela que sobra não cobre o juro.
      debt: debtOf({
        principalContracted: money(2000000),
        interestRateMonthly: 8,
        installmentAmount: money(70000),
      }),
      monthlyShortfall: money(55000),
    });

    expect(plan.outcome).toBe("NEVER_AMORTISES");
    expect(plan.requiredMonths).toBeNull();
    expect(explainOutcome(plan)).toContain("abatimento do saldo");
    expect(explainOutcome(plan)).toContain("portabilidade");
  });

  it("avisa quando o buraco é maior que a própria parcela", () => {
    const plan = planTermExtension({
      asOf,
      debt: debtOf(),
      // A parcela é R$ 635 e faltam R$ 900 por mês: zerar esta não basta.
      monthlyShortfall: money(90000),
    });

    expect(plan.outcome).toBe("NOTHING_TO_OFFER");
    expect(plan.requiredMonths).toBeNull();
    expect(explainOutcome(plan)).toContain("o mês continua sem fechar");
  });

  it("marca como irreal o prazo que nenhum credor aceitaria", () => {
    const plan = planTermExtension({
      asOf,
      debt: debtOf({
        principalContracted: money(5000000),
        interestRateMonthly: 1.5,
        installmentAmount: money(120000),
      }),
      // Sobra pouquíssimo acima do juro: o prazo estoura.
      monthlyShortfall: money(43000),
    });

    expect(plan.outcome).toBe("TERM_TOO_LONG");
    expect(plan.requiredMonths!).toBeGreaterThan(MAX_REALISTIC_TERM_MONTHS);
    expect(explainOutcome(plan)).toContain("Combine com outra coisa");
  });

  it("conta o saldo devedor real, não o valor contratado", () => {
    const intocada = planTermExtension({ asOf, debt: debtOf(), monthlyShortfall: money(20000) });
    const meioPaga = planTermExtension({
      asOf,
      debt: debtOf(),
      paidInstallmentNumbers: Array.from({ length: 12 }, (_unused, index) => index + 1),
      monthlyShortfall: money(20000),
    });

    expect(meioPaga.outstanding.amount).toBeLessThan(intocada.outstanding.amount);
    expect(meioPaga.requiredMonths!).toBeLessThan(intocada.requiredMonths!);
  });

  it("carrega a origem da taxa, para a tela poder dizer que é estimativa", () => {
    const semTaxa = planTermExtension({
      asOf,
      debt: debtOf({ interestRateMonthly: undefined }),
      monthlyShortfall: money(20000),
    });

    // Sem taxa no contrato, ela é deduzida da parcela — e isso precisa aparecer.
    expect(semTaxa.rateSource).toBe("IMPLIED");
  });
});
