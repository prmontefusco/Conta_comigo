import { describe, expect, it } from "vitest";
import { money, zero } from "@/core/money/money";
import {
  avaliarSuperendividamento,
  calcularMinimoExistencial,
  gerarPlanoRepactuacao60Meses,
  type CredorDividaItem,
  type DespesaEssencialItem,
  type GastoCortadoItem,
} from "./superendividamento";

describe("superendividamento domain (Lei 14.181/2021)", () => {
  const essenciaisExemplo: DespesaEssencialItem[] = [
    {
      id: "1",
      categoria: "MORADIA",
      descricao: "Aluguel e condomínio",
      valorMensal: money(150000, "BRL"), // R$ 1.500,00
    },
    {
      id: "2",
      categoria: "ALIMENTACAO",
      descricao: "Supermercado básico",
      valorMensal: money(120000, "BRL"), // R$ 1.200,00
    },
    {
      id: "3",
      categoria: "UTILIDADES",
      descricao: "Luz e água",
      valorMensal: money(35000, "BRL"), // R$ 350,00
    },
  ];

  const cortesExemplo: GastoCortadoItem[] = [
    {
      id: "c1",
      categoria: "STREAMING_APPS",
      descricao: "Netflix e Spotify cancelados",
      economiaMensal: money(8980, "BRL"), // R$ 89,80
    },
    {
      id: "c2",
      categoria: "DELIVERY_RESTAURANTES",
      descricao: "Refeições fora de casa suspensas",
      economiaMensal: money(40000, "BRL"), // R$ 400,00
    },
  ];

  const dividasExemplo: CredorDividaItem[] = [
    {
      id: "d1",
      instituicao: "Banco A",
      tipo: "EMPRESTIMO_CONSIGNADO",
      saldoDevedorEstimado: money(2000000, "BRL"), // R$ 20.000,00
      valorParcelaMensal: money(95000, "BRL"), // R$ 950,00
    },
    {
      id: "d2",
      instituicao: "Banco B",
      tipo: "CARTAO_ROTATIVO_OU_PARCELADO",
      saldoDevedorEstimado: money(1000000, "BRL"), // R$ 10.000,00
      valorParcelaMensal: money(80000, "BRL"), // R$ 800,00
    },
  ];

  it("calcula o mínimo existencial considerando dependentes e o piso legal", () => {
    const renda = money(400000, "BRL"); // R$ 4.000,00
    const essenciais = money(250000, "BRL"); // R$ 2.500,00

    // Com 2 dependentes, base legal é 600 + 2*300 = 1200. Mas essenciais é 2500, logo prevalece essenciais
    const min = calcularMinimoExistencial(renda, 2, essenciais);
    expect(min.amount).toBe(250000);

    // Se as despesas essenciais fossem menores que o mínimo legal, prevalece a base legal
    const essenciaisBaixas = money(80000, "BRL"); // R$ 800
    const minLegal = calcularMinimoExistencial(renda, 2, essenciaisBaixas);
    expect(minLegal.amount).toBe(120000); // R$ 1.200,00
  });

  it("identifica superendividamento crítico quando parcelas + essenciais invadem o salário", () => {
    // Renda R$ 4.000,00
    // Essenciais: 1500 + 1200 + 350 = 3.050,00
    // Parcelas: 950 + 800 = 1.750,00
    // Total mensal = 4.800,00 > 4.000,00 (Invade mínimo existencial)
    const resultado = avaliarSuperendividamento({
      rendaLiquidaMensal: money(400000, "BRL"),
      dependentesCount: 1,
      despesasEssenciais: essenciaisExemplo,
      gastosCortados: cortesExemplo,
      dividas: dividasExemplo,
      bens: [],
    });

    expect(resultado.status).toBe("SUPERENDIVIDADO_CRITICO");
    expect(resultado.enquadraNaLei14181).toBe(true);
    expect(resultado.totalParcelasAtuais.amount).toBe(175000);
    expect(resultado.totalEconomiaCortesRealizados.amount).toBe(48980);
    expect(resultado.margemDisponivelParaPagamento.amount).toBe(95000); // 4000 - 3050
  });

  it("gera rateio proporcional do plano de 60 meses respeitando a capacidade real", () => {
    const dividas: CredorDividaItem[] = [
      {
        id: "d1",
        instituicao: "Banco A",
        tipo: "EMPRESTIMO_PESSOAL",
        saldoDevedorEstimado: money(3000000, "BRL"), // R$ 30.000 (75%)
        valorParcelaMensal: money(150000, "BRL"),
      },
      {
        id: "d2",
        instituicao: "Banco B",
        tipo: "CHEQUE_ESPECIAL",
        saldoDevedorEstimado: money(1000000, "BRL"), // R$ 10.000 (25%)
        valorParcelaMensal: money(50000, "BRL"),
      },
    ];

    const margemDisponivel = money(100000, "BRL"); // R$ 1.000,00 por mês
    const totalPassivo = money(4000000, "BRL"); // R$ 40.000,00

    const plano = gerarPlanoRepactuacao60Meses(dividas, margemDisponivel, totalPassivo);

    expect(plano.prazoMeses).toBe(60);
    expect(plano.carenciaDias).toBe(180);
    expect(plano.credoresPropostas).toHaveLength(2);

    // Banco A tem 75% da dívida, deve receber R$ 750/mês
    const propostaA = plano.credoresPropostas.find((p) => p.credorId === "d1")!;
    expect(propostaA.parcelaPropostaMensal.amount).toBe(75000);
    expect(propostaA.totalAPagarEm60Meses.amount).toBe(75000 * 60);

    // Banco B tem 25% da dívida, deve receber R$ 250/mês
    const propostaB = plano.credoresPropostas.find((p) => p.credorId === "d2")!;
    expect(propostaB.parcelaPropostaMensal.amount).toBe(25000);
    expect(propostaB.totalAPagarEm60Meses.amount).toBe(25000 * 60);
  });

  it("trata cenários sem dívidas ou sem margem sem erros de divisão por zero", () => {
    const planoVazio = gerarPlanoRepactuacao60Meses([], zero("BRL"), zero("BRL"));
    expect(planoVazio.credoresPropostas).toHaveLength(0);
    expect(planoVazio.totalGeralRepactuado.amount).toBe(0);
  });
});
