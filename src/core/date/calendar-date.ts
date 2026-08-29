/**
 * Calendar dates and instants are deliberately different types.
 *
 * A due date is a calendar fact: "the electricity bill is due on 2026-09-10"
 * is true regardless of where the reader is standing. A `paidAt` is an instant:
 * a precise moment on a clock. Modelling both as `Date` is how apps end up
 * showing a bill as overdue a day early for users west of UTC.
 *
 * See docs/adr/0005-calendar-dates-vs-instants.md.
 */

/** An ISO-8601 calendar date, `YYYY-MM-DD`, with no time and no timezone. */
export type CalendarDate = string & { readonly __brand: "CalendarDate" };

/** An ISO-8601 instant in UTC, e.g. `2026-08-28T14:32:00.000Z`. */
export type Instant = string & { readonly __brand: "Instant" };

/** A year and month, `YYYY-MM`. Used for statements and budgets. */
export type MonthKey = string & { readonly __brand: "MonthKey" };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export class CalendarDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarDateError";
  }
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const asDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return !Number.isNaN(asDate.getTime()) && asDate.toISOString().slice(0, 10) === value;
}

export function calendarDate(value: string): CalendarDate {
  if (!isCalendarDate(value)) {
    throw new CalendarDateError(`Invalid calendar date "${value}". Expected YYYY-MM-DD.`);
  }
  return value;
}

export function tryCalendarDate(value: string): CalendarDate | null {
  return isCalendarDate(value) ? value : null;
}

export function fromParts(year: number, month: number, day: number): CalendarDate {
  const pad = (n: number, size = 2) => String(n).padStart(size, "0");
  return calendarDate(`${pad(year, 4)}-${pad(month)}-${pad(day)}`);
}

