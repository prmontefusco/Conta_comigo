import {
  type Money,
  add,
  isPositive,
  multiply,
  subtract,
  zero,
} from "@/core/money/money";

export interface PortabilidadeContratoAtual {
  readonly instituicaoAtual: string;
  readonly saldoDevedor: Money;
  readonly parcelaAtual: Money;
  readonly parcelasRestantes: number;
  readonly taxaJurosMensal: number; // ex: 2.8%
  readonly cetAnual?: number;
}

export interface PortabilidadeNovaProposta {
  readonly novaInstituicao: string;
  readonly novaTaxaMensal: number; // ex: 1.6%
  readonly novasParcelasCount: number;
  readonly novaParcelaMensal: Money;
  /** Seguro prestamista embutido no saldo financiado pelo novo banco. */
  readonly seguroPrestamistaEmbutido?: Money;
  /** Tarifas de cadastro ou abertura de crédito embutidas. */
  readonly tarifasEmbutidas?: Money;
}

export interface AnalisePortabilidadeResultado {
  readonly instituicaoAtual: string;
  readonly novaInstituicao: string;
  readonly custoTotalRestanteAtual: Money;
  readonly custoTotalNovaProposta: Money;
  readonly economiaTotal: Money;
  readonly diferencaParcelaMensal: Money; // Atual - Nova (positivo = redução na parcela)
  readonly ehVantajosa: boolean;
  readonly detectouVendaCasada: boolean;
  readonly valorVendaCasadaTotal: Money;
  readonly cetRealEstimadoMensal: number;
  readonly recomendacao: string;
  readonly alertaVendaCasadaMensagem?: string;
}

/**
 * Avalia a viabilidade financeira e a legalidade da proposta de portabilidade de crédito.
 * Alerta sobre práticas abusivas de venda casada (Art. 39, I, da Lei 8.078/1990 - CDC).
 */
export function avaliarPortabilidadeCredito(
  atual: PortabilidadeContratoAtual,
  proposta: PortabilidadeNovaProposta,
): AnalisePortabilidadeResultado {
  const moeda = atual.saldoDevedor.currency;

  const custoTotalAtual = multiply(atual.parcelaAtual, atual.parcelasRestantes);
  const custoTotalProposta = multiply(proposta.novaParcelaMensal, proposta.novasParcelasCount);

  const economiaTotal = subtract(custoTotalAtual, custoTotalProposta);
  const diferencaParcela = subtract(atual.parcelaAtual, proposta.novaParcelaMensal);

  // Venda casada: seguros ou tarifas embutidas
  const seguro = proposta.seguroPrestamistaEmbutido ?? zero(moeda);
  const tarifas = proposta.tarifasEmbutidas ?? zero(moeda);
  const totalEmbutido = add(seguro, tarifas);
  const detectouVendaCasada = isPositive(totalEmbutido);

  // Se o novo banco embutiu encargos, a taxa real (CET) é superior à taxa nominal anunciada
  let cetRealEstimado = proposta.novaTaxaMensal;
  if (detectouVendaCasada && atual.saldoDevedor.amount > 0) {
    const proporcaoAcrescimo = totalEmbutido.amount / atual.saldoDevedor.amount;
    cetRealEstimado = Math.round((proposta.novaTaxaMensal * (1 + proporcaoAcrescimo)) * 100) / 100;
  }

  const ehVantajosa = isPositive(economiaTotal);

  let recomendacao: string;
  let alertaVendaCasadaMensagem: string | undefined;

  if (detectouVendaCasada) {
    alertaVendaCasadaMensagem =
      "ALERTA DE VENDA CASADA (Art. 39, I, do CDC): A nova proposta incluiu cobrança de seguro prestamista ou tarifas acessórias embutidas no financiamento. Você tem o direito legal de recusar essas contratações ou exigir a exclusão imediata do seguro, mantendo a redução da taxa de juros.";
  }

  if (ehVantajosa && !detectouVendaCasada) {
    recomendacao =
      "Portabilidade altamente recomendada. A nova taxa reduz tanto o desembolso mensal quanto o custo total da dívida, sem acréscimos indevidos.";
  } else if (ehVantajosa && detectouVendaCasada) {
    recomendacao =
      "A portabilidade é vantajosa, mas pode ser AINDA MELHOR se você exigir a retirada do seguro prestamista embutido, economizando mais no valor total.";
  } else {
    recomendacao =
      "Proposta desfavorável: O novo contrato alonga o prazo excessivamente ou encarece o custo final somado. Não assine esta proposta.";
  }

  return {
    instituicaoAtual: atual.instituicaoAtual,
    novaInstituicao: proposta.novaInstituicao,
    custoTotalRestanteAtual: custoTotalAtual,
    custoTotalNovaProposta: custoTotalProposta,
    economiaTotal,
    diferencaParcelaMensal: diferencaParcela,
    ehVantajosa,
    detectouVendaCasada,
    valorVendaCasadaTotal: totalEmbutido,
    cetRealEstimadoMensal: cetRealEstimado,
    recomendacao,
    alertaVendaCasadaMensagem,
  };
}
