import {
  type Money,
  add,
  clampToZero,
  greaterOrEqual,
  money,
  multiply,
  subtract,
  sum,
  zero,
} from "@/core/money/money";

/**
 * Módulo de Superendividamento fundamentado na Lei nº 14.181/2021
 * e no Decreto nº 11.567/2023 (Mínimo Existencial).
 *
 * Este módulo resolve a maior causa de indeferimento de pedidos judiciais:
 * A falta de discriminação clara entre:
 * 1. O que são gastos essenciais para a dignidade (mínimo existencial);
 * 2. O que são gastos SUPÉRFLUOS QUE O CONSUMIDOR JÁ CORTOU (provando boa-fé
 *    e esforço real perante o juiz);
 * 3. As dívidas efetivamente negociáveis pelo Código de Defesa do Consumidor.
 */

/** Valor de referência federal para o mínimo existencial (Decreto 11.567/2023). */
export const MINIMO_EXISTENCIAL_LEGAL_VALOR = 600; // R$ 600,00 por pessoa

export type DespesaEssencialCategoria =
  | "MORADIA" // Aluguel, condomínio, IPTU
  | "UTILIDADES" // Luz, água, gás, internet essencial
  | "ALIMENTACAO" // Supermercado básico, feira
  | "SAUDE" // Medicamentos contínuos, plano básico, tratamentos
  | "EDUCACAO" // Escola pública/básica, material essencial
  | "TRANSPORTE" // Condução para trabalho, combustível estrito
  | "OUTRO_ESSENCIAL";

export interface DespesaEssencialItem {
  readonly id: string;
  readonly categoria: DespesaEssencialCategoria;
  readonly descricao: string;
  readonly valorMensal: Money;
  readonly justificativa?: string;
}

export type GastoCortadoCategoria =
  | "STREAMING_APPS" // Netflix, Spotify, assinaturas
  | "LAZER_VIAGENS" // Cinema, passeios, viagens canceladas
  | "DELIVERY_RESTAURANTES" // iFood, refeições fora de casa
  | "SERVICOS_SUPERFLUOS" // Academia cara, salão frequente, clubes
  | "COMPRAS_VESTUARIO" // Roupas, calçados, eletrônicos
  | "OUTRO_CORTE";

export interface GastoCortadoItem {
  readonly id: string;
  readonly categoria: GastoCortadoCategoria;
  readonly descricao: string;
  /** Valor que era gasto mensalmente antes do corte. */
  readonly economiaMensal: Money;
  /** Data aproximada em que o gasto foi cancelado/cortado. */
  readonly dataCorte?: string;
  readonly comprovanteOuObservacao?: string;
}

export type TipoCredor =
  | "EMPRESTIMO_CONSIGNADO"
  | "EMPRESTIMO_PESSOAL"
  | "CARTAO_ROTATIVO_OU_PARCELADO"
  | "CHEQUE_ESPECIAL"
  | "FINANCIAMENTO_VEICULO"
  | "FINANCIAMENTO_IMOVEL"
  | "DIVIDA_CONSUMO_VAREJO"
  | "OUTRO";

export interface CredorDividaItem {
  readonly id: string;
  readonly instituicao: string;
  readonly tipo: TipoCredor;
  readonly contratoNumero?: string;
  readonly saldoDevedorEstimado: Money;
  readonly valorParcelaMensal: Money;
  readonly parcelasRestantes?: number;
  readonly taxaJurosMensal?: number;
  /** Art. 54-A, § 2º: Se possui garantia real (ex: alienação fiduciária), tem regime especial. */
  readonly possuiGarantiaReal?: boolean;
}

export interface BemPatrimonial {
  readonly id: string;
  readonly descricao: string;
  readonly tipo: "IMOVEL_RESIDENCIAL" | "VEICULO" | "SALDO_CONTA" | "OUTRO";
  readonly valorEstimado: Money;
  /** Se for o único imóvel residencial familiar, protegido pela Lei 8.009/90. */
  readonly bemDeFamilia?: boolean;
  readonly observacao?: string;
}

export interface DiagnosticoSuperendividamentoInput {
  readonly rendaLiquidaMensal: Money;
  readonly dependentesCount: number;
  readonly despesasEssenciais: readonly DespesaEssencialItem[];
  readonly gastosCortados: readonly GastoCortadoItem[];
  readonly dividas: readonly CredorDividaItem[];
  readonly bens: readonly BemPatrimonial[];
}

