import { describe, expect, it } from "vitest";
import { aDebt, brl } from "@/modules/shared/testing/builders";
import {
  classifyDebt,
  essentialServiceConsequence,
  putsAssetAtRisk,
  sortByRisk,
} from "./debt-risk";

describe("what happens if it stops being paid", () => {
  it("treats a financed vehicle as critical: the car can be taken", () => {
    const risk = classifyDebt(aDebt({ kind: "VEHICLE_FINANCING" }));

    expect(risk.level).toBe("CRITICAL");
    expect(risk.guarantee).toBe("COLLATERAL");
    expect(risk.consequence).toContain("busca e apreensão");
  });

  it("treats a property financing as critical", () => {
    expect(classifyDebt(aDebt({ kind: "REAL_ESTATE_FINANCING" })).level).toBe("CRITICAL");
  });

  it("separates payroll debt: no default, but the salary arrives smaller", () => {
    const risk = classifyDebt(aDebt({ kind: "PAYROLL_LOAN" }));

    expect(risk.guarantee).toBe("PAYROLL");
    expect(risk.level).toBe("HIGH");
  });

  it("keeps an unsecured loan moderate however large it is", () => {
    const risk = classifyDebt(aDebt({ kind: "PERSONAL_LOAN", principalContracted: brl(80000) }));

    expect(risk.level).toBe("MODERATE");
    expect(putsAssetAtRisk(aDebt({ kind: "PERSONAL_LOAN" }))).toBe(false);
  });

  it("escalates anything already in default", () => {
    const risk = classifyDebt(aDebt({ kind: "PERSONAL_LOAN", status: "IN_DEFAULT" }));

    expect(risk.level).toBe("CRITICAL");
    expect(risk.consequence).toContain("já está em atraso");
  });
});

describe("ordering by consequence, not by size", () => {
  it("puts a small financed car ahead of a large personal loan", () => {
    const car = aDebt({ id: "car", kind: "VEHICLE_FINANCING", principalContracted: brl(9000) });
    const loan = aDebt({ id: "loan", kind: "PERSONAL_LOAN", principalContracted: brl(60000) });

    expect(sortByRisk([loan, car]).map((debt) => debt.id)).toEqual(["car", "loan"]);
  });

  it("breaks ties by size", () => {
    const small = aDebt({ id: "small", kind: "OVERDRAFT", principalContracted: brl(500) });
    const big = aDebt({ id: "big", kind: "OVERDRAFT", principalContracted: brl(5000) });

    expect(sortByRisk([small, big]).map((debt) => debt.id)).toEqual(["big", "small"]);
  });
});

describe("bills that cut off something essential", () => {
  it("names what is lost", () => {
    expect(essentialServiceConsequence("energia")).toBe("corte de energia elétrica");
    expect(essentialServiceConsequence("agua")).toContain("água");
  });

  it("stays silent about categories it does not know", () => {
    expect(essentialServiceConsequence("presentes")).toBeNull();
    expect(essentialServiceConsequence(undefined)).toBeNull();
  });
});
