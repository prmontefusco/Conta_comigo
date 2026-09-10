import { formatMoney } from "@/core/money/format";
import type {
  DespesaEssencialItem,
  DiagnosticoSuperendividamentoResultado,
  GastoCortadoItem,
} from "./superendividamento";

export type OrgaoDestino = "CEJUSC" | "PROCON" | "DEFENSORIA";

export interface RequerenteInfo {
  readonly nome: string;
  readonly cpf?: string;
  readonly estadoCivil?: string;
  readonly profissao?: string;
  readonly email?: string;
  readonly telefone?: string;
  readonly endereco?: {
    readonly logradouro?: string;
    readonly numero?: string;
    readonly complemento?: string;
    readonly bairro?: string;
    readonly cidade?: string;
    readonly uf?: string;
    readonly cep?: string;
  };
}

export interface RequerimentoInicialInput {
  readonly requerente: RequerenteInfo;
  readonly motivoCrise: string;
  readonly narrativaFatica?: string;
  readonly diagnostico: DiagnosticoSuperendividamentoResultado;
  readonly essenciais: readonly DespesaEssencialItem[];
  readonly cortes: readonly GastoCortadoItem[];
  readonly dependentesCount: number;
  readonly orgaoDestino?: OrgaoDestino;
}

export interface DocumentoExigido {
  readonly titulo: string;
  readonly descricao: string;
  readonly obrigatorio: boolean;
}

export const CHECKLIST_DOCUMENTOS_EXIGIDOS: readonly DocumentoExigido[] = [
  {
    titulo: "Documento de Identidade e CPF",
    descricao: "RG, CNH ou Carteira de Trabalho com foto e inscrição no CPF.",
    obrigatorio: true,
  },
  {
    titulo: "Comprovante de Residência Atualizado",
    descricao: "Conta de água, luz, gás ou telefone emitida nos últimos 60 a 90 dias.",
    obrigatorio: true,
  },
  {
    titulo: "Comprovantes de Rendimentos Recentes",
    descricao:
      "Holerites, contracheques ou extratos do benefício do INSS dos últimos 3 meses (ou extrato bancário para autônomos).",
    obrigatorio: true,
  },
  {
    titulo: "Extratos Bancários Completos dos Últimos 90 Dias",
    descricao:
      "Extrato de todas as contas bancárias em que recebe salário ou onde ocorrem débitos automáticos.",
    obrigatorio: true,
  },
  {
    titulo: "Contratos e Extratos das Dívidas e Empréstimos",
    descricao:
      "Cópia dos contratos de empréstimo (especialmente consignados), faturas recentes de cartão e extratos do cheque especial.",
    obrigatorio: true,
  },
  {
    titulo: "Comprovantes das Despesas Básicas Essenciais",
    descricao:
      "Recibos de aluguel ou taxa de condomínio, contas de consumo (água, energia, gás) e notas de medicamentos de uso contínuo.",
    obrigatorio: true,
  },
  {
    titulo: "Dossiê Técnico e Plano de Repactuação do Conta Comigo",
    descricao:
      "Relatório contábil gerado pelo aplicativo comprovando o Mínimo Existencial e o cálculo do rateio em até 60 meses.",
    obrigatorio: true,
  },
];

/**
 * Gera o texto formal da Petição Inicial / Requerimento de Repactuação
 * nos moldes dos artigos 104-A, 104-B e 104-C do Código de Defesa do Consumidor (Lei nº 14.181/2021).
 */
