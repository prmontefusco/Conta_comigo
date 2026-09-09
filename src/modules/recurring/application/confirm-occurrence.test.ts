import { beforeEach, describe, expect, it, vi } from "vitest";
import { calendarDate, dateRange } from "@/core/date/calendar-date";
import { fromDecimal } from "@/core/money/money";
import { collectEvents } from "@/modules/forecast/domain/forecast";
import { occurrencesBetween } from "@/modules/recurring/domain/recurring-rule";
import { aRecurringRule, anObligation, brl, on } from "@/modules/shared/testing/builders";

/**
 * Confirmar o salário não pode fazê-lo ser contado duas vezes.
 *
 * A ocorrência confirmada vira obrigação; a projeção precisa parar de gerar a
 * ocorrência da regra. A ligação entre as duas é a `occurrenceKey`, e ela é o
 * lugar mais fácil de errar sem que nada quebre: a chave usa a data
 * **nominal**, enquanto `dueDate` já passou pela política de fim de semana.
 */

interface BatchOperation {
  readonly path: string;
  readonly data: Record<string, unknown>;
}

const operations: BatchOperation[] = [];
let commits = 0;

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, path: string) => ({ id: path.split("/").at(-1) ?? "", __path: path }),
  writeBatch: () => ({
    set: (ref: { __path: string }, data: Record<string, unknown>) => {
      operations.push({ path: ref.__path, data });
    },
    commit: async () => {
      commits += 1;
    },
  }),
}));

const { cancelOccurrence, confirmOccurrence } = await import("./confirm-occurrence");

const db = {} as never;
const HOJE = calendarDate("2026-09-09");

/** Setembro de 2026: o dia 5 cai num sábado. */
const salario = aRecurringRule({
  id: "rule-salario",
  direction: "INFLOW",
  description: "Salário",
  amount: brl(2000),
  frequency: "MONTHLY",
  dayOfMonth: 5,
  startDate: on("2026-01-05"),
  weekendPolicy: "NEXT_BUSINESS_DAY",
});

function setembro() {
  const ocorrencias = occurrencesBetween(salario, on("2026-09-01"), on("2026-09-30"));
  const primeira = ocorrencias[0];
  if (!primeira) throw new Error("A regra devia produzir uma ocorrência em setembro.");
  return primeira;
}

beforeEach(() => {
  operations.length = 0;
  commits = 0;
});

/**
 * Horizonte a partir do início do mês, não de `asOf`.
 *
 * `occurrencesBetween` só emite ocorrências a partir de `from`, e a projeção
 * usa `from = asOf`. Com o horizonte começando hoje (dia 9), a ocorrência do
 * dia 5 nem seria gerada, e o teste de deduplicação passaria sem testar nada.
 * A listagem de "a receber" precisa da mesma janela retroativa, pelo mesmo
 * motivo: é depois do dia 5 que alguém confirma o salário do dia 5.
 */
const forecastInput = (obligations: ReturnType<typeof anObligation>[]) => ({
  asOf: HOJE,
  horizon: dateRange(on("2026-09-01"), on("2026-10-31")),
  openingBalance: brl(0),
  protectedReserve: brl(0),
  obligations,
  recurringRules: [salario],
  cardStatements: [],
  debts: [],
});

describe("a chave da ocorrência", () => {
  it("usa a data nominal, não a data ajustada pelo fim de semana", () => {
    const ocorrencia = setembro();

    // 5 de setembro de 2026 é sábado: o vencimento anda para segunda...
    expect(ocorrencia.dueDate).toBe("2026-09-07");
    // ...mas a chave e a competência continuam no dia nominal.
    expect(ocorrencia.competenceDate).toBe("2026-09-05");
    expect(ocorrencia.occurrenceKey).toBe("rule-salario:2026-09-05");
  });
});

