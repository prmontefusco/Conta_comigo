import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addMonthsToKey,
  calendarDate,
  CalendarDateError,
  compareDates,
  dateRange,
  dayInMonth,
  daysInMonth,
  differenceInDays,
  differenceInMonths,
  eachDayInRange,
  eachMonthInRange,
  endOfMonth,
  formatMonthShort,
  isCalendarDate,
  isWeekend,
  lastDayOfMonthKey,
  monthKey,
  monthKeyOf,
  nextBusinessDay,
  startOfMonth,
  todayIn,
} from "./calendar-date";

describe("calendar date validation", () => {
  it("accepts real dates", () => {
    expect(isCalendarDate("2026-08-28")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
  });

  it("rejects impossible dates instead of silently rolling them over", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2025-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("28/08/2026")).toBe(false);
    expect(() => calendarDate("nope")).toThrow(CalendarDateError);
  });
});

describe("timezone handling", () => {
  it("resolves today from the household timezone, not the machine clock", () => {
    // 2026-08-29T02:00Z is still the 28th in Sao Paulo (UTC-3).
    const at = new Date("2026-08-29T02:00:00.000Z");
    expect(todayIn("America/Sao_Paulo", at)).toBe("2026-08-28");
    expect(todayIn("UTC", at)).toBe("2026-08-29");
    expect(todayIn("Asia/Tokyo", at)).toBe("2026-08-29");
  });
});

describe("day arithmetic", () => {
  it("adds and subtracts days across month and year boundaries", () => {
    expect(addDays(calendarDate("2026-08-31"), 1)).toBe("2026-09-01");
    expect(addDays(calendarDate("2026-01-01"), -1)).toBe("2025-12-31");
    expect(addDays(calendarDate("2024-02-28"), 1)).toBe("2024-02-29");
  });

  it("is unaffected by daylight saving transitions", () => {
    // Southern-hemisphere DST boundaries historically broke naive date math.
    expect(addDays(calendarDate("2026-10-17"), 1)).toBe("2026-10-18");
    expect(addDays(calendarDate("2026-02-14"), 1)).toBe("2026-02-15");
  });

  it("measures differences in whole days", () => {
    expect(differenceInDays(calendarDate("2026-08-01"), calendarDate("2026-08-31"))).toBe(30);
    expect(differenceInDays(calendarDate("2026-08-31"), calendarDate("2026-08-01"))).toBe(-30);
    expect(differenceInDays(calendarDate("2026-01-01"), calendarDate("2027-01-01"))).toBe(365);
  });
});

describe("month arithmetic", () => {
  it("clamps to the last day of a shorter month", () => {
    expect(addMonths(calendarDate("2026-01-31"), 1)).toBe("2026-02-28");
    expect(addMonths(calendarDate("2024-01-31"), 1)).toBe("2024-02-29");
    expect(addMonths(calendarDate("2026-03-31"), 1)).toBe("2026-04-30");
  });

  it("does not compound the clamp when adding several months at once", () => {
    // Adding 2 months to Jan 31 must be Mar 31, not Feb 28 then Mar 28.
    expect(addMonths(calendarDate("2026-01-31"), 2)).toBe("2026-03-31");
  });

  it("moves backwards", () => {
    expect(addMonths(calendarDate("2026-01-15"), -1)).toBe("2025-12-15");
    expect(addMonths(calendarDate("2026-03-31"), -1)).toBe("2026-02-28");
  });

  it("counts months between dates", () => {
    expect(differenceInMonths(calendarDate("2026-08-15"), calendarDate("2026-11-01"))).toBe(3);
  });

  it("knows month lengths", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("finds month boundaries", () => {
    expect(startOfMonth(calendarDate("2026-08-28"))).toBe("2026-08-01");
    expect(endOfMonth(calendarDate("2026-02-10"))).toBe("2026-02-28");
  });
});

describe("month keys", () => {
  it("derives and advances month keys", () => {
    expect(monthKeyOf(calendarDate("2026-08-28"))).toBe("2026-08");
    expect(addMonthsToKey(monthKey("2026-11"), 2)).toBe("2027-01");
    expect(lastDayOfMonthKey(monthKey("2026-02"))).toBe("2026-02-28");
  });

  it("clamps a configured day into a month", () => {
    expect(dayInMonth(monthKey("2026-02"), 31)).toBe("2026-02-28");
    expect(dayInMonth(monthKey("2026-08"), 10)).toBe("2026-08-10");
    expect(dayInMonth(monthKey("2026-08"), 0)).toBe("2026-08-01");
  });

  it("rejects malformed keys", () => {
    expect(() => monthKey("2026-13")).toThrow(CalendarDateError);
    expect(() => monthKey("2026")).toThrow(CalendarDateError);
  });

  it("renders short labels used by the forecast table", () => {
    expect(formatMonthShort(monthKey("2026-09"))).toBe("SET");
    expect(formatMonthShort(monthKey("2026-11"))).toBe("NOV");
  });
});

describe("ranges", () => {
  it("enumerates days inclusively", () => {
    const days = eachDayInRange(dateRange(calendarDate("2026-08-30"), calendarDate("2026-09-02")));
    expect(days).toEqual(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
  });

  it("enumerates months inclusively", () => {
    const months = eachMonthInRange(
      dateRange(calendarDate("2026-11-15"), calendarDate("2027-02-01")),
    );
    expect(months).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("rejects inverted ranges", () => {
    expect(() => dateRange(calendarDate("2026-09-01"), calendarDate("2026-08-01"))).toThrow(
      CalendarDateError,
    );
  });
});

describe("business days", () => {
  it("identifies weekends", () => {
    expect(isWeekend(calendarDate("2026-08-29"))).toBe(true); // Saturday
    expect(isWeekend(calendarDate("2026-08-30"))).toBe(true); // Sunday
    expect(isWeekend(calendarDate("2026-08-28"))).toBe(false); // Friday
  });

  it("moves a weekend due date to Monday", () => {
    expect(nextBusinessDay(calendarDate("2026-08-29"))).toBe("2026-08-31");
    expect(nextBusinessDay(calendarDate("2026-08-28"))).toBe("2026-08-28");
  });
});

describe("ordering", () => {
  it("sorts lexicographically, which matches chronological order", () => {
    const dates = ["2026-09-01", "2026-08-31", "2026-12-01", "2026-01-05"].map(calendarDate);
    expect([...dates].sort(compareDates)).toEqual([
      "2026-01-05",
      "2026-08-31",
      "2026-09-01",
      "2026-12-01",
    ]);
  });
});
