/**
 * Os termos que o aplicativo usa e ninguém é obrigado a saber.
 *
 * O produto fala de competência, reserva protegida, CET, saldo livre. São
 * palavras necessárias — cada uma existe porque a alternativa era um número
 * errado —, mas nenhuma delas é de conhecimento geral. Quem chega aqui está
 * apertado e com pressa, e uma tela que exige vocabulário antes de ser útil
 * afasta exatamente quem mais precisa dela.
 *
 * ## Por que cada verbete tem duas partes
 *
 * `what` responde "o que é isto / o que eu escrevo aqui". `impact` responde
 * "no que isso mexe" — e é a parte que costuma faltar. Saber que CET é o custo
 * efetivo total não ajuda ninguém a decidir nada; saber que **deixá-lo em
 * branco não atrapalha o cálculo da parcela** é o que destrava o cadastro.
 *
 * ## Por que o texto mora no domínio
 *
 * Pela mesma razão que as mensagens de alerta moram em `alerts.ts`: é o que
 * permite testá-lo sem montar React, e o que garante que o mesmo termo tenha a
 * mesma explicação nas três telas onde aparece. Uma explicação que varia por
 * tela é pior que nenhuma.
 */

export type GlossaryTermId =
  | "SALDO_NAS_CONTAS"
  | "RESERVA_PROTEGIDA"
  | "SALDO_LIVRE"
  | "SALDO_NA_DATA"
  | "CHEQUE_ESPECIAL"
  | "VALOR_DESEMBOLSADO"
  | "CET"
  | "JUROS_AO_MES"
  | "PARCELAS_JA_PAGAS"
  | "COMPETENCIA"
  | "NATUREZA_DESPESA"
  | "CONFIANCA";

export interface GlossaryTerm {
  readonly id: GlossaryTermId;
  /** O nome como aparece na tela. */
  readonly term: string;
  /** O que é, ou o que escrever ali. Uma ou duas frases. */
  readonly what: string;
  /** No que isso mexe. É a parte que decide se a pessoa preenche ou desiste. */
  readonly impact: string;
}

const TERMS: Readonly<Record<GlossaryTermId, GlossaryTerm>> = {
  SALDO_NAS_CONTAS: {
    id: "SALDO_NAS_CONTAS",
    term: "Saldo nas contas",
    what: "Tudo o que existe hoje nas suas contas e na carteira, somado.",
    impact:
      "É o ponto de partida de toda projeção. Não desconta nada: o que já está prometido para contas deste mês aparece no saldo livre, logo ao lado.",
  },
  RESERVA_PROTEGIDA: {
    id: "RESERVA_PROTEGIDA",
    term: "Reserva protegida",
    what: "A parte do seu dinheiro que você marcou como intocável — emergência, remédio, o que for.",
    impact:
      "Continua sendo seu e continua no saldo das contas. A diferença é que ela sai do saldo livre, para você não gastar por engano o que tinha guardado com um propósito.",
  },
  SALDO_LIVRE: {
    id: "SALDO_LIVRE",
    term: "Saldo livre",
    what: "O saldo das contas menos a reserva protegida. É o dinheiro sobre o qual ainda dá para decidir.",
    impact:
      "É o número que responde 'posso gastar isto?'. Olhar só o saldo do banco é como as pessoas acabam usando dinheiro que já tinha destino.",
  },
  SALDO_NA_DATA: {
    id: "SALDO_NA_DATA",
    term: "Saldo na data de",
    what: "O dia a que o saldo informado se refere. Se você abriu o app do banco agora, é hoje.",
    impact:
      "A partir dessa data o aplicativo soma e subtrai tudo o que você lançar. Uma data errada faz o saldo de hoje aparecer errado, mesmo com o valor certo — é o campo que mais confunde, e o mais fácil de acertar: use o dia do extrato que você está olhando.",
  },
  CHEQUE_ESPECIAL: {
    id: "CHEQUE_ESPECIAL",
    term: "Limite de cheque especial",
    what: "Quanto o banco deixa você ficar negativo nessa conta. Deixe em branco se não usa ou não sabe.",
    impact:
      "Não é dinheiro seu e não entra em nenhum saldo. Serve só para o aplicativo avisar quando a projeção estiver caminhando para dentro do limite — que é dos juros mais caros que existem.",
  },
  VALOR_DESEMBOLSADO: {
    id: "VALOR_DESEMBOLSADO",
    term: "Valor que caiu na conta",
    what: "Quanto você realmente recebeu do empréstimo, já sem taxas descontadas na hora.",
    impact:
      "Costuma ser menor que o valor contratado, e a diferença é custo. Informar os dois é o que permite mostrar quanto o empréstimo custou de verdade. Se não souber, repita o valor contratado.",
  },
  CET: {
    id: "CET",
    term: "CET ao ano",
    what: "Custo Efetivo Total: o preço do empréstimo somando juros, tarifas e seguros. Vem no contrato, em porcentagem ao ano.",
    impact:
      "Serve para comparar dívidas e decidir qual atacar primeiro. Deixar em branco não atrapalha nada: parcela, saldo devedor e projeção são calculados sem ele.",
  },
  JUROS_AO_MES: {
    id: "JUROS_AO_MES",
    term: "Juros ao mês",
    what: "A taxa mensal do contrato, em porcentagem. Se você só tem a taxa anual, deixe em branco.",
    impact:
      "Com ela o aplicativo separa, em cada parcela, quanto abate a dívida e quanto é só juro. Sem ela a parcela e o total continuam certos; o que falta é essa divisão.",
  },
  PARCELAS_JA_PAGAS: {
    id: "PARCELAS_JA_PAGAS",
    term: "Parcelas que você já pagou",
    what: "Quantas parcelas foram pagas antes de você cadastrar esta dívida aqui.",
    impact:
      "É o que impede o aplicativo de tratar como atraso o que já foi pago. Um financiamento cadastrado na metade, sem esse número, aparece como se estivesse todo em aberto — e gera aviso de risco que não existe.",
  },
  COMPETENCIA: {
    id: "COMPETENCIA",
    term: "Competência e vencimento",
    what: "Vencimento é quando a conta tem de ser paga. Competência é o mês a que ela se refere — a luz de março que vence em abril tem competência de março.",
    impact:
      "O vencimento manda no fluxo de caixa e nos avisos de conta vencida. A competência manda nos relatórios de gasto por mês. Separar as duas é o que evita um mês parecer caro só porque duas contas caíram nele.",
  },
  NATUREZA_DESPESA: {
    id: "NATUREZA_DESPESA",
    term: "Tipo de despesa",
    what: "Fixa é a que se repete com o mesmo valor (aluguel). Variável muda todo mês (mercado, luz). Ocasional acontece de vez em quando (IPVA, presente).",
    impact:
      "Decide como a projeção estima os meses à frente: fixa é repetida igual, variável entra pela média dos últimos meses, ocasional não é presumida. Escolher errado não quebra nada — muda só o quanto o futuro é chutado.",
  },
  CONFIANCA: {
    id: "CONFIANCA",
    term: "Confirmado ou estimado",
    what: "Confirmado é valor que você já sabe (o aluguel do contrato). Estimado é o que você ainda vai descobrir (a comissão do mês).",
    impact:
      "A projeção mostra os dois, mas nunca apresenta um palpite como se fosse dinheiro garantido. Marcar como estimado é o que permite confiar no número quando ele diz que o mês fecha.",
  },
};

export function glossaryTerm(id: GlossaryTermId): GlossaryTerm {
  return TERMS[id];
}

export function allGlossaryTerms(): readonly GlossaryTerm[] {
  return Object.values(TERMS);
}
