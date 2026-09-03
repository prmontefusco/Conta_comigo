import { formatCalendarDate as formatDate, type CalendarDate } from "@/core/date/calendar-date";
import {
  FREQUENCY_LABELS,
  nextOccurrence,
  type RecurringRule,
} from "@/modules/recurring/domain/recurring-rule";

export const formatCalendarDate = formatDate;

/** "próxima em 10/09/2026", or a plain statement when the rule has finished. */
export function nextOccurrenceLabel(rule: RecurringRule, asOf: CalendarDate): string {
  if (!rule.active) return "pausada";
  const next = nextOccurrence(rule, asOf);
  if (!next) return "sem próximas ocorrências";
  return `próxima em ${formatDate(next.dueDate)}`;
}

/**
 * How often the rule fires, in words.
 *
 * EVERY_N_DAYS is the only frequency whose label depends on the interval:
 * "a cada N dias" with N = 1 is a daily wage read as a formula. Someone paid
 * by the day should see "todo dia".
 */
export function frequencyLabel(rule: RecurringRule): string {
  if (rule.frequency !== "EVERY_N_DAYS") return FREQUENCY_LABELS[rule.frequency];
  return rule.interval <= 1 ? "Todo dia" : `A cada ${rule.interval} dias`;
}
