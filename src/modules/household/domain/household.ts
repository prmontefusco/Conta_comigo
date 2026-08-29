import type { Instant } from "@/core/date/calendar-date";
import type { CurrencyCode } from "@/core/money/money";
import type {
  AuditFields,
  HouseholdId,
  HouseholdRole,
  MemberId,
  UserId,
} from "@/modules/shared/domain/common";

/**
 * A Household is the tenant boundary of the whole application.
 *
 * Every financial record belongs to exactly one household, and access is
 * granted only through a Membership document. There is no other path to data
 * (docs/SECURITY.md, docs/adr/0001-household-as-tenant.md).
 */

export interface HouseholdSettings {
  /** IANA timezone. Decides which day "today" is for due dates and overdue state. */
  readonly timezone: string;
  readonly currency: CurrencyCode;
  readonly locale: string;
  /**
   * Which month a card purchase belongs to.
   *
   * PURCHASE_DATE attributes it to the day it happened; STATEMENT_MONTH to the
   * fatura it lands in. Applied when a purchase is created, never retroactively
   * (docs/DOMAIN.md).
   */
  readonly cardCompetenceStrategy: "PURCHASE_DATE" | "STATEMENT_MONTH";
  /** Day the household considers its financial month to start. Usually 1. */
  readonly monthStartDay: number;
}

export const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = {
  timezone: "America/Sao_Paulo",
  currency: "BRL",
  locale: "pt-BR",
  cardCompetenceStrategy: "PURCHASE_DATE",
  monthStartDay: 1,
};

export interface Household extends AuditFields {
  readonly id: HouseholdId;
  readonly name: string;
  readonly ownerUid: UserId;
  readonly settings: HouseholdSettings;
  readonly memberUids: readonly UserId[];
  readonly archived: boolean;
}

export type MembershipStatus = "ACTIVE" | "INVITED" | "REMOVED";

export interface HouseholdMembership extends AuditFields {
  /** Document id equals the user's uid, which is what Security Rules check. */
  readonly id: MemberId;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly displayName: string;
  readonly email?: string;
  readonly role: HouseholdRole;
  readonly status: MembershipStatus;
  readonly joinedAt?: Instant;
}

export type UserPlan = "FREE" | "PREMIUM";

export interface UserProfile extends AuditFields {
  readonly id: UserId;
  readonly uid: UserId;
  readonly displayName: string;
  readonly email: string;
  readonly plan: UserPlan;
  readonly defaultHouseholdId?: HouseholdId;
  readonly onboardingCompletedSteps: readonly OnboardingStep[];
  readonly acceptedTermsAt?: Instant;
}

/**
 * Onboarding is progressive.
 *
 * Someone should see something useful after step three, not after fifty
 * screens of setup (docs/PRODUCT.md section 13).
 */
export const ONBOARDING_STEPS = [
  "CREATE_HOUSEHOLD",
  "ADD_MAIN_INCOME",
  "ADD_ACCOUNTS",
  "ADD_RECURRING_BILLS",
  "ADD_CARDS",
  "ADD_DEBTS",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The first step still to do, or null when onboarding is finished. */
export function nextOnboardingStep(profile: UserProfile): OnboardingStep | null {
  const done = new Set(profile.onboardingCompletedSteps);
  return ONBOARDING_STEPS.find((step) => !done.has(step)) ?? null;
}

/** How far through onboarding the person is, 0 to 1. */
export function onboardingProgress(profile: UserProfile): number {
  const done = profile.onboardingCompletedSteps.filter((step) =>
    (ONBOARDING_STEPS as readonly string[]).includes(step),
  );
  return done.length / ONBOARDING_STEPS.length;
}

/**
 * The three steps that unlock a meaningful dashboard.
 *
 * Below this the app has nothing honest to project, so it says so instead of
 * showing an empty chart.
 */
export function hasMinimumViableSetup(profile: UserProfile): boolean {
  const done = new Set(profile.onboardingCompletedSteps);
  return done.has("CREATE_HOUSEHOLD") && done.has("ADD_ACCOUNTS") && done.has("ADD_MAIN_INCOME");
}

export interface HouseholdInvite extends AuditFields {
  readonly id: string;
  readonly householdId: HouseholdId;
  readonly email: string;
  readonly role: HouseholdRole;
  readonly status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  readonly expiresAt: Instant;
  readonly invitedByUid: UserId;
}

export const ROLE_LABELS: Record<HouseholdRole, string> = {
  OWNER: "Responsável",
  ADMIN: "Administrador",
  MEMBER: "Membro",
  VIEWER: "Visualizador",
};

export const ROLE_DESCRIPTIONS: Record<HouseholdRole, string> = {
  OWNER: "Criou o grupo. Pode fazer tudo, inclusive excluir o grupo.",
  ADMIN: "Gerencia membros, convites e configurações.",
  MEMBER: "Registra e edita informações financeiras.",
  VIEWER: "Vê as informações, sem alterar nada.",
};
