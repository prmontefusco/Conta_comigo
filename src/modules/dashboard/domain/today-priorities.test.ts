import { describe, expect, it } from "vitest";
import type { Alert, AlertKind, AlertSeverity } from "@/modules/alerts/domain/alerts";
import { buildTodayPriorities, prioritySubjectLabel } from "./today-priorities";

const alert = (kind: AlertKind, severity: AlertSeverity): Alert => ({
  id: `${kind}-${severity}`,
  kind,
  severity,
  message: kind,
});

describe("buildTodayPriorities", () => {
  it("põe o urgente antes do que apenas merece atenção", () => {
    const priorities = buildTodayPriorities({
      alerts: [alert("DUE_SOON", "ATTENTION"), alert("OVERDUE_BILLS", "URGENT")],
    });

    expect(priorities.items[0]?.alert.kind).toBe("OVERDUE_BILLS");
    expect(priorities.urgentCount).toBe(1);
  });

  it("dentro da mesma gravidade, segue a ordem de assunto do produto", () => {
    // Conta vencida, depois o mês que não fecha, depois a fatura próxima.
    const priorities = buildTodayPriorities({
      alerts: [
        alert("STATEMENT_DUE", "ATTENTION"),
        alert("PROJECTED_DEFICIT", "ATTENTION"),
        alert("DUE_SOON", "ATTENTION"),
      ],
    });

    expect(priorities.items.map((item) => item.alert.kind)).toEqual([
      "PROJECTED_DEFICIT",
      "STATEMENT_DUE",
      "DUE_SOON",
    ]);
  });

  it("mantém um serviço essencial em risco no topo, mesmo sendo assunto posterior", () => {
    // Gravidade vem antes de assunto de propósito: um corte de energia não
    // pode ficar abaixo de uma fatura que vence semana que vem.
    const priorities = buildTodayPriorities({
      alerts: [
        alert("DUE_SOON", "ATTENTION"),
        alert("ESSENTIAL_SERVICE_AT_RISK", "URGENT"),
        alert("BUDGET_OVERSPENT", "ATTENTION"),
      ],
    });

    expect(priorities.items[0]?.alert.kind).toBe("ESSENTIAL_SERVICE_AT_RISK");
  });

  it("deixa avisos informativos fora do topo da tela", () => {
    // "Faltam R$ 300 para a reserva" é verdade há meses. Continua na caixa de
    // avisos; não é o que alguém precisa ler antes de tudo.
    const priorities = buildTodayPriorities({
      alerts: [alert("RESERVE_BELOW_TARGET", "INFO"), alert("INSTALLMENTS_ENDING", "INFO")],
    });

    expect(priorities.items).toHaveLength(0);
    expect(priorities.total).toBe(0);
  });

  it("corta no limite e diz quantos ficaram de fora", () => {
    const priorities = buildTodayPriorities({
      alerts: [
        alert("OVERDUE_BILLS", "URGENT"),
        alert("NEGATIVE_BALANCE_AHEAD", "URGENT"),
        alert("PROJECTED_DEFICIT", "ATTENTION"),
        alert("STATEMENT_DUE", "ATTENTION"),
        alert("DUE_SOON", "ATTENTION"),
      ],
      limit: 3,
    });

    expect(priorities.items).toHaveLength(3);
    expect(priorities.hidden).toBe(2);
    expect(priorities.total).toBe(5);
  });

  it("não altera a lista recebida", () => {
    const alerts = [alert("DUE_SOON", "ATTENTION"), alert("OVERDUE_BILLS", "URGENT")];
    buildTodayPriorities({ alerts });

    expect(alerts.map((item) => item.kind)).toEqual(["DUE_SOON", "OVERDUE_BILLS"]);
  });

  it("nomeia todo tipo de aviso, sem rótulo vazio", () => {
    const kinds: AlertKind[] = [
      "OVERDUE_BILLS",
      "DUE_SOON",
      "STATEMENT_DUE",
      "PROJECTED_DEFICIT",
      "NEGATIVE_BALANCE_AHEAD",
      "CARD_LIMIT_HIGH",
      "RESERVE_BELOW_TARGET",
      "INSTALLMENTS_ENDING",
      "LOW_UNCOMMITTED_CASH",
      "COLLATERAL_AT_RISK",
      "ESSENTIAL_SERVICE_AT_RISK",
      "BUDGET_OVERSPENT",
    ];

    for (const kind of kinds) {
      expect(prioritySubjectLabel(kind).length).toBeGreaterThan(0);
    }
  });
});