export function gerarTextoPeticaoInicial(input: RequerimentoInicialInput): string {
  const {
    requerente,
    motivoCrise,
    narrativaFatica,
    diagnostico,
    essenciais,
    cortes,
    dependentesCount,
    orgaoDestino = "CEJUSC",
  } = input;

  const cidade = requerente.endereco?.cidade || "[CIDADE]";
  const uf = requerente.endereco?.uf || "[UF]";
  const enderecoCompleto = requerente.endereco?.logradouro
    ? `${requerente.endereco.logradouro}, nº ${requerente.endereco.numero || "S/N"}${
        requerente.endereco.complemento ? ` (${requerente.endereco.complemento})` : ""
      }, Bairro ${requerente.endereco.bairro || ""}, ${cidade} - ${uf}, CEP ${
        requerente.endereco.cep || ""
      }`
    : "[ENDEREÇO COMPLETO DO REQUERENTE]";

  // Cabeçalho de endereçamento
  let enderecamento = "";
  if (orgaoDestino === "CEJUSC") {
    enderecamento = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) COORDENADOR(A) DO CENTRO JUDICIÁRIO DE SOLUÇÃO DE CONFLITOS E CIDADANIA (CEJUSC) DA COMARCA DE ${cidade.toUpperCase()} - ${uf.toUpperCase()}`;
  } else if (orgaoDestino === "PROCON") {
    enderecamento = `AO ILUSTRÍSSIMO DIRETOR DO PROGRAMA DE PROTEÇÃO E DEFESA DO CONSUMIDOR (PROCON) - NÚCLEO DE APOIO AO SUPERENDIVIDADO DE ${cidade.toUpperCase()} - ${uf.toUpperCase()}`;
  } else {
    enderecamento = `À DEFENSORIA PÚBLICA DO ESTADO DE ${uf.toUpperCase()} - NÚCLEO DE DEFESA DO CONSUMIDOR (NUDECON) - COMARCA DE ${cidade.toUpperCase()}`;
  }

  // Tabela de credores em texto
  const linhasCredores = diagnostico.planoRepactuacao.credoresPropostas
    .map(
      (p, i) =>
        `   ${i + 1}. ${p.instituicao.padEnd(25)} | Saldo: ${formatMoney(
          p.saldoDevedor,
        ).padStart(12)} | %: ${p.percentualDoTotal.toString().padStart(5)}% | Parcela 60m: ${formatMoney(
          p.parcelaPropostaMensal,
        ).padStart(12)} | Total 5 anos: ${formatMoney(p.totalAPagarEm60Meses)}`,
    )
    .join("\n");

  // Tabela de despesas essenciais em texto
  const linhasEssenciais = essenciais
    .map(
      (e) =>
        `   - ${e.descricao.padEnd(35)}: ${formatMoney(e.valorMensal)} (${e.categoria})`,
    )
    .join("\n");

  // Tabela de cortes realizados
  const linhasCortes =
    cortes.length > 0
      ? cortes
          .map(
            (c) =>
              `   - ${c.descricao.padEnd(35)}: Economia de ${formatMoney(
                c.economiaMensal,
              )}/mês (${c.dataCorte || "Cancelado"})`,
          )
          .join("\n")
      : "   - Medidas gerais de austeridade e renúncia de despesas de lazer e conveniência.";

  const dataAtual = new Date().toLocaleDateString("pt-BR");

  return `${enderecamento}

REQUERIMENTO DE INSTAURAÇÃO DO PROCESSO DE REPACTUAÇÃO DE DÍVIDAS
(Fundamentado nos Arts. 54-A, 104-A e seguintes do Código de Defesa do Consumidor, com redação dada pela Lei Federal nº 14.181/2021)

I. DA QUALIFICAÇÃO DO REQUERENTE
${requerente.nome.toUpperCase()}, brasileiro(a), ${requerente.estadoCivil || "estado civil não informado"}, ${requerente.profissao || "profissão não informada"}, portador(a) do CPF nº ${requerente.cpf || "[CPF NÃO INFORMADO]"}, residente e domiciliado(a) em ${enderecoCompleto}, telefone/WhatsApp: ${requerente.telefone || "não informado"}, e-mail: ${requerente.email || "não informado"}, vem, respeitosamente, perante este órgão/juízo, expor e requerer o quanto segue:

II. DA GRATUIDADE DA JUSTIÇA E ASSISTÊNCIA INTEGRAL
O(A) Requerente declara, para os devidos fins de direito, sob as penas da lei (Art. 98 do Código de Processo Civil), que se encontra em situação de manifesta hipossuficiência econômica, agravada pelo quadro de superendividamento involuntário que ora se expõe, não possuindo recursos financeiros para arcar com custas ou despesas procedimentais sem prejuízo da alimentação e sustento próprio e de seu núcleo familiar.

III. DOS FATOS E DO HISTÓRICO DA CRISE FINANCEIRA (BOA-FÉ)
O(A) Requerente é consumidor(a) de boa-fé. Todas as obrigações contraídas tiveram como escopo o consumo pessoal e familiar, inexistindo qualquer intuito fraudulento ou contração dolosa de débitos para inadimplemento.

A superveniência da crise econômico-financeira decorreu de fatores alheios à sua vontade, notadamente:
"${motivoCrise}"

${narrativaFatica ? `Conforme fundamentação fática detalhada:\n${narrativaFatica}\n` : ""}
IV. DA PROTEÇÃO CONSTITUCIONAL DO MÍNIMO EXISTENCIAL (DECRETO Nº 11.567/2023)
O Art. 54-A, § 1º, do CDC define o superendividamento como a impossibilidade manifesta de o consumidor pessoa física, de boa-fé, pagar a totalidade de suas dívidas de consumo sem comprometer o seu mínimo existencial.

No caso em tela, a situação financeira encontra-se cabalmente demonstrada:
- Renda Mensal Líquida Comprovada: ${formatMoney(diagnostico.rendaLiquida)}
- Dependentes do Núcleo Familiar: ${dependentesCount} pessoa(s)
- Custo Mensal das Despesas Básicas Essenciais (Moradia, Alimentação, Saúde): ${formatMoney(diagnostico.totalDespesasEssenciais)}
- Parcelas Mensais Cobradas Atualmente pelos Credores: ${formatMoney(diagnostico.totalParcelasAtuais)}
- Sobra Real Disponível para Pagamento das Dívidas: ${formatMoney(diagnostico.margemDisponivelParaPagamento)}

Demonstração das despesas essenciais que garantem a dignidade humana:
${linhasEssenciais}

V. DA DEMONSTRAÇÃO CONCRETA DE BOA-FÉ: MEDIDAS DE AUSTERIDADE JÁ ADOTADAS
Para comprovar que o(a) Requerente não mantém padrão de consumo incompatível, junta-se o rol de serviços, assinaturas e gastos voluntariamente cortados, que geraram uma contenção de ${formatMoney(diagnostico.totalEconomiaCortesRealizados)} ao mês:
${linhasCortes}

VI. DO QUADRO GERAL DE CREDORES E DO PLANO DE REPACTUAÇÃO (ART. 104-A DO CDC)
O saldo devedor consolidado alcança ${formatMoney(diagnostico.totalPassivoDevedor)}. Em estrita consonância com o Art. 104-A da Lei nº 14.181/2021, apresenta-se proposta viável de quitação em até 5 ANOS (60 MESES), com carência inicial de 180 DIAS (6 MESES), mediante rateio proporcional da margem disponível:

${linhasCredores}

TOTAL REPACTUADO EM 60 MESES: ${formatMoney(diagnostico.planoRepactuacao.totalGeralRepactuado)}

VII. DOS PEDIDOS
Diante de todo o exposto, REQUER a Vossa Excelência / a este digno Órgão:

1. O deferimento dos benefícios da GRATUIDADE DA JUSTIÇA, nos termos do art. 98 do CPC;
2. A INSTAURAÇÃO DO PROCEDIMENTO CONCILIATÓRIO DE REPACTUAÇÃO DE DÍVIDAS, previsto no Art. 104-A do CDC;
3. A NOTIFICAÇÃO E INTIMAÇÃO DE TODOS OS CREDORES acima relacionados para que compareçam à AUDIÊNCIA CONCILIATÓRIA CONJUNTA, a ser designada em dia e hora por este órgão;
4. A expressa advertência aos credores de que o NÃO COMPARECIMENTO INJUSTIFICADO à audiência acarretará a SUSPENSÃO DA EXIGIBILIDADE DO DÉBITO e a INTERRUPÇÃO DA CONTAGEM DOS JUROS DE MORA, ficando ainda o credor faltoso sujeito à aceitação compulsória do plano e estipulação de pagamento apenas após a quitação dos demais credores presentes (Art. 104-A, § 2º, CDC);
5. A homologação do acordo de repactuação por termo com eficácia de título executivo judicial;
6. Subsidiariamente, caso não haja êxito na conciliação integral com os credores, requer-se a instauração de processo por superendividamento para a elaboração de PLANO JUDICIAL COMPULSÓRIO, com fundamento no Art. 104-B do Código de Defesa do Consumidor.

Nestes termos,
Pede e espera deferimento.

${cidade} - ${uf}, ${dataAtual}.


_______________________________________________________
${requerente.nome.toUpperCase()}
CPF: ${requerente.cpf || "___________________________"}


================================================================================
[AVISO LEGAL E DECLARAÇÃO DE ESCOPO DO SOFTWARE]
Esta minuta foi elaborada com o auxílio da aplicação Conta Comigo, com base estrita nos dados e declarações fornecidos pelo(a) requerente. O Conta Comigo atua exclusivamente como ferramenta de suporte ao controle orçamentário, auxílio na organização financeira para redução do endividamento familiar e apoio na estruturação da documentação inicial e cálculos instrutórios. O software NÃO presta consultoria jurídica privativa, NÃO substitui o exame por advogado ou defensor público e NÃO garante que o pedido seja aceito, deferido, homologado ou que haja ganho de causa, cabendo a deliberação soberana exclusivamente ao juízo ou órgão administrativo competente.
================================================================================`;
}
