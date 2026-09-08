import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import { calcularRunway } from "./runway";

describe("runway domain", () => {
  it("classifica como CRITICO quando liquidez é insuficiente para 30 dias", () => {
    const resultado = calcularRunway({
      liquidezTotalDisponivel: money(100000, "BRL"), // R$ 1.000,00
      custoMensalEssencial: money(300000, "BRL"), // R$ 3.000,00 (R$ 100/dia)
    });

    expect(resultado.diasAutonomia).toBe(10);
    expect(resultado.nivel).toBe("CRITICO");
  });

  it("classifica como ESTAVEL quando possui entre 3 e 6 meses de cobertura", () => {
    const resultado = calcularRunway({
      liquidezTotalDisponivel: money(1200000, "BRL"), // R$ 12.000,00
      custoMensalEssencial: money(300000, "BRL"), // R$ 3.000,00 (4 meses = ~120 dias)
    });

    expect(resultado.diasAutonomia).toBe(120);
    expect(resultado.mesesAutonomia).toBe(4);
    expect(resultado.nivel).toBe("ESTAVEL");
  });

  it("classifica como INDEPENDENTE quando tem mais de 365 dias de autonomia", () => {
    const resultado = calcularRunway({
      liquidezTotalDisponivel: money(5000000, "BRL"), // R$ 50.000,00
      custoMensalEssencial: money(300000, "BRL"), // R$ 3.000,00 (16.6 meses = ~500 dias)
    });

    expect(resultado.diasAutonomia).toBeGreaterThan(365);
    expect(resultado.nivel).toBe("INDEPENDENTE");
  });

  it("trata valores zerados de forma segura", () => {
    const resultado = calcularRunway({
      liquidezTotalDisponivel: money(0, "BRL"),
      custoMensalEssencial: money(0, "BRL"),
    });

    expect(resultado.diasAutonomia).toBe(0);
    expect(resultado.nivel).toBe("CRITICO");
  });
});
