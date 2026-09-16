import { describe, expect, it } from "vitest";
import { brl } from "@/modules/shared/testing/builders";
import { estimateRevolvingCycle } from "./card-revolving";

describe("card revolving estimate", () => {
  it("applies one cycle of interest and the informed IOF only to the unpaid balance", () => {
    const result = estimateRevolvingCycle({
      principal: brl(700),
      monthlyRatePercent: 10,
      days: 30,
      iofDailyPercent: 0.0082,
      iofAdditionalPercent: 0.38,
    });
    expect(result.interest).toEqual(brl(70));
    expect(result.dailyIof).toEqual(brl(1.72));
    expect(result.additionalIof).toEqual(brl(2.66));
    expect(result.estimatedNextCharge).toEqual(brl(774.38));
  });
});
