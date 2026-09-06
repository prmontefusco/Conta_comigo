import { describe, expect, it } from "vitest";
import { calendarDate } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import type { Debt } from "@/modules/debts/domain/debt";
import { buildDebtCountdown, hasProgressToShow, progressPercent } from "./debt-countdown";

/**
 * Vinte e dois meses de parcela em dia é muito tempo para não ver nada
 * acontecer. Estes testes guardam a regra que decide se o número serve: ele
 * nunca comemora o que não aconteceu.
 */
const asOf = calendarDate("2026-09-20");

const debt = (overrides: Record<string, unknown> = {}): Debt =>
  ({
    id: "d1",
    householdId: "h1",
    kind: "PERSONAL_LOAN",
    description: "Empréstimo pessoal",
    principalContracted: money(1200000),
    amountDisbursed: money(1200000),
    disbursementDate: calendarDate("2025-10-01"),
    amortisationSystem: "SIMPLE",
    installmentCount: 24,
    installmentAmount: money(50000),
    firstDueDate: calendarDate("2025-11-01"),
    status: "ACTIVE",
    visibility: "HOUSEHOLD",
    createdAt: "2025-10-01T00:00:00.000Z",
    updatedAt: "2025-10-01T00:00:00.000Z",
    createdBy: "u1",
    ...overrides,
  }) as unknown as Debt;

const paidUpTo = (n: number) => Array.from({ length: n }, (_unused, index) => index + 1);

describe("buildDebtCountdown", () => {
  it("mostra o saldo de hoje e o progresso sobre o contratado", () => {
    const result = buildDebtCountdown({
      asOf,
      debts: [debt()],
      paidDebtInstallments: new Map([["d1", paidUpTo(10)]]),
    });

    // 24 parcelas de R$ 500 sobre R$ 12.000: 10 pagas deixam R$ 7.000.
    expect(result.current).toEqual(money(700000));
    expect(progressPercent(result)).toBe(42);
    expect(result.installmentsPaid).toBe(10);
    expect(result.installmentsLeft).toBe(14);
  });

  it("compara com o saldo de três meses atrás", () => {
    const result = buildDebtCountdown({
      asOf,
      debts: [debt()],
      paidDebtInstallments: new Map([["d1", paidUpTo(11)]]),
    });

    expect(result.before).not.toBeNull();
    expect(result.paidDown).not.toBeNull();
    expect(result.paidDown!.amount).toBeGreaterThan(0);
    expect(hasProgressToShow(result)).toBe(true);
  });

  it("não inventa progresso quando não houve pagamento no período", () => {
    // Todas as parcelas pagas venceram antes do corte: nada se moveu na janela.
    const result = buildDebtCountdown({
      asOf,
      debts: [debt()],
      paidDebtInstallments: new Map([["d1", paidUpTo(3)]]),
      lookbackMonths: 1,
    });

    expect(result.before).toBeNull();
    expect(result.paidDown).toBeNull();
    expect(hasProgressToShow(result)).toBe(false);
  });

  it("aponta a dívida mais perto de acabar, para dar um alvo próximo", () => {
    const result = buildDebtCountdown({
      asOf,
      debts: [debt(), debt({ id: "d2", description: "Carnê da loja", installmentCount: 6 })],
      paidDebtInstallments: new Map([
        ["d1", paidUpTo(10)],
        ["d2", paidUpTo(4)],
      ]),
    });

    expect(result.nextToClear?.description).toBe("Carnê da loja");
    expect(result.nextToClear?.installmentsLeft).toBe(2);
  });

  it("ignora dívida quitada", () => {
    const result = buildDebtCountdown({
      asOf,
      debts: [debt({ status: "SETTLED" })],
      paidDebtInstallments: new Map(),
    });

    expect(result.current).toEqual(money(0));
    expect(result.nextToClear).toBeNull();
  });

  it("sem dívida nenhuma, não há progresso a exibir", () => {
    const result = buildDebtCountdown({
      asOf,
      debts: [],
      paidDebtInstallments: new Map(),
    });

    expect(result.current).toEqual(money(0));
    expect(result.progress).toBe(0);
    expect(hasProgressToShow(result)).toBe(false);
  });
});
