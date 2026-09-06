import { describe, expect, it } from "vitest";
import { calendarDate } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import type { Debt } from "@/modules/debts/domain/debt";
import { buildTriage } from "./triage";
import type { Obligation } from "./obligation";

/**
 * A pergunta do dia 20 com R$ 300 na conta.
 *
 * A ordem aqui não é por valor nem por juros: é por consequência. Uma conta de
 * luz de R$ 90 vem antes de uma cobrança de R$ 900 sem garantia, porque uma
 * corta a energia da casa e a outra liga cobrando.
 */
const hoje = calendarDate("2026-09-20");

const conta = (id: string, amount: number, dueDate: string, categoryId?: string): Obligation =>
  ({
    id,
    householdId: "h1",
    direction: "OUTFLOW",
    origin: "MANUAL",
    description: id,
    amount: money(amount),
    dueDate: calendarDate(dueDate),
    competenceDate: calendarDate(dueDate),
    ...(categoryId ? { categoryId } : {}),
    status: "SCHEDULED",
    settledAmount: money(0),
    settlementTransactionIds: [],
    visibility: "HOUSEHOLD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  }) as unknown as Obligation;

const financiamento = {
  id: "fin",
  householdId: "h1",
  kind: "VEHICLE_FINANCING",
  description: "Financiamento do carro",
  principalContracted: money(4200000),
  amountDisbursed: money(4200000),
  disbursementDate: calendarDate("2025-01-01"),
  amortisationSystem: "SIMPLE",
  installmentCount: 48,
  installmentAmount: money(120000),
  firstDueDate: calendarDate("2025-02-01"),
  status: "ACTIVE",
  visibility: "HOUSEHOLD",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  createdBy: "u1",
} as unknown as Debt;

describe("buildTriage", () => {
  it("põe o serviço essencial antes de tudo, mesmo sendo o menor valor", () => {
    const result = buildTriage({
      asOf: hoje,
      availableCash: money(30000),
      obligations: [
        conta("Cobrança de loja", 90000, "2026-08-20"),
        conta("Energia elétrica", 9000, "2026-08-20", "energia"),
      ],
      debts: [],
      cardStatements: [],
    });

    expect(result.items[0]?.description).toBe("Energia elétrica");
    expect(result.items[0]?.tier).toBe("ESSENTIAL_SERVICE");
    expect(result.items[0]?.consequence).toContain("corte de energia");
  });

  it("o bem em garantia vem logo depois do essencial e antes do resto", () => {
    const result = buildTriage({
      asOf: hoje,
      availableCash: money(0),
      obligations: [conta("Cartão da loja", 50000, "2026-08-20")],
      debts: [financiamento],
      cardStatements: [],
    });

    const tiers = result.items.map((item) => item.tier);
    expect(tiers.indexOf("ASSET_AT_RISK")).toBeLessThan(tiers.indexOf("ACCRUING"));
    expect(result.items.find((item) => item.tier === "ASSET_AT_RISK")?.consequence).toContain(
      "busca e apreensão",
    );
  });

  it("marca o que cabe no dinheiro de hoje, seguindo a ordem", () => {
    const result = buildTriage({
      asOf: hoje,
      availableCash: money(20000), // R$ 200
      obligations: [
        conta("Água", 14200, "2026-08-20", "agua"),
        conta("Energia elétrica", 9000, "2026-08-20", "energia"),
        conta("Cobrança de loja", 90000, "2026-08-20"),
      ],
      debts: [],
      cardStatements: [],
    });

    // R$ 200 cobrem luz (90) e água (142)? Não: 90 + 142 = 232. Só a luz cabe,
    // e depois dela sobram R$ 110 — que não cobrem a água.
    const luz = result.items.find((item) => item.description === "Energia elétrica");
    const agua = result.items.find((item) => item.description === "Água");
    const loja = result.items.find((item) => item.description === "Cobrança de loja");

    expect(luz?.coveredByAvailableCash).toBe(true);
    expect(agua?.coveredByAvailableCash).toBe(false);
    expect(loja?.coveredByAvailableCash).toBe(false);
    expect(result.payableNow).toEqual(money(9000));
    expect(result.unpayable).toEqual(money(104200));
  });

  it("ignora o que não venceu e ainda está longe", () => {
    const result = buildTriage({
      asOf: hoje,
      availableCash: money(100000),
      obligations: [conta("Internet", 18000, "2026-11-12")],
      debts: [],
      cardStatements: [],
    });

    expect(result.items).toHaveLength(0);
  });

  it("inclui o que vence nos próximos sete dias, como oportunidade de não atrasar", () => {
    const result = buildTriage({
      asOf: hoje,
      availableCash: money(100000),
      obligations: [conta("Internet", 18000, "2026-09-24")],
      debts: [],
      cardStatements: [],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.tier).toBe("UPCOMING");
  });

  it("nomeia o cartão da fatura atrasada em vez de dizer só 'fatura'", () => {
    const result = buildTriage({
      asOf: hoje,
      availableCash: money(0),
      obligations: [],
      debts: [],
      cardStatements: [
        {
          id: "s1",
          creditCardId: "card-a",
          referenceMonth: "2026-08",
          dueDate: calendarDate("2026-09-05"),
          remainingAmount: money(450000),
        } as never,
      ],
      cardNames: new Map([["card-a", "Nubank"]]),
    });

    expect(result.items[0]?.description).toBe("Fatura atrasada do cartão Nubank");
    expect(result.items[0]?.tier).toBe("ACCRUING");
    expect(result.items[0]?.consequence).toContain("rotativo");
  });

  it("não repete a palavra cartão quando o nome do cartão já a contém", () => {
    const result = buildTriage({
      asOf: hoje,
      availableCash: money(0),
      obligations: [],
      debts: [],
      cardStatements: [
        {
          id: "s1",
          creditCardId: "card-a",
          referenceMonth: "2026-08",
          dueDate: calendarDate("2026-09-05"),
          remainingAmount: money(48200),
        } as never,
      ],
      cardNames: new Map([["card-a", "Cartão da conta digital"]]),
    });

    expect(result.items[0]?.description).toBe("Fatura atrasada do Cartão da conta digital");
  });

  it("serviço essencial que ainda não venceu não passa na frente do que já venceu", () => {
    const result = buildTriage({
      asOf: hoje,
      availableCash: money(0),
      obligations: [
        conta("Material escolar", 23000, "2026-09-24", "educacao"),
        conta("Carnê da loja", 18900, "2026-09-08"),
      ],
      debts: [],
      cardStatements: [],
    });

    expect(result.items[0]?.description).toBe("Carnê da loja");
    const escolar = result.items.find((item) => item.description === "Material escolar");
    expect(escolar?.tier).toBe("UPCOMING");
    expect(escolar?.consequence).toContain("Se vencer");
  });
});
