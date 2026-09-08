import { describe, expect, it } from "vitest";
import type { Instant } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import {
  auditActionIcon,
  createFamilyAuditEvent,
  filterAuditEventsByActor,
  formatFamilyAuditEventText,
  sortAuditEventsDescending,
  type FamilyAuditEvent,
} from "./audit-log";

describe("audit-log", () => {
  it("cria e formata evento de criação de despesa", () => {
    const event = createFamilyAuditEvent({
      id: "ev1",
      householdId: "h1",
      actorId: "u1",
      actorName: "Maria",
      actionType: "EXPENSE_CREATED",
      entityName: "Supermercado Semanal",
      amount: money(34000), // R$ 340,00
      timestamp: "2026-09-08T10:00:00.000Z" as Instant,
    });

    expect(event.actorName).toBe("Maria");
    const text = formatFamilyAuditEventText(event);
    expect(text).toContain("Maria registrou a despesa \"Supermercado Semanal\"");
    expect(text).toContain("340,00");
    expect(auditActionIcon(event.actionType)).toBe("🧾");
  });

  it("formata evento de conta paga e dívida quitada", () => {
    const billPaid = createFamilyAuditEvent({
      id: "ev2",
      householdId: "h1",
      actorId: "u2",
      actorName: "João",
      actionType: "BILL_PAID",
      entityName: "Energia Elétrica",
      amount: money(18550),
    });
    expect(formatFamilyAuditEventText(billPaid)).toContain("João marcou a conta \"Energia Elétrica\"");
    expect(auditActionIcon(billPaid.actionType)).toBe("✅");

    const debtPaid = createFamilyAuditEvent({
      id: "ev3",
      householdId: "h1",
      actorId: "u2",
      actorName: "João",
      actionType: "DEBT_PAID",
      entityName: "Empréstimo Caixa",
      amount: money(50000),
    });
    expect(formatFamilyAuditEventText(debtPaid)).toContain("João registrou o pagamento da dívida");
    expect(auditActionIcon(debtPaid.actionType)).toBe("🏛️");

    const incomeCreated = createFamilyAuditEvent({
      id: "ev4",
      householdId: "h1",
      actorId: "u1",
      actorName: "Maria",
      actionType: "INCOME_CREATED",
      entityName: "Salário Empresa X",
      amount: money(450000),
    });
    expect(formatFamilyAuditEventText(incomeCreated)).toContain("Maria registrou uma entrada de receita");
    expect(auditActionIcon(incomeCreated.actionType)).toBe("💰");

    const expenseDeleted = createFamilyAuditEvent({
      id: "ev5",
      householdId: "h1",
      actorId: "u1",
      actorName: "Maria",
      actionType: "EXPENSE_DELETED",
      entityName: "Assinatura Antiga",
    });
    expect(formatFamilyAuditEventText(expenseDeleted)).toContain("Maria removeu a despesa");
    expect(auditActionIcon(expenseDeleted.actionType)).toBe("🗑️");

    const budgetAdjusted = createFamilyAuditEvent({
      id: "ev6",
      householdId: "h1",
      actorId: "u2",
      actorName: "João",
      actionType: "BUDGET_ADJUSTED",
      entityName: "Alimentação",
      amount: money(120000),
    });
    expect(formatFamilyAuditEventText(budgetAdjusted)).toContain("João ajustou o orçamento");
    expect(auditActionIcon(budgetAdjusted.actionType)).toBe("📊");

    const roleChanged = createFamilyAuditEvent({
      id: "ev7",
      householdId: "h1",
      actorId: "u1",
      actorName: "Maria",
      actionType: "MEMBER_ROLE_CHANGED",
      entityName: "Pedro",
      detail: "promovido a Operador",
    });
    expect(formatFamilyAuditEventText(roleChanged)).toContain("Maria alterou a permissão de Pedro");
    expect(formatFamilyAuditEventText(roleChanged)).toContain("promovido a Operador");
    expect(auditActionIcon(roleChanged.actionType)).toBe("🛡️");

    const invited = createFamilyAuditEvent({
      id: "ev8",
      householdId: "h1",
      actorId: "u1",
      actorName: "Maria",
      actionType: "MEMBER_INVITED",
      entityName: "lucas@example.com",
    });
    expect(formatFamilyAuditEventText(invited)).toContain("Maria convidou lucas@example.com");
    expect(auditActionIcon(invited.actionType)).toBe("✉️");
  });

  it("ordena eventos cronologicamente do mais novo para o mais antigo", () => {
    const e1 = createFamilyAuditEvent({
      id: "1",
      householdId: "h1",
      actorId: "u1",
      actorName: "A",
      actionType: "EXPENSE_CREATED",
      entityName: "Café",
      timestamp: "2026-09-01T10:00:00.000Z" as Instant,
    });
    const e2 = createFamilyAuditEvent({
      id: "2",
      householdId: "h1",
      actorId: "u1",
      actorName: "A",
      actionType: "EXPENSE_CREATED",
      entityName: "Almoço",
      timestamp: "2026-09-05T10:00:00.000Z" as Instant,
    });
    const e3 = createFamilyAuditEvent({
      id: "3",
      householdId: "h1",
      actorId: "u1",
      actorName: "A",
      actionType: "EXPENSE_CREATED",
      entityName: "Jantar",
      timestamp: "2026-09-03T10:00:00.000Z" as Instant,
    });

    const sorted = sortAuditEventsDescending([e1, e2, e3]);
    expect(sorted.map((s) => s.id)).toEqual(["2", "3", "1"]);
  });

  it("filtra eventos por autor", () => {
    const e1: FamilyAuditEvent = {
      id: "1",
      householdId: "h1",
      actorId: "maria",
      actorName: "Maria",
      actionType: "EXPENSE_CREATED",
      entityName: "Item 1",
      timestamp: "2026-09-01T00:00:00.000Z" as Instant,
    };
    const e2: FamilyAuditEvent = {
      id: "2",
      householdId: "h1",
      actorId: "joao",
      actorName: "João",
      actionType: "EXPENSE_CREATED",
      entityName: "Item 2",
      timestamp: "2026-09-02T00:00:00.000Z" as Instant,
    };

    const mariaEvents = filterAuditEventsByActor([e1, e2], "maria");
    expect(mariaEvents).toHaveLength(1);
    expect(mariaEvents[0]?.actorName).toBe("Maria");
  });
});
