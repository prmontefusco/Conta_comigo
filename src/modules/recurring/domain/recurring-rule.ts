import {
  type CalendarDate,
  addDays,
  addMonths,
  dayInMonth,
  isAfter,
  isOnOrAfter,
  isOnOrBefore,
  monthKeyFromParts,
  monthKeyOf,
  nextBusinessDay,
} from "@/core/date/calendar-date";
import type { Money } from "@/core/money/money";
import type {
  AccountId,
  AuditFields,
  CategoryId,
  Confidence,
  ExpenseNature,
  FlowDirection,
  HouseholdId,
  MemberId,
  RecurringRuleId,
  VehicleId,
  Visibility,
} from "@/modules/shared/domain/common";

/**
 * Recurrence engine.
 *
 * A recurring rule is a *description* of future events, never the events
 * themselves. Expanding it on demand means the forecast can look twelve months
 * ahead without writing twelve months of documents, and changing a rule
 * immediately changes every projection that depends on it.
 */

export type Frequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "EVERY_N_DAYS";

/** What to do when the computed date lands on a Saturday or Sunday. */
export type WeekendPolicy = "KEEP" | "NEXT_BUSINESS_DAY";

export interface RecurringRule extends AuditFields {
  readonly id: RecurringRuleId;
  readonly householdId: HouseholdId;
  readonly direction: FlowDirection;
  readonly description: string;
  readonly amount: Money;

  readonly frequency: Frequency;
  /** For EVERY_N_DAYS, and as a multiplier for WEEKLY/MONTHLY variants. */
  readonly interval: number;
  /** Day of month for monthly-family frequencies. Clamped in short months. */
  readonly dayOfMonth?: number;
  /** 0 = Sunday. Used by WEEKLY and BIWEEKLY. */
  readonly dayOfWeek?: number;
  /** 1-12. Used by ANNUAL. */
  readonly monthOfYear?: number;

  readonly startDate: CalendarDate;
  readonly endDate?: CalendarDate;
  /** Stops after this many occurrences, counted from startDate. */
  readonly maxOccurrences?: number;

  readonly weekendPolicy: WeekendPolicy;

  readonly categoryId?: CategoryId;
  readonly expectedAccountId?: AccountId;
  readonly expenseNature: ExpenseNature;
  readonly confidence: Confidence;
  readonly visibility: Visibility;
  readonly responsibleMemberId?: MemberId;
  readonly vehicleId?: VehicleId;

  readonly active: boolean;
  readonly notes?: string;
}

export interface RuleOccurrence {
  readonly ruleId: RecurringRuleId;
  readonly dueDate: CalendarDate;
  readonly competenceDate: CalendarDate;
  readonly amount: Money;
  readonly index: number;
  /**
   * Stable identity of this occurrence.
   *
   * Used to reconcile expanded occurrences against obligations already stored,
   * so a bill that was materialised and edited is never counted twice by the
   * forecast.
   */
  readonly occurrenceKey: string;
}

export function occurrenceKeyFor(ruleId: RecurringRuleId, dueDate: CalendarDate): string {
  return `${ruleId}:${dueDate}`;
}

/** Number of months between occurrences, for the monthly family. */
function monthStep(rule: RecurringRule): number | null {
  switch (rule.frequency) {
    case "MONTHLY":
      return 1 * Math.max(rule.interval, 1);
    case "BIMONTHLY":
      return 2;
    case "QUARTERLY":
      return 3;
    case "SEMIANNUAL":
      return 6;
    case "ANNUAL":
      return 12;
    default:
      return null;
  }
}

function applyWeekendPolicy(rule: RecurringRule, date: CalendarDate): CalendarDate {
  return rule.weekendPolicy === "NEXT_BUSINESS_DAY" ? nextBusinessDay(date) : date;
}

/**
 * Expands a rule into the occurrences that fall inside a window.
 *
 * The competence date stays on the *nominal* date even when the due date is
 * pushed off a weekend, so a bill nominally due on the 31st of March never
 * jumps into April's budget.
 */
