import type { CalendarDate, Instant } from "@/core/date/calendar-date";

/**
 * Vocabulary shared by every financial module.
 *
 * These types exist so that the difference between, say, an obligation and a
 * transaction is visible in the type system rather than left to convention.
 */

export type HouseholdId = string;
export type MemberId = string;
export type UserId = string;
export type AccountId = string;
export type CategoryId = string;
export type TransactionId = string;
export type ObligationId = string;
export type CreditCardId = string;
export type CardPurchaseId = string;
export type CardStatementId = string;
export type DebtId = string;
export type RecurringRuleId = string;
export type ReserveId = string;
export type GoalId = string;
export type BudgetId = string;
export type VehicleId = string;

/**
 * Who a record belongs to inside a household.
 *
 * A gym membership is PERSONAL: it belongs to one member's own budget. The
 * electricity bill is HOUSEHOLD: it is everyone's. Both live in the same
 * household and both are visible to members - visibility drives grouping and
 * reporting, not access control. Access control is the household boundary
 * itself (docs/SECURITY.md).
 */
export type Visibility = "PERSONAL" | "HOUSEHOLD";

/**
 * How predictable an expense is.
 *
 * Never inferred silently: the person decides, because only they know whether
 * a repeated purchase is a commitment or a habit they intend to change.
 */
export type ExpenseNature = "FIXED" | "VARIABLE" | "OCCASIONAL";

/**
 * How certain a future amount is.
 *
 * A signed rent contract is CONFIRMED. Next month's variable commission is
 * ESTIMATED. The forecast reports both, but never presents an estimate as if
 * it were money already promised.
 */
export type Confidence = "CONFIRMED" | "ESTIMATED";

/** Direction of money relative to the household. */
export type FlowDirection = "INFLOW" | "OUTFLOW";

export interface AuditFields {
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly createdBy: UserId;
}

/** Every stored financial record is scoped to exactly one household. */
export interface HouseholdScoped {
  readonly id: string;
  readonly householdId: HouseholdId;
}

/**
 * The set of dates a financial record can carry.
 *
 * Deliberately never collapsed into a single `date` field:
 * - `competenceDate` answers "which month does this belong to?" (spending view)
 * - `dueDate` answers "when is it owed?"
 * - `transactionDate` answers "when did cash actually move?" (cash-flow view)
 */
export interface FinancialDates {
  readonly competenceDate: CalendarDate;
  readonly dueDate?: CalendarDate;
  readonly transactionDate?: CalendarDate;
}

/**
 * `DEPENDENT` é uma pessoa da casa **sem acesso ao aplicativo**.
 *
 * Um filho de doze anos, um pai idoso, alguém que só precisa existir para a
 * pergunta "de quem é este gasto". Antes disso, todo membro exigia conta
 * própria e a troca manual de um identificador de 28 caracteres — o que
 * deixava o caso mais comum de uma casa brasileira de fora, e com ele a
 * atribuição de despesas.
 *
 * O papel não concede nada, e isso é garantido pela forma do dado, não por
 * uma verificação: as Security Rules só reconhecem um membro quando o **id do
 * documento é o uid de quem chama**, e o documento de um dependente tem id
 * prefixado com `dep_` — que o Firebase Auth nunca emite.
 */
export const HOUSEHOLD_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER", "DEPENDENT"] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

/** Prefixo que separa um perfil sem acesso de um uid real do Firebase Auth. */
export const DEPENDENT_ID_PREFIX = "dep_";

export function isDependentId(id: string): boolean {
  return id.startsWith(DEPENDENT_ID_PREFIX);
}

const ROLE_RANK: Record<HouseholdRole, number> = {
  // Abaixo de VIEWER: um dependente não vê nem altera nada. Ele aparece nas
  // telas de quem tem acesso, e não tem acesso nenhum.
  DEPENDENT: -1,
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(role: HouseholdRole, minimum: HouseholdRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** VIEWER can read everything in the household but change nothing. */
export const canWrite = (role: HouseholdRole): boolean => roleAtLeast(role, "MEMBER");

/** ADMIN and OWNER manage members, invites and household settings. */
export const canAdminister = (role: HouseholdRole): boolean => roleAtLeast(role, "ADMIN");