describe("confirmOccurrence", () => {
  const confirmar = (amount = fromDecimal(1850)) =>
    confirmOccurrence({
      db,
      householdId: "household-a",
      uid: "user-1",
      rule: salario,
      occurrence: setembro(),
      amount,
      accountId: "account-1",
      settledOn: HOJE,
      asOf: HOJE,
    });

  it("grava obrigação e transação num lote só", async () => {
    const result = await confirmar();

    expect(result.ok).toBe(true);
    expect(commits).toBe(1);
    expect(operations).toHaveLength(2);
  });

  it("o id do documento é a chave da ocorrência", async () => {
    // É o que torna uma segunda confirmação uma escrita sobre documento
    // existente, recusada pelas regras.
    const result = await confirmar();

    expect(result.ok && result.value.obligationId).toBe("rule-salario:2026-09-05");
  });

  it("nasce quitada, pelo valor que realmente entrou", async () => {
    await confirmar(fromDecimal(1850));

    const obligation = operations[0]?.data;
    expect(obligation?.status).toBe("SETTLED");
    expect(obligation?.amount).toEqual(fromDecimal(1850));
    expect(obligation?.settledAmount).toEqual(fromDecimal(1850));
    expect(obligation?.settledAt).toBeDefined();
  });

  it("a transação aponta para a obrigação e herda a competência da ocorrência", async () => {
    await confirmar();

    const transaction = operations[1]?.data;
    expect(transaction?.kind).toBe("INCOME");
    expect(transaction?.settlesObligationId).toBe("rule-salario:2026-09-05");
    expect(transaction?.competenceDate).toBe("2026-09-05");
    expect(transaction?.transactionDate).toBe(HOJE);
  });

  it("recusa valor zero e data no futuro, sem escrever nada", async () => {
    const semValor = await confirmar(fromDecimal(0));
    expect(semValor.ok).toBe(false);

    const noFuturo = await confirmOccurrence({
      db,
      householdId: "household-a",
      uid: "user-1",
      rule: salario,
      occurrence: setembro(),
      amount: fromDecimal(1850),
      accountId: "account-1",
      settledOn: on("2026-09-30"),
      asOf: HOJE,
    });
    expect(noFuturo.ok).toBe(false);

    expect(commits).toBe(0);
  });
});

describe("a projeção depois da confirmação", () => {
  it("para de contar a ocorrência da regra", async () => {
    await confirmOccurrence({
      db,
      householdId: "household-a",
      uid: "user-1",
      rule: salario,
      occurrence: setembro(),
      amount: fromDecimal(1850),
      accountId: "account-1",
      settledOn: HOJE,
      asOf: HOJE,
    });

    const gravada = operations[0]?.data as Record<string, unknown>;
    const materializada = anObligation({
      id: "rule-salario:2026-09-05",
      direction: "INFLOW",
      status: "SETTLED",
      amount: fromDecimal(1850),
      settledAmount: fromDecimal(1850),
      dueDate: on("2026-09-07"),
      competenceDate: on("2026-09-05"),
      source: (gravada.source as { occurrenceKey: string }) ?? undefined,
    });

    const eventos = collectEvents(forecastInput([materializada]) as never);
    const setembroEvents = eventos.filter((event) => event.competenceMonth === "2026-09");

    // Nem a ocorrência da regra (já confirmada), nem a obrigação (já quitada).
    expect(setembroEvents).toEqual([]);
  });

  it("sem a confirmação, a ocorrência continua na projeção", () => {
    const eventos = collectEvents(forecastInput([]) as never);
    const setembroEvents = eventos.filter((event) => event.competenceMonth === "2026-09");

    expect(setembroEvents).toHaveLength(1);
    expect(setembroEvents[0]?.amount).toEqual(brl(2000));
  });

  it("não sobra resto de R$ 150 quando entrou menos que o previsto", () => {
    // O erro que a materialização "cria previsto, liquida real" produziria.
    const materializada = anObligation({
      id: "rule-salario:2026-09-05",
      direction: "INFLOW",
      status: "SETTLED",
      amount: fromDecimal(1850),
      settledAmount: fromDecimal(1850),
      competenceDate: on("2026-09-05"),
      source: { occurrenceKey: "rule-salario:2026-09-05" },
    });

    const eventos = collectEvents(forecastInput([materializada]) as never);

    expect(eventos.filter((event) => event.direction === "INFLOW")).toHaveLength(1);
    // A única entrada restante é a de outubro, ainda por vir.
    expect(eventos[0]?.competenceMonth).toBe("2026-10");
  });
});

describe("cancelOccurrence", () => {
  it("materializa como cancelada e a projeção para de contar", async () => {
    const result = await cancelOccurrence({
      db,
      householdId: "household-a",
      uid: "user-1",
      rule: salario,
      occurrence: setembro(),
    });

    expect(result.ok).toBe(true);
    expect(operations[0]?.data.status).toBe("CANCELED");

    const cancelada = anObligation({
      id: "rule-salario:2026-09-05",
      direction: "INFLOW",
      status: "CANCELED",
      competenceDate: on("2026-09-05"),
      source: { occurrenceKey: "rule-salario:2026-09-05" },
    });

    const eventos = collectEvents(forecastInput([cancelada]) as never);
    expect(eventos.filter((event) => event.competenceMonth === "2026-09")).toEqual([]);
  });
});
