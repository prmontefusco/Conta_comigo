import type { Instant } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import type { Money } from "@/core/money/money";
import type { HouseholdId, UserId } from "@/modules/shared/domain/common";

/**
 * Registro e trilha de auditoria colaborativa familiar.
 *
 * Transparência para a casa: elimina atritos familiares sobre quem
 * lançou, quitou, alterou ou removeu despesas e contas.
 */

export type FamilyAuditActionType =
  | "EXPENSE_CREATED"
  | "EXPENSE_DELETED"
  | "INCOME_CREATED"
  | "BILL_PAID"
  | "DEBT_PAID"
  | "BUDGET_ADJUSTED"
  | "MEMBER_ROLE_CHANGED"
  | "MEMBER_INVITED";

export interface FamilyAuditEvent {
  readonly id: string;
  readonly householdId: HouseholdId;
  readonly actorId: UserId;
  readonly actorName: string;
  readonly actionType: FamilyAuditActionType;
  readonly entityName: string;
  readonly amount?: Money;
  readonly detail?: string;
  readonly timestamp: Instant;
}

/**
 * Cria um evento de auditoria padronizado.
 */
export function createFamilyAuditEvent(input: {
  readonly id: string;
  readonly householdId: HouseholdId;
  readonly actorId: UserId;
  readonly actorName: string;
  readonly actionType: FamilyAuditActionType;
  readonly entityName: string;
  readonly amount?: Money;
  readonly detail?: string;
  readonly timestamp?: Instant;
}): FamilyAuditEvent {
  return {
    id: input.id,
    householdId: input.householdId,
    actorId: input.actorId,
    actorName: input.actorName.trim() || "Membro da casa",
    actionType: input.actionType,
    entityName: input.entityName.trim(),
    amount: input.amount,
    detail: input.detail?.trim(),
    timestamp: input.timestamp ?? (new Date().toISOString() as Instant),
  };
}

/**
 * Formata o texto descritivo e amigável da ação em português.
 */
export function formatFamilyAuditEventText(event: FamilyAuditEvent): string {
  const formattedMoney = event.amount ? ` de ${formatMoney(event.amount)}` : "";

  switch (event.actionType) {
    case "EXPENSE_CREATED":
      return `${event.actorName} registrou a despesa "${event.entityName}"${formattedMoney}.`;
    case "EXPENSE_DELETED":
      return `${event.actorName} removeu a despesa "${event.entityName}"${formattedMoney}.`;
    case "INCOME_CREATED":
      return `${event.actorName} registrou uma entrada de receita "${event.entityName}"${formattedMoney}.`;
    case "BILL_PAID":
      return `${event.actorName} marcou a conta "${event.entityName}"${formattedMoney} como paga.`;
    case "DEBT_PAID":
      return `${event.actorName} registrou o pagamento da dívida "${event.entityName}"${formattedMoney}.`;
    case "BUDGET_ADJUSTED":
      return `${event.actorName} ajustou o orçamento da categoria "${event.entityName}"${formattedMoney}.`;
    case "MEMBER_ROLE_CHANGED":
      return `${event.actorName} alterou a permissão de ${event.entityName}${event.detail ? ` (${event.detail})` : ""}.`;
    case "MEMBER_INVITED":
      return `${event.actorName} convidou ${event.entityName} para o grupo da família.`;
    default:
      return `${event.actorName} realizou uma alteração em "${event.entityName}".`;
  }
}

/**
 * Retorna o ícone temático correspondente à ação.
 */
export function auditActionIcon(actionType: FamilyAuditActionType): string {
  switch (actionType) {
    case "EXPENSE_CREATED":
      return "🧾";
    case "EXPENSE_DELETED":
      return "🗑️";
    case "INCOME_CREATED":
      return "💰";
    case "BILL_PAID":
      return "✅";
    case "DEBT_PAID":
      return "🏛️";
    case "BUDGET_ADJUSTED":
      return "📊";
    case "MEMBER_ROLE_CHANGED":
      return "🛡️";
    case "MEMBER_INVITED":
      return "✉️";
  }
}

/**
 * Ordena eventos do mais recente para o mais antigo.
 */
export function sortAuditEventsDescending(
  events: readonly FamilyAuditEvent[],
): readonly FamilyAuditEvent[] {
  return [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/**
 * Filtra eventos por membro responsável.
 */
export function filterAuditEventsByActor(
  events: readonly FamilyAuditEvent[],
  actorId: UserId,
): readonly FamilyAuditEvent[] {
  return events.filter((e) => e.actorId === actorId);
}
