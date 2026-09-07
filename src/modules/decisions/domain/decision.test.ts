import { describe, expect, it } from "vitest";
import { calendarDate, instant } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import {
  DECISION_KINDS,
  DECISION_KIND_EXAMPLES,
  DECISION_KIND_LABELS,
  filterByKind,
  pendingDecisions,
  sortDecisions,
  summariseDecisions,
  type Decision,
} from "./decision";

function decision(overrides: Partial<Decision> & { id: string }): Decision {
  return {
    householdId: "casa",
    kind: "OTHER_STEP",
    description: "Decisão",
    decidedOn: calendarDate("2026-09-01"),
    status: "PLANNED",
    visibility: "HOUSEHOLD",
    createdAt: instant("2026-09-01T10:00:00.000Z"),
    updatedAt: instant("2026-09-01T10:00:00.000Z"),
    createdBy: "uid",
    ...overrides,
  };
}

describe("sortDecisions", () => {
  it("mostra a decisão mais recente primeiro", () => {
    const sorted = sortDecisions([
      decision({ id: "antiga", decidedOn: calendarDate("2026-07-10") }),
      decision({ id: "recente", decidedOn: calendarDate("2026-09-05") }),
      decision({ id: "meio", decidedOn: calendarDate("2026-08-20") }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["recente", "meio", "antiga"]);
  });

  it("desempata pela hora do registro, para a ordem não mudar a cada leitura", () => {
    const sorted = sortDecisions([
      decision({
        id: "primeira",
        createdAt: instant("2026-09-01T10:00:00.000Z"),
      }),
      decision({
        id: "segunda",
        createdAt: instant("2026-09-01T22:00:00.000Z"),
      }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["segunda", "primeira"]);
  });

  it("não altera a lista recebida", () => {
    const decisions = [
      decision({ id: "a", decidedOn: calendarDate("2026-07-10") }),
      decision({ id: "b", decidedOn: calendarDate("2026-09-05") }),
    ];
    sortDecisions(decisions);

    expect(decisions.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("pendingDecisions", () => {
  it("deixa de fora o que já foi feito", () => {
    const pending = pendingDecisions([
      decision({ id: "feita", status: "DONE" }),
      decision({ id: "combinada", status: "PLANNED" }),
    ]);

    expect(pending.map((item) => item.id)).toEqual(["combinada"]);
  });

  it("põe o compromisso mais antigo primeiro, que é o que está esperando há mais tempo", () => {
    const pending = pendingDecisions([
      decision({ id: "nova", decidedOn: calendarDate("2026-09-05") }),
      decision({ id: "antiga", decidedOn: calendarDate("2026-06-01") }),
    ]);

    expect(pending.map((item) => item.id)).toEqual(["antiga", "nova"]);
  });
});

describe("summariseDecisions", () => {
  it("conta o que foi feito e o que está combinado", () => {
    const summary = summariseDecisions([
      decision({ id: "a", status: "DONE" }),
      decision({ id: "b", status: "DONE" }),
      decision({ id: "c", status: "PLANNED" }),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.done).toBe(2);
    expect(summary.planned).toBe(1);
  });

  it("soma apenas as decisões que têm valor", () => {
    const summary = summariseDecisions([
      decision({ id: "a", status: "DONE", amount: money(18000) }),
      // Sem valor: adiar uma compra não é um número, é uma escolha.
      decision({ id: "b", status: "DONE" }),
      decision({ id: "c", status: "PLANNED", amount: money(5000) }),
    ]);

    expect(summary.amountDone).toEqual(money(18000));
    expect(summary.amountPlanned).toEqual(money(5000));
  });

  it("responde zero para uma casa que ainda não registrou nada", () => {
    const summary = summariseDecisions([]);

    expect(summary.total).toBe(0);
    expect(summary.amountDone).toEqual(money(0));
    expect(summary.amountPlanned).toEqual(money(0));
  });
});

describe("filterByKind", () => {
  it("devolve tudo quando não há filtro", () => {
    const decisions = [decision({ id: "a" }), decision({ id: "b", kind: "PAY_BILL" })];

    expect(filterByKind(decisions, null)).toHaveLength(2);
  });

  it("mantém só o tipo pedido", () => {
    const decisions = [
      decision({ id: "a", kind: "RENEGOTIATE_DEBT" }),
      decision({ id: "b", kind: "PAY_BILL" }),
    ];

    expect(filterByKind(decisions, "PAY_BILL").map((item) => item.id)).toEqual(["b"]);
  });
});

describe("vocabulário", () => {
  it("todo tipo tem rótulo e exemplo, para o formulário nunca ficar mudo", () => {
    for (const kind of DECISION_KINDS) {
      expect(DECISION_KIND_LABELS[kind].length).toBeGreaterThan(0);
      expect(DECISION_KIND_EXAMPLES[kind].length).toBeGreaterThan(0);
    }
  });
});