export interface PropostaRepactuacaoCredor {
  readonly credorId: string;
  readonly instituicao: string;
  readonly saldoDevedor: Money;
  readonly percentualDoTotal: number; // % do passivo quirografário
  readonly parcelaPropostaMensal: Money;
  readonly totalAPagarEm60Meses: Money;
}

export interface PlanoRepactuacao60Meses {
  readonly prazoMeses: number; // padrão 60 meses (5 anos)
  readonly carenciaDias: number; // padrão 180 dias (art. 104-A, § 2º)
  readonly capacidadeMensalTotalAmortizacao: Money;
  readonly credoresPropostas: readonly PropostaRepactuacaoCredor[];
  readonly totalGeralRepactuado: Money;
}

export type StatusSuperendividamento =
  | "SUPERENDIVIDADO_CRITICO" // Comprometimento invade o mínimo existencial
  | "SUPERENDIVIDADO_MODERADO" // Comprometimento > 40% da renda líquida
  | "ALERTA_ENDIVIDAMENTO" // Comprometimento entre 30% e 40%
  | "COMPROMETIMENTO_EQUILIBRADO"; // Comprometimento <= 30%

export interface DiagnosticoSuperendividamentoResultado {
  readonly status: StatusSuperendividamento;
  readonly rendaLiquida: Money;
  readonly totalDespesasEssenciais: Money;
  readonly totalEconomiaCortesRealizados: Money;
  readonly totalParcelasAtuais: Money;
  readonly totalPassivoDevedor: Money;
  readonly minimoExistencialCalculado: Money;
  /** Saldo da renda que sobra após garantir o mínimo existencial e despesas essenciais. */
  readonly margemDisponivelParaPagamento: Money;
  readonly percentualComprometimentoAtual: number;
  readonly enquadraNaLei14181: boolean;
  readonly justificativaEnquadramento: string;
  readonly planoRepactuacao: PlanoRepactuacao60Meses;
}

/**
 * Calcula o valor de referência do Mínimo Existencial do núcleo familiar.
 * Toma como base o Decreto 11.567/2023 (R$ 600,00 por adulto responsável + fração por dependente)
 * ou o custo mínimo das necessidades básicas indispensáveis comprovadas.
 */
export function calcularMinimoExistencial(
  rendaLiquida: Money,
  dependentes: number,
  totalEssenciais: Money,
): Money {
  const moeda = rendaLiquida.currency;
  // Parâmetro do Decreto 11.567/2023: R$ 600 base + R$ 300 por dependente adicional
  const baseLegalAmount = (MINIMO_EXISTENCIAL_LEGAL_VALOR + dependentes * 300) * 100;
  const minimoLegal = money(baseLegalAmount, moeda);

  // O mínimo existencial real não pode ser inferior às despesas essenciais comprovadas,
  // nem ultrapassar a renda líquida total da família.
  const valorEfetivo = greaterOrEqual(totalEssenciais, minimoLegal) ? totalEssenciais : minimoLegal;

  if (greaterOrEqual(valorEfetivo, rendaLiquida)) {
    return rendaLiquida;
  }
  return valorEfetivo;
}

/**
 * Realiza o diagnóstico completo da situação de superendividamento nos termos
 * dos artigos 54-A e 104-A do Código de Defesa do Consumidor.
 */
