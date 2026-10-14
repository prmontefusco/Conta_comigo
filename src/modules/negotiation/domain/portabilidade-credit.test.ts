import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import { avaliarPortabilidadeCredito } from "./portabilidade-credit";

describe("portabilidade-credit domain", () => {
  it("compara a soma informada das parcelas atuais e da proposta", () => {
    const atual = {
      instituicaoAtual: "Banco Tradicional",
      custoTotalRestanteAtual: money(65000 * 36, "BRL"),
      parcelaAtual: money(65000, "BRL"), // R$ 650,00
    };

    const proposta = {
      novaInstituicao: "Banco Digital",
      custoTotalInformado: money(52000 * 36, "BRL"),
      novaParcelaMensal: money(52000, "BRL"), // R$ 520,00
    };

    const resultado = avaliarPortabilidadeCredito(atual, proposta);

    expect(resultado.totalPropostoMenor).toBe(true);
    expect(resultado.diferencaParcelaMensal.amount).toBe(13000); // R$ 130/mês de alívio
    expect(resultado.economiaTotal.amount).toBe(13000 * 36); // R$ 4.680 total
  });

  it("mostra custos adicionais sem classificar a cobrança nem estimar o CET", () => {
    const atual = {
      instituicaoAtual: "Banco A",
      custoTotalRestanteAtual: money(90000 * 40, "BRL"),
      parcelaAtual: money(90000, "BRL"),
    };

    const proposta = {
      novaInstituicao: "Banco B",
      custoTotalInformado: money(78000 * 40, "BRL"),
      novaParcelaMensal: money(78000, "BRL"),
      custosAdicionaisInformados: money(150000, "BRL"), // R$ 1.500,00 informados
    };

    const resultado = avaliarPortabilidadeCredito(atual, proposta);

    expect(resultado.temCustosAdicionaisInformados).toBe(true);
    expect(resultado.custosAdicionaisInformados.amount).toBe(150000);
    expect(resultado.comparacao).toContain("Pelos valores informados");
  });
});
