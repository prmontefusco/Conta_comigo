import { describe, expect, it } from "vitest";
import { aRecurringRule, brl, on } from "@/modules/shared/testing/builders";
import { nextOccurrence, occurrencesBetween } from "./recurring-rule";

describe("monthly recurrence", () => {
  const rule = aRecurringRule({ dayOfMonth: 10, startDate: on("2026-01-10") });

  it("fires once a month on the configured day", () => {
    const dates = occurrencesBetween(rule, on("2026-08-01"), on("2026-11-30")).map(
      (o) => o.dueDate,
    );
    expect(dates).toEqual(["2026-08-10", "2026-09-10", "2026-10-10", "2026-11-10"]);
  });

  it("does not fire before the start date", () => {
    const late = aRecurringRule({ dayOfMonth: 10, startDate: on("2026-10-10") });
    expect(
      occurrencesBetween(late, on("2026-08-01"), on("2026-12-31")).map((o) => o.dueDate),
    ).toEqual(["2026-10-10", "2026-11-10", "2026-12-10"]);
  });

  it("stops at the end date", () => {
    const ending = aRecurringRule({
      dayOfMonth: 10,
      startDate: on("2026-01-10"),
      endDate: on("2026-10-15"),
    });
    expect(
      occurrencesBetween(ending, on("2026-08-01"), on("2026-12-31")).map((o) => o.dueDate),
    ).toEqual(["2026-08-10", "2026-09-10", "2026-10-10"]);
  });

  it("stops after the configured number of occurrences", () => {
    const limited = aRecurringRule({
      dayOfMonth: 10,
      startDate: on("2026-08-10"),
      maxOccurrences: 3,
    });
    expect(occurrencesBetween(limited, on("2026-01-01"), on("2027-12-31"))).toHaveLength(3);
  });

  it("never fires when inactive", () => {
    const paused = aRecurringRule({ active: false });
    expect(occurrencesBetween(paused, on("2026-01-01"), on("2026-12-31"))).toEqual([]);
  });
});

describe("month-end handling", () => {
  it("clamps the 31st into short months without shifting later ones", () => {
    const rule = aRecurringRule({ dayOfMonth: 31, startDate: on("2026-01-31") });
    const dates = occurrencesBetween(rule, on("2026-01-01"), on("2026-05-31")).map(
      (o) => o.dueDate,
    );
    // February clamps to the 28th, but March must go back to the 31st.
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });

  it("handles a leap year", () => {
    const rule = aRecurringRule({ dayOfMonth: 29, startDate: on("2024-01-29") });
    const dates = occurrencesBetween(rule, on("2024-02-01"), on("2024-03-31")).map(
      (o) => o.dueDate,
    );
    expect(dates).toEqual(["2024-02-29", "2024-03-29"]);
  });
});

describe("weekend policy", () => {
  it("keeps the nominal date by default", () => {
    // 2026-08-29 is a Saturday.
    const rule = aRecurringRule({
      dayOfMonth: 29,
      startDate: on("2026-08-29"),
      weekendPolicy: "KEEP",
    });
    expect(occurrencesBetween(rule, on("2026-08-01"), on("2026-08-31"))[0]?.dueDate).toBe(
      "2026-08-29",
    );
  });

  it("moves a boleto to the next business day when asked", () => {
    const rule = aRecurringRule({
      dayOfMonth: 29,
      startDate: on("2026-08-29"),
      weekendPolicy: "NEXT_BUSINESS_DAY",
    });
    const occurrence = occurrencesBetween(rule, on("2026-08-01"), on("2026-09-05"))[0];
    expect(occurrence?.dueDate).toBe("2026-08-31");
    // The competence date stays on the nominal day so the budget month is right.
    expect(occurrence?.competenceDate).toBe("2026-08-29");
  });
});

describe("other frequencies", () => {
  it("fires weekly", () => {
    const rule = aRecurringRule({ frequency: "WEEKLY", interval: 1, startDate: on("2026-08-03") });
    expect(
      occurrencesBetween(rule, on("2026-08-01"), on("2026-08-31")).map((o) => o.dueDate),
    ).toEqual(["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"]);
  });

  it("fires every two weeks", () => {
    const rule = aRecurringRule({ frequency: "BIWEEKLY", startDate: on("2026-08-03") });
    expect(
      occurrencesBetween(rule, on("2026-08-01"), on("2026-09-15")).map((o) => o.dueDate),
    ).toEqual(["2026-08-03", "2026-08-17", "2026-08-31", "2026-09-14"]);
  });

  it("fires quarterly", () => {
    const rule = aRecurringRule({
      frequency: "QUARTERLY",
      dayOfMonth: 15,
      startDate: on("2026-01-15"),
    });
    expect(
      occurrencesBetween(rule, on("2026-01-01"), on("2026-12-31")).map((o) => o.dueDate),
    ).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  });

  it("fires annually in the configured month", () => {
    const rule = aRecurringRule({
      frequency: "ANNUAL",
      monthOfYear: 1,
      dayOfMonth: 20,
      startDate: on("2026-01-01"),
      description: "IPVA",
      amount: brl(1400),
    });
    expect(
      occurrencesBetween(rule, on("2026-01-01"), on("2028-12-31")).map((o) => o.dueDate),
    ).toEqual(["2026-01-20", "2027-01-20", "2028-01-20"]);
  });

  it("fires every N days", () => {
    const rule = aRecurringRule({
      frequency: "EVERY_N_DAYS",
      interval: 10,
      startDate: on("2026-08-01"),
    });
    expect(
      occurrencesBetween(rule, on("2026-08-01"), on("2026-08-31")).map((o) => o.dueDate),
    ).toEqual(["2026-08-01", "2026-08-11", "2026-08-21", "2026-08-31"]);
  });
});

describe("occurrence identity", () => {
  it("gives every occurrence a stable key so it can never be materialised twice", () => {
    const rule = aRecurringRule({ id: "rule-x", dayOfMonth: 10, startDate: on("2026-01-10") });
    const first = occurrencesBetween(rule, on("2026-09-01"), on("2026-09-30"));
    const again = occurrencesBetween(rule, on("2026-01-01"), on("2026-12-31")).filter(
      (o) => o.competenceDate === "2026-09-10",
    );
    expect(first[0]?.occurrenceKey).toBe("rule-x:2026-09-10");
    expect(again[0]?.occurrenceKey).toBe(first[0]?.occurrenceKey);
  });
});

describe("next occurrence", () => {
  it("finds the next one from a given day", () => {
    const rule = aRecurringRule({ dayOfMonth: 10, startDate: on("2026-01-10") });
    expect(nextOccurrence(rule, on("2026-08-11"))?.dueDate).toBe("2026-09-10");
  });

  it("returns null when the rule has finished", () => {
    const rule = aRecurringRule({
      dayOfMonth: 10,
      startDate: on("2026-01-10"),
      endDate: on("2026-03-10"),
    });
    expect(nextOccurrence(rule, on("2026-08-01"))).toBeNull();
  });
});
