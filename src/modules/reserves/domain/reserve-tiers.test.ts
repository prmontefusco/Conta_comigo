import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import { calcularCamadasReserva } from "./reserve-tiers";

describe("reserve-tiers domain", () => {
  it("preenche primeiro a Camada 1 quando a reserva é pequena", () => {
    const custo = money(200000, "BRL"); // R$ 2.000,00
    const total = money(150000, "BRL"); // R$ 1.500,00

    const camadas = calcularCamadasReserva(custo, total);

    expect(camadas.camada1Imediata.valorAlocadoAtual.amount).toBe(150000);
    expect(camadas.camada1Imediata.percentualConcluido).toBe(75);
    expect(camadas.camada2CurtoPrazo.valorAlocadoAtual.amount).toBe(0);
    expect(camadas.camada3Oportunidades.valorAlocadoAtual.amount).toBe(0);
  });

  it("completa a Camada 1 e transborda para a Camada 2", () => {
    const custo = money(200000, "BRL"); // R$ 2.000,00
    const total = money(500000, "BRL"); // R$ 5.000,00 (2.000 em C1 + 3.000 em C2)

    const camadas = calcularCamadasReserva(custo, total);

    expect(camadas.camada1Imediata.valorAlocadoAtual.amount).toBe(200000);
    expect(camadas.camada1Imediata.percentualConcluido).toBe(100);

    expect(camadas.camada2CurtoPrazo.valorAlocadoAtual.amount).toBe(300000);
    expect(camadas.camada2CurtoPrazo.percentualConcluido).toBe(30); // 3000 de 10000 (5 meses * 2000)

    expect(camadas.camada3Oportunidades.valorAlocadoAtual.amount).toBe(0);
  });

  it("aloca excedente acima de 6 meses na Camada 3 de Oportunidades", () => {
    const custo = money(200000, "BRL"); // R$ 2.000,00
    // 6 meses de segurança = 12.000,00 (2.000 C1 + 10.000 C2). Total de 15.000,00 -> 3.000 em C3!
    const total = money(1500000, "BRL"); // R$ 15.000,00

    const camadas = calcularCamadasReserva(custo, total);

    expect(camadas.camada1Imediata.percentualConcluido).toBe(100);
    expect(camadas.camada2CurtoPrazo.percentualConcluido).toBe(100);
    expect(camadas.camada3Oportunidades.valorAlocadoAtual.amount).toBe(300000); // R$ 3.000,00
  });
});
