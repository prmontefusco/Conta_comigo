import {
  type Money,
  isPositive,
  subtract,
  zero,
} from "@/core/money/money";

export interface PortabilidadeContratoAtual {
  readonly instituicaoAtual: string;
  readonly custoTotalRestanteAtual: Money;
  readonly parcelaAtual: Money;
}

export interface PortabilidadeNovaProposta {
  readonly novaInstituicao: string;
  readonly custoTotalInformado: Money;
  readonly novaParcelaMensal?: Money;
  /** Custos adicionais informados pela pessoa ao ler a proposta. */
  readonly custosAdicionaisInformados?: Money;
}

export interface AnalisePortabilidadeResultado {
  readonly instituicaoAtual: string;
  readonly novaInstituicao: string;
  readonly custoTotalRestanteAtual: Money;
  readonly custoTotalNovaProposta: Money;
  readonly economiaTotal: Money;
  readonly diferencaParcelaMensal: Money | null; // Atual - Nova (positivo = redução na parcela)
  readonly totalPropostoMenor: boolean;
  readonly temCustosAdicionaisInformados: boolean;
  readonly custosAdicionaisInformados: Money;
  readonly comparacao: string;
}

/**
 * Compara os totais informados, sem concluir se uma proposta é adequada ou legal.
 */
export function avaliarPortabilidadeCredito(
  atual: PortabilidadeContratoAtual,
  proposta: PortabilidadeNovaProposta,
): AnalisePortabilidadeResultado {
  const moeda = atual.parcelaAtual.currency;

  const custoTotalAtual = atual.custoTotalRestanteAtual;
  const custoTotalProposta = proposta.custoTotalInformado;

  const economiaTotal = subtract(custoTotalAtual, custoTotalProposta);
  const diferencaParcela = proposta.novaParcelaMensal
    ? subtract(atual.parcelaAtual, proposta.novaParcelaMensal)
    : null;

  const custosAdicionaisInformados = proposta.custosAdicionaisInformados ?? zero(moeda);
  const totalPropostoMenor = isPositive(economiaTotal);
  const comparacao = totalPropostoMenor
    ? "Pelos valores informados, a soma das parcelas da proposta é menor. Confira se todos os custos estão incluídos nos valores e no prazo apresentados."
    : "Pelos valores informados, a soma das parcelas da proposta não é menor. Confira os valores, o prazo e os custos incluídos antes de comparar.";

  return {
    instituicaoAtual: atual.instituicaoAtual,
    novaInstituicao: proposta.novaInstituicao,
    custoTotalRestanteAtual: custoTotalAtual,
    custoTotalNovaProposta: custoTotalProposta,
    economiaTotal,
    diferencaParcelaMensal: diferencaParcela,
    totalPropostoMenor,
    temCustosAdicionaisInformados: isPositive(custosAdicionaisInformados),
    custosAdicionaisInformados,
    comparacao,
  };
}
