import { describe, expect, it } from "vitest";
import { formatMoney } from "@/core/money/format";
import { brl } from "@/modules/shared/testing/builders";
import { BLANK, NEGOTIATION_SCRIPTS, buildScript } from "./scripts";

describe("every script", () => {
  it("fills in the numbers the household actually has", () => {
    const text = buildScript("PROPOSTA", {
      personName: "Marina Souza",
      creditorName: "Banco Exemplo",
      debtDescription: "o empréstimo pessoal",
      affordableInstallment: brl(420),
      installmentCount: 18,
    });

    expect(text).toContain("Marina Souza");
    expect(text).toContain("Banco Exemplo");
    // Compared through the formatter: pt-BR puts a non-breaking space after R$.
    expect(text).toContain(formatMoney(brl(420)));
    expect(text).toContain("18 parcelas");
  });

  it("leaves a blank instead of inventing what it does not know", () => {
    const text = buildScript("PROPOSTA", {});

    expect(text).toContain(BLANK);
    expect(text).toContain("esta dívida");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("NaN");
  });

  it("never prints undefined or NaN, whatever is missing", () => {
    for (const script of NEGOTIATION_SCRIPTS) {
      const text = script.build({});
      expect(text, script.id).not.toContain("undefined");
      expect(text, script.id).not.toContain("NaN");
      expect(text.length, script.id).toBeGreaterThan(80);
    }
  });

  it("says when to use it and what to do around the call", () => {
    for (const script of NEGOTIATION_SCRIPTS) {
      expect(script.whenToUse.length, script.id).toBeGreaterThan(20);
      expect(script.checklist.length, script.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("the detailing script", () => {
  it("asks for the breakdown and the CET before any agreement", () => {
    const text = buildScript("DETALHAMENTO", { personName: "João" });

    expect(text).toContain("principal");
    expect(text).toContain("CET");
    expect(text).toContain("protocolo");
  });
});

describe("the portability script", () => {
  it("asks for the payoff balance and the CET, which is what makes a comparison possible", () => {
    const text = buildScript("PORTABILIDADE", { creditorName: "Banco Exemplo" });

    expect(text).toContain("saldo devedor");
    expect(text).toContain("CET");
  });
});