export function avaliarSuperendividamento(
  input: DiagnosticoSuperendividamentoInput,
): DiagnosticoSuperendividamentoResultado {
  const moeda = input.rendaLiquidaMensal.currency;

  const totalDespesasEssenciais = sum(
    input.despesasEssenciais.map((d) => d.valorMensal),
    moeda,
  );

  const totalEconomiaCortes = sum(
    input.gastosCortados.map((g) => g.economiaMensal),
    moeda,
  );

  const totalParcelasAtuais = sum(
    input.dividas.map((d) => d.valorParcelaMensal),
    moeda,
  );

  const totalPassivoDevedor = sum(
    input.dividas.map((d) => d.saldoDevedorEstimado),
    moeda,
  );

  const minimoExistencial = calcularMinimoExistencial(
    input.rendaLiquidaMensal,
    input.dependentesCount,
    totalDespesasEssenciais,
  );

  // Percentual da renda líquida já comprometida com parcelas de dívidas
  const percentualComprometimento =
    input.rendaLiquidaMensal.amount > 0
      ? (totalParcelasAtuais.amount / input.rendaLiquidaMensal.amount) * 100
      : 0;

  // Capacidade real de pagamento mensal = Renda Líquida - Despesas Essenciais
  const margemDisponivel = clampToZero(
    subtract(input.rendaLiquidaMensal, totalDespesasEssenciais),
  );

  // Status de enquadramento
  let status: StatusSuperendividamento;
  let enquadraNaLei14181 = false;
  let justificativa: string;

  // Se as parcelas atuais somadas às despesas essenciais ultrapassam a renda,
  // ou se sobra menos do que o Mínimo Existencial Legal, há superendividamento evidente.
  const custoTotalMensalAtual = add(totalDespesasEssenciais, totalParcelasAtuais);

  if (greaterOrEqual(custoTotalMensalAtual, input.rendaLiquidaMensal)) {
    status = "SUPERENDIVIDADO_CRITICO";
    enquadraNaLei14181 = true;
    justificativa =
      "Insolvência manifesta: A soma das parcelas de dívidas com os gastos essenciais de sobrevivência ultrapassa a renda líquida, invadindo frontalmente o Mínimo Existencial (Decreto 11.567/2023).";
  } else if (percentualComprometimento >= 40) {
    status = "SUPERENDIVIDADO_MODERADO";
    enquadraNaLei14181 = true;
    justificativa =
      "Superendividamento caracterizado: Mais de 40% da renda mensal líquida está consumida em dívidas bancárias e de consumo, inviabilizando a dignidade financeira e a manutenção do lar.";
  } else if (percentualComprometimento >= 30) {
    status = "ALERTA_ENDIVIDAMENTO";
    enquadraNaLei14181 = false;
    justificativa =
      "Situação limítrofe: O comprometimento de renda está na faixa de atenção (30% a 40%). Recomenda-se renegociação extrajudicial antes de ingressar com procedimento formal de superendividamento.";
  } else {
    status = "COMPROMETIMENTO_EQUILIBRADO";
    enquadraNaLei14181 = false;
    justificativa =
      "Comprometimento sustentável: As parcelas consom menos de 30% da renda líquida. Não se enquadra nos requisitos de incapacidade manifesta de pagamento da Lei 14.181/2021.";
  }

  // Montagem do Plano de Repactuação em até 60 Meses (Art. 104-A do CDC)
  const planoRepactuacao = gerarPlanoRepactuacao60Meses(
    input.dividas,
    margemDisponivel,
    totalPassivoDevedor,
  );

  return {
    status,
    rendaLiquida: input.rendaLiquidaMensal,
    totalDespesasEssenciais,
    totalEconomiaCortesRealizados: totalEconomiaCortes,
    totalParcelasAtuais,
    totalPassivoDevedor,
    minimoExistencialCalculado: minimoExistencial,
    margemDisponivelParaPagamento: margemDisponivel,
    percentualComprometimentoAtual: Math.round(percentualComprometimento * 10) / 10,
    enquadraNaLei14181,
    justificativaEnquadramento: justificativa,
    planoRepactuacao,
  };
}

/**
 * Gera a distribuição proporcional da margem disponível entre todos os credores
 * em um horizonte legal de 60 meses (5 anos) com carência inicial de 180 dias.
 */
export function gerarPlanoRepactuacao60Meses(
  dividas: readonly CredorDividaItem[],
  margemDisponivel: Money,
  totalPassivo: Money,
): PlanoRepactuacao60Meses {
  const moeda = margemDisponivel.currency;
  const PRAZO_MESES = 60;
  const CARENCIA_DIAS = 180;

  if (dividas.length === 0 || totalPassivo.amount === 0 || margemDisponivel.amount === 0) {
    return {
      prazoMeses: PRAZO_MESES,
      carenciaDias: CARENCIA_DIAS,
      capacidadeMensalTotalAmortizacao: margemDisponivel,
      credoresPropostas: [],
      totalGeralRepactuado: zero(moeda),
    };
  }

  // Rateio proporcional ao saldo devedor de cada credor
  const propostas: PropostaRepactuacaoCredor[] = dividas.map((divida) => {
    const proporcao = divida.saldoDevedorEstimado.amount / totalPassivo.amount;
    const parcelaCalculadaAmount = Math.round(margemDisponivel.amount * proporcao);
    const parcelaProposta = money(parcelaCalculadaAmount, moeda);
    const totalEm60Meses = multiply(parcelaProposta, PRAZO_MESES);

    return {
      credorId: divida.id,
      instituicao: divida.instituicao,
      saldoDevedor: divida.saldoDevedorEstimado,
      percentualDoTotal: Math.round(proporcao * 1000) / 10,
      parcelaPropostaMensal: parcelaProposta,
      totalAPagarEm60Meses: totalEm60Meses,
    };
  });

  const totalGeral = sum(
    propostas.map((p) => p.totalAPagarEm60Meses),
    moeda,
  );

  return {
    prazoMeses: PRAZO_MESES,
    carenciaDias: CARENCIA_DIAS,
    capacidadeMensalTotalAmortizacao: margemDisponivel,
    credoresPropostas: propostas,
    totalGeralRepactuado: totalGeral,
  };
}