export function partsOf(date: CalendarDate): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new CalendarDateError(`Invalid calendar date "${date}".`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * Internal arithmetic helper.
 *
 * Anchored at midday UTC so daylight-saving shifts can never push the date
 * across a day boundary during arithmetic.
 */
function toUtcAnchor(date: CalendarDate): Date {
  const { year, month, day } = partsOf(date);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function fromUtcAnchor(anchor: Date): CalendarDate {
  return calendarDate(anchor.toISOString().slice(0, 10));
}

/**
 * Today, as seen from a specific IANA timezone.
 *
 * The household's timezone decides which day "today" is, so a bill due today
 * in Sao Paulo is not reported as overdue for a member travelling in Tokyo.
 */
export function todayIn(timeZone: string, now: Date = new Date()): CalendarDate {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return calendarDate(formatted);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const anchor = toUtcAnchor(date);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return fromUtcAnchor(anchor);
}

/**
 * Adds months, clamping to the last valid day.
 *
 * A subscription charged on the 31st becomes the 28th (or 29th) in February
 * rather than silently rolling into March, which is how banks and card issuers
 * behave in practice.
 */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const { year, month, day } = partsOf(date);
  const totalMonths = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths - targetYear * 12 + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return fromParts(targetYear, targetMonth, clampedDay);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Whole days from `a` to `b`. Negative when `b` is earlier. */
export function differenceInDays(a: CalendarDate, b: CalendarDate): number {
  const millis = toUtcAnchor(b).getTime() - toUtcAnchor(a).getTime();
  return Math.round(millis / 86_400_000);
}

export function differenceInMonths(a: CalendarDate, b: CalendarDate): number {
  const from = partsOf(a);
  const to = partsOf(b);
  return (to.year - from.year) * 12 + (to.month - from.month);
}

export function compareDates(a: CalendarDate, b: CalendarDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export const isBefore = (a: CalendarDate, b: CalendarDate): boolean => a < b;
export const isAfter = (a: CalendarDate, b: CalendarDate): boolean => a > b;
export const isSameDate = (a: CalendarDate, b: CalendarDate): boolean => a === b;
export const isOnOrBefore = (a: CalendarDate, b: CalendarDate): boolean => a <= b;
export const isOnOrAfter = (a: CalendarDate, b: CalendarDate): boolean => a >= b;

export function isWithin(date: CalendarDate, from: CalendarDate, to: CalendarDate): boolean {
  return date >= from && date <= to;
}

export function minDate(a: CalendarDate, b: CalendarDate): CalendarDate {
  return a <= b ? a : b;
}

export function maxDate(a: CalendarDate, b: CalendarDate): CalendarDate {
  return a >= b ? a : b;
}

export function startOfMonth(date: CalendarDate): CalendarDate {
  const { year, month } = partsOf(date);
  return fromParts(year, month, 1);
}

export function endOfMonth(date: CalendarDate): CalendarDate {
  const { year, month } = partsOf(date);
  return fromParts(year, month, daysInMonth(year, month));
}

/** Day of week, 0 = Sunday through 6 = Saturday. */
export function dayOfWeek(date: CalendarDate): number {
  return toUtcAnchor(date).getUTCDay();
}

export function isWeekend(date: CalendarDate): boolean {
  const day = dayOfWeek(date);
  return day === 0 || day === 6;
}

/**
 * Moves a date forward off the weekend.
 *
 * Boletos due on a Saturday or Sunday are payable on the next business day.
 * National holidays are not modelled yet, so this is a deliberate
 * approximation - documented in docs/DOMAIN.md.
 */
export function nextBusinessDay(date: CalendarDate): CalendarDate {
  let result = date;
  while (isWeekend(result)) {
    result = addDays(result, 1);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Month keys                                                          */
/* ------------------------------------------------------------------ */

export function isMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== "string") return false;
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function monthKey(value: string): MonthKey {
  if (!isMonthKey(value)) {
    throw new CalendarDateError(`Invalid month key "${value}". Expected YYYY-MM.`);
  }
  return value;
}

export function monthKeyOf(date: CalendarDate): MonthKey {
  return monthKey(date.slice(0, 7));
}

export function monthKeyFromParts(year: number, month: number): MonthKey {
  return monthKey(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`);
}

export function addMonthsToKey(key: MonthKey, months: number): MonthKey {
  return monthKeyOf(addMonths(firstDayOfMonthKey(key), months));
}

export function firstDayOfMonthKey(key: MonthKey): CalendarDate {
  return calendarDate(`${key}-01`);
}

export function lastDayOfMonthKey(key: MonthKey): CalendarDate {
  return endOfMonth(firstDayOfMonthKey(key));
}

export function compareMonthKeys(a: MonthKey, b: MonthKey): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Builds a date inside a month, clamping the day.
 *
 * `dayInMonth("2026-02", 31)` yields 2026-02-28. Used for recurring rules and
 * card closing/due dates where the configured day may not exist every month.
 */
export function dayInMonth(key: MonthKey, day: number): CalendarDate {
  const { year, month } = partsOf(firstDayOfMonthKey(key));
  return fromParts(year, month, Math.min(Math.max(day, 1), daysInMonth(year, month)));
}

/* ------------------------------------------------------------------ */
/* Ranges                                                              */
/* ------------------------------------------------------------------ */

export interface DateRange {
  readonly from: CalendarDate;
  readonly to: CalendarDate;
}

export function dateRange(from: CalendarDate, to: CalendarDate): DateRange {
  if (isAfter(from, to)) {
    throw new CalendarDateError(`Invalid range: "${from}" is after "${to}".`);
  }
  return { from, to };
}

export function eachDayInRange(range: DateRange): CalendarDate[] {
  const days: CalendarDate[] = [];
  let cursor = range.from;
  while (isOnOrBefore(cursor, range.to)) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function eachMonthInRange(range: DateRange): MonthKey[] {
  const months: MonthKey[] = [];
  let cursor = monthKeyOf(range.from);
  const last = monthKeyOf(range.to);
  while (compareMonthKeys(cursor, last) <= 0) {
    months.push(cursor);
    cursor = addMonthsToKey(cursor, 1);
  }
  return months;
}

/* ------------------------------------------------------------------ */
/* Instants                                                            */
/* ------------------------------------------------------------------ */

export function instant(value: Date | string = new Date()): Instant {
  const asDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    throw new CalendarDateError(`Invalid instant "${String(value)}".`);
  }
  return asDate.toISOString() as Instant;
}

export function instantToCalendarDate(value: Instant, timeZone: string): CalendarDate {
  return todayIn(timeZone, new Date(value));
}

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

export function formatCalendarDate(
  date: CalendarDate,
  options: { locale?: string; style?: "short" | "long" | "dayMonth" } = {},
): string {
  const { locale = "pt-BR", style = "short" } = options;
  const { year, month, day } = partsOf(date);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));

  const intlOptions: Intl.DateTimeFormatOptions =
    style === "long"
      ? { day: "numeric", month: "long", year: "numeric" }
      : style === "dayMonth"
        ? { day: "2-digit", month: "2-digit" }
        : { day: "2-digit", month: "2-digit", year: "numeric" };

  return new Intl.DateTimeFormat(locale, { ...intlOptions, timeZone: "UTC" }).format(anchor);
}

export function formatMonthKey(key: MonthKey, locale = "pt-BR"): string {
  const anchor = new Date(`${key}-01T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(anchor);
}

/** Short month label used in forecast tables: "SET", "OUT", "NOV". */
export function formatMonthShort(key: MonthKey, locale = "pt-BR"): string {
  const anchor = new Date(`${key}-01T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" })
    .format(anchor)
    .replace(".", "")
    .toUpperCase();
}
