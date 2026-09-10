import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import {
  CHECKLIST_DOCUMENTOS_EXIGIDOS,
  gerarTextoPeticaoInicial,
  type RequerimentoInicialInput,
} from "./peticao-inicial";
import { avaliarSuperendividamento } from "./superendividamento";

describe("peticao-inicial", () => {
  const essenciais = [
    {
      id: "e1",
      categoria: "MORADIA" as const,
      descricao: "Aluguel",
      valorMensal: money(120000),
    },
    {
      id: "e2",
      categoria: "ALIMENTACAO" as const,
      descricao: "Alimentação",
      valorMensal: money(100000),
    },
  ];

  const dividas = [
    {
      id: "d1",
      instituicao: "Banco A",
      tipo: "EMPRESTIMO_PESSOAL" as const,
      saldoDevedorEstimado: money(2000000),
      valorParcelaMensal: money(80000),
    },
    {
      id: "d2",
      instituicao: "Banco B",
      tipo: "CARTAO_ROTATIVO_OU_PARCELADO" as const,
      saldoDevedorEstimado: money(1000000),
      valorParcelaMensal: money(50000),
    },
  ];

  const cortes = [
    {
      id: "c1",
      categoria: "STREAMING_APPS" as const,
      descricao: "Netflix e Spotify",
      economiaMensal: money(8000),
      dataCorte: "Agosto/2026",
    },
  ];

  const diagnostico = avaliarSuperendividamento({
    rendaLiquidaMensal: money(300000),
    dependentesCount: 1,
    despesasEssenciais: essenciais,
    dividas,
    gastosCortados: cortes,
    bens: [],
  });

  const baseInput: RequerimentoInicialInput = {
    requerente: {
      nome: "João da Silva",
      cpf: "123.456.789-00",
      estadoCivil: "Casado",
      profissao: "Vendedor",
      email: "joao@email.com",
      telefone: "(11) 99999-9999",
      endereco: {
        logradouro: "Rua das Flores",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        uf: "SP",
        cep: "01001-000",
      },
    },
    motivoCrise: "Desemprego e juros abusivos de cartão de crédito.",
    diagnostico,
    essenciais,
    cortes,
    dependentesCount: 1,
    orgaoDestino: "CEJUSC",
  };

  it("gera o texto contendo endereçamento ao CEJUSC e qualificação completa", () => {
    const texto = gerarTextoPeticaoInicial(baseInput);

    expect(texto).toContain("CENTRO JUDICIÁRIO DE SOLUÇÃO DE CONFLITOS E CIDADANIA (CEJUSC)");
    expect(texto).toContain("JOÃO DA SILVA");
    expect(texto).toContain("123.456.789-00");
    expect(texto).toContain("Rua das Flores, nº 123");
    expect(texto).toContain("São Paulo - SP");
  });

  it("gera endereçamento correto quando o destino for PROCON", () => {
    const texto = gerarTextoPeticaoInicial({
      ...baseInput,
      orgaoDestino: "PROCON",
    });

    expect(texto).toContain("PROGRAMA DE PROTEÇÃO E DEFESA DO CONSUMIDOR (PROCON)");
    expect(texto).toContain("NÚCLEO DE APOIO AO SUPERENDIVIDADO");
  });

  it("inclui os artigos 54-A, 104-A e 104-B do CDC e a carência de 180 dias", () => {
    const texto = gerarTextoPeticaoInicial(baseInput);

    expect(texto).toContain("Art. 104-A");
    expect(texto).toContain("Art. 104-B");
    expect(texto).toContain("180 DIAS");
    expect(texto).toContain("Banco A");
    expect(texto).toContain("Banco B");
  });

  it("inclui aviso legal com escopo do software e ausência de garantia de resultado", () => {
    const texto = gerarTextoPeticaoInicial(baseInput);

    expect(texto).toContain("AVISO LEGAL E DECLARAÇÃO DE ESCOPO DO SOFTWARE");
    expect(texto).toContain("NÃO garante que o pedido seja aceito");
    expect(texto).toContain("suporte ao controle orçamentário");
  });

  it("possui checklist de documentos obrigatórios", () => {
    expect(CHECKLIST_DOCUMENTOS_EXIGIDOS.length).toBeGreaterThanOrEqual(6);
    expect(CHECKLIST_DOCUMENTOS_EXIGIDOS.every((d) => d.titulo && d.descricao)).toBe(true);
  });
});
