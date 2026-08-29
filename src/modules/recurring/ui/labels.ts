import { formatCalendarDate as formatDate, type CalendarDate } from "@/core/date/calendar-date";
import { nextOccurrence, type RecurringRule } from "@/modules/recurring/domain/recurring-rule";

export const formatCalendarDate = formatDate;

/** "próxima em 10/09/2026", or a plain statement when the rule has finished. */
export function nextOccurrenceLabel(rule: RecurringRule, asOf: CalendarDate): string {
  if (!rule.active) return "pausada";
  const next = nextOccurrence(rule, asOf);
  if (!next) return "sem próximas ocorrências";
  return `próxima em ${formatDate(next.dueDate)}`;
}