export function occurrencesBetween(
  rule: RecurringRule,
  from: CalendarDate,
  to: CalendarDate,
): RuleOccurrence[] {
  if (!rule.active) return [];
  if (isAfter(rule.startDate, to)) return [];

  const occurrences: RuleOccurrence[] = [];
  const months = monthStep(rule);
  const limit = rule.maxOccurrences ?? Number.POSITIVE_INFINITY;
  const hardStop = rule.endDate;

  // Guards against a misconfigured interval producing an unbounded loop.
  const MAX_ITERATIONS = 5000;
  const anchor = firstNominalDate(rule);

  for (let index = 0; index < limit && index < MAX_ITERATIONS; index += 1) {
    const nominal = nominalDateAt(rule, anchor, index, months);

    if (hardStop && isAfter(nominal, hardStop)) break;
    if (isAfter(nominal, to)) break;

    if (isOnOrAfter(nominal, from) && isOnOrAfter(nominal, rule.startDate)) {
      occurrences.push({
        ruleId: rule.id,
        dueDate: applyWeekendPolicy(rule, nominal),
        competenceDate: nominal,
        amount: rule.amount,
        index,
        occurrenceKey: occurrenceKeyFor(rule.id, nominal),
      });
    }
  }

  return occurrences;
}

/** The first date the rule fires, honouring dayOfMonth and monthOfYear. */
function firstNominalDate(rule: RecurringRule): CalendarDate {
  if (monthStep(rule) === null) return rule.startDate;

  const startYear = Number(rule.startDate.slice(0, 4));

  if (rule.frequency === "ANNUAL" && rule.monthOfYear) {
    const day = rule.dayOfMonth ?? Number(rule.startDate.slice(8, 10));
    const candidate = dayInMonth(monthKeyFromParts(startYear, rule.monthOfYear), day);
    return isOnOrBefore(rule.startDate, candidate)
      ? candidate
      : dayInMonth(monthKeyFromParts(startYear + 1, rule.monthOfYear), day);
  }

  if (rule.dayOfMonth) {
    const candidate = dayInMonth(monthKeyOf(rule.startDate), rule.dayOfMonth);
    return isOnOrBefore(rule.startDate, candidate)
      ? candidate
      : dayInMonth(monthKeyOf(addMonths(rule.startDate, 1)), rule.dayOfMonth);
  }

  return rule.startDate;
}

/**
 * The nominal date of occurrence `index`, always measured from the anchor.
 *
 * Computing from the anchor rather than from the previous occurrence stops a
 * February clamp from permanently shortening every later month: a bill on the
 * 31st goes 31 Jan, 28 Feb, 31 Mar, not 31 Jan, 28 Feb, 28 Mar.
 */
function nominalDateAt(
  rule: RecurringRule,
  anchor: CalendarDate,
  index: number,
  months: number | null,
): CalendarDate {
  if (months !== null) {
    const shifted = addMonths(anchor, months * index);
    return rule.dayOfMonth ? dayInMonth(monthKeyOf(shifted), rule.dayOfMonth) : shifted;
  }

  switch (rule.frequency) {
    case "WEEKLY":
      return addDays(anchor, 7 * Math.max(rule.interval, 1) * index);
    case "BIWEEKLY":
      return addDays(anchor, 14 * index);
    case "EVERY_N_DAYS":
      return addDays(anchor, Math.max(rule.interval, 1) * index);
    default:
      return addDays(anchor, index);
  }
}

/** Next occurrence at or after `from`, or null when the rule has finished. */
export function nextOccurrence(rule: RecurringRule, from: CalendarDate): RuleOccurrence | null {
  const horizon = addMonths(from, 24);
  return occurrencesBetween(rule, from, horizon)[0] ?? null;
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  EVERY_N_DAYS: "A cada N dias",
};