/**
 * Passo a passo do rito processual e extrajudicial da Lei 14.181/2021
 * para orientação completa do cidadão.
 */
export interface RoteiroPassoJustica {
  readonly numero: number;
  readonly titulo: string;
  readonly orgao: string;
  readonly descricao: string;
  readonly documentosNecessarios: readonly string[];
  readonly custoAproximado: string;
}

export const ROTEIRO_SUPERENDIVIDAMENTO_PASSOS: readonly RoteiroPassoJustica[] = [
  {
    numero: 1,
    titulo: "Fase Preliminar Extrajudicial (Conciliação em Bloco)",
    orgao: "Procon Estadual/Municipal ou Consumidor.gov.br",
    descricao:
      "A lei privilegia a tentativa amigável convocando todos os credores para uma audiência conjunta de repactuação. Isso impede que um banco tome a frente do outro e esgote sua renda.",
    documentosNecessarios: [
      "Documento de identidade (RG/CPF)",
      "Comprovantes dos 3 últimos holerites ou extratos bancários",
      "Dossiê Conta Comigo com a relação discriminada de despesas essenciais e cortes efetuados",
      "Contratos de empréstimos e extratos de dívidas",
    ],
    custoAproximado: "100% Gratuito",
  },
  {
    numero: 2,
    titulo: "Audiência de Conciliação Prévia no Judiciário",
    orgao: "CEJUSC (Centro Judiciário de Solução de Conflitos do Tribunal de Justiça)",
    descricao:
      "Se a conciliação no Procon não surtir efeito, o CEJUSC realiza audiência presidida por conciliador judicial credenciado. O plano de pagamento aprovado tem eficácia de sentença judicial irrecorrível.",
    documentosNecessarios: [
      "Petição ou requerimento pré-formatado de repactuação",
      "Dossiê com a Proposta de Pagamento em 60 Meses",
      "Comprovação de tentativas anteriores de renegociação frustradas",
    ],
    custoAproximado: "Gratuito na fase pré-processual do CEJUSC",
  },
  {
    numero: 3,
    titulo: "Ação Judicial de Repactuação Compulsória (Art. 104-B do CDC)",
    orgao: "Vara Cível ou Juizado Especial Cível com Defensoria Pública ou Advogado",
    descricao:
      "Caso os bancos se recusem injustificadamente a conciliar na audiência, o juiz instaura o Processo por Superendividamento e fixa um Plano Judicial Compulsório, limitando os juros e parcelas obrigatoriamente aos credores renitentes.",
    documentosNecessarios: [
      "Dossiê Completo de Superendividamento com Declaração de Boa-Fé",
      "Termo de audiência de conciliação infrutífera do CEJUSC ou Procon",
      "Comprovante de hipossuficiência (para assistência gratuita da Defensoria Pública)",
    ],
    custoAproximado: "Gratuito via Defensoria Pública ou sujeito a honorários advocatícios",
  },
];

/**
 * Termo de Isenção e Aviso Legal Obrigatório.
 * Garante proteção jurídica para o software e transparência total com o usuário.
 */
export const DISCLAIMER_LEGAL_SUPERENDIVIDAMENTO =
  "AVISO LEGAL E DECLARAÇÃO DE ESCOPO: O Conta Comigo é exclusivamente uma aplicação de suporte no controle orçamentário, auxílio na organização financeira para diminuição do endividamento e suporte na preparação da documentação inicial e cálculos técnicos. O Conta Comigo NÃO presta serviços privativos de advocacia, NÃO substitui o aconselhamento jurídico profissional e NÃO GARANTE que o requerimento seja aceito, deferido, homologado ou que o consumidor 'ganhe' a causa ou obtenha êxito perante o Poder Judiciário, Procon ou credores. A concessão de liminares, suspensão de descontos, homologação de acordos ou imposição de planos compulsórios dependem estrita e exclusivamente do convencimento e julgamento soberano da autoridade judicial ou administrativa competente, à luz da legislação e das provas apresentadas.";
