import { describe, expect, it } from "vitest";
import { aReserve, brl } from "@/modules/shared/testing/builders";
import {
  monthsToStarterReserve,
  starterReserveStatus,
  starterReserveTarget,
} from "./starter-reserve";

describe("how big the first step is", () => {
  it("is half a month of expenses", () => {
    expect(starterReserveTarget(brl(1600))).toEqual(brl(800));
  });

  it("never asks for more than R$ 1.000, however large the month", () => {
    expect(starterReserveTarget(brl(9000))).toEqual(brl(1000));
  });

  it("never asks for less than R$ 500, however small the month", () => {
    expect(starterReserveTarget(brl(400))).toEqual(brl(500));
  });
});

describe("where the household stands", () => {
  it("counts only what is set aside for emergencies", () => {
    const status = starterReserveStatus(
      [
        aReserve({ id: "r1", purpose: "EMERGENCY", currentAmount: brl(300) }),
        // Real money, but it has a job: spending it cancels the trip.
        aReserve({ id: "r2", purpose: "TRAVEL", currentAmount: brl(2000) }),
      ],
      brl(1600),
    );

    expect(status.current).toEqual(brl(300));
    expect(status.missing).toEqual(brl(500));
    expect(status.isComplete).toBe(false);
  });

  it("ignores archived reserves", () => {
    const status = starterReserveStatus(
      [aReserve({ purpose: "EMERGENCY", currentAmount: brl(900), archived: true })],
      brl(1600),
    );

    expect(status.current).toEqual(brl(0));
    expect(status.hasEmergencyReserve).toBe(false);
  });

  it("is complete once the target is reached", () => {
    const status = starterReserveStatus(
      [aReserve({ purpose: "EMERGENCY", currentAmount: brl(800) })],
      brl(1600),
    );

    expect(status.isComplete).toBe(true);
    expect(status.ratio).toBe(1);
    expect(monthsToStarterReserve(status, brl(0))).toBe(0);
  });
});

describe("how long it takes", () => {
  const status = starterReserveStatus([], brl(1600));

  it("rounds up to whole months", () => {
    expect(monthsToStarterReserve(status, brl(300))).toBe(3);
  });

  it("says it cannot be done from a surplus that does not exist", () => {
    expect(monthsToStarterReserve(status, brl(0))).toBeNull();
  });
});
