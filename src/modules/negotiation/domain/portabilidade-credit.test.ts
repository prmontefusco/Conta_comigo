import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import { avaliarPortabilidadeCredito } from "./portabilidade-credit";

describe("portabilidade-credit domain", () => {
  it("aprova portabilidade legítima com taxa menor e redução real de custo", () => {
    const atual = {
      instituicaoAtual: "Banco Tradicional",
      saldoDevedor: money(1500000, "BRL"), // R$ 15.000,00
      parcelaAtual: money(65000, "BRL"), // R$ 650,00
      parcelasRestantes: 36,
      taxaJurosMensal: 2.5,
    };

    const proposta = {
      novaInstituicao: "Banco Digital",
      novaTaxaMensal: 1.5,
      novasParcelasCount: 36,
      novaParcelaMensal: money(52000, "BRL"), // R$ 520,00
    };

    const resultado = avaliarPortabilidadeCredito(atual, proposta);

    expect(resultado.ehVantajosa).toBe(true);
    expect(resultado.detectouVendaCasada).toBe(false);
    expect(resultado.diferencaParcelaMensal.amount).toBe(13000); // R$ 130/mês de alívio
    expect(resultado.economiaTotal.amount).toBe(13000 * 36); // R$ 4.680 total
  });

  it("detecta venda casada quando o novo banco embute seguro prestamista", () => {
    const atual = {
      instituicaoAtual: "Banco A",
      saldoDevedor: money(2000000, "BRL"),
      parcelaAtual: money(90000, "BRL"),
      parcelasRestantes: 40,
      taxaJurosMensal: 2.8,
    };

    const proposta = {
      novaInstituicao: "Banco B",
      novaTaxaMensal: 1.7,
      novasParcelasCount: 40,
      novaParcelaMensal: money(78000, "BRL"),
      seguroPrestamistaEmbutido: money(150000, "BRL"), // R$ 1.500,00 de seguro
    };

    const resultado = avaliarPortabilidadeCredito(atual, proposta);

    expect(resultado.detectouVendaCasada).toBe(true);
    expect(resultado.valorVendaCasadaTotal.amount).toBe(150000);
    expect(resultado.alertaVendaCasadaMensagem).toContain("VENDA CASADA (Art. 39, I, do CDC)");
    expect(resultado.cetRealEstimadoMensal).toBeGreaterThan(1.7);
  });
});
