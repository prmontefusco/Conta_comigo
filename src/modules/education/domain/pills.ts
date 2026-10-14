/**
 * Short, practical guidance, shown where the situation actually is.
 *
 * A page of financial education that lives on the marketing site reaches
 * people who already went looking. What changes a decision is a sentence about
 * rotativo on the screen where the fatura is overdue - so every pill here
 * declares the condition it belongs to, and the app shows only the ones that
 * are true right now.
 *
 * Rules the content follows:
 *
 * - It explains a mechanism, never a product. No CDB, no consórcio, no
 *   "invista em"; the terms of use forbid recommending investments and the
 *   product exists to explain the person's own numbers.
 * - It never says the household did badly. These people usually believe that
 *   already, and it is not the software's job to confirm it.
 * - It states what to do next in one step, or nothing at all.
 */

export type PillTopic =
  "ROTATIVO" | "CARTAO" | "JUROS" | "DIVIDA" | "RESERVA" | "ORCAMENTO" | "DIREITOS";

export interface PillContext {
  /** A card statement is past its due date and still open. */
  readonly hasOverdueStatement: boolean;
  /** Highest committed share of any card limit, 0 to 1+. */
  readonly highestCardUtilisation: number;
  readonly hasOverdraftDebt: boolean;
  readonly debtsWithoutKnownRate: number;
  readonly hasCollateralDebt: boolean;
  readonly hasEssentialBillOverdue: boolean;
  readonly starterReserveComplete: boolean;
  readonly hasBudgetForThisMonth: boolean;
  readonly overspentCategories: number;
  /** Average monthly result. Negative means the month closes short. */
  readonly monthlyNetAmount: number;
  /** Future card instalments already committed, in cents. */
  readonly committedInstallmentsAmount: number;
}

export interface EducationPill {
  readonly id: string;
  readonly topic: PillTopic;
  readonly title: string;
  readonly body: string;
  readonly href?: string;
  readonly hrefLabel?: string;
  /** Lower comes first when several apply. */
  readonly priority: number;
  readonly appliesTo: (context: PillContext) => boolean;
}

export const EDUCATION_PILLS: readonly EducationPill[] = [
  {
    id: "rotativo",
    topic: "ROTATIVO",
    title: "Se não der para pagar a fatura inteira",
    body: "Confira com a instituição o que acontece com o valor que ficou em aberto e quais opções estão disponíveis. Compare juros, encargos e custo total antes de escolher uma forma de pagamento.",
    href: "/app/cartoes",
    hrefLabel: "Ver faturas",
    priority: 1,
    appliesTo: (context) => context.hasOverdueStatement,
  },
  {
    id: "essencial-em-atraso",
    topic: "DIREITOS",
    title: "Conta de serviço essencial: negocie antes do corte",
    body: "Se uma conta de água, luz ou gás está atrasada, confirme com a prestadora os prazos, avisos, encargos e opções disponíveis para sua situação. As condições variam; anote o protocolo e compare o custo antes de aceitar um acordo.",
    href: "/app/contas",
    hrefLabel: "Ver contas vencidas",
    priority: 1,
    appliesTo: (context) => context.hasEssentialBillOverdue,
  },
  {
    id: "garantia-primeiro",
    topic: "DIVIDA",
    title: "Dívida com bem em garantia: confira o risco",
    body: "Em um financiamento de carro ou imóvel, o próprio bem pode estar ligado ao contrato. Confira as consequências do atraso e compare a urgência com gastos essenciais, juros e outros compromissos antes de escolher o que pagar.",
    href: "/app/dividas",
    hrefLabel: "Ver dívidas",
    priority: 2,
    appliesTo: (context) => context.hasCollateralDebt,
  },
  {
    id: "cheque-especial",
    topic: "JUROS",
    title: "Cheque especial se renova sozinho",
    body: "O limite do cheque especial não é seu dinheiro: é empréstimo com uma das maiores taxas do mercado, cobrado por dia de uso. Enquanto o saldo não volta ao positivo, ele se renova todo mês sem ninguém precisar assinar nada.",
    priority: 2,
    appliesTo: (context) => context.hasOverdraftDebt,
  },
  {
    id: "limite-comprometido",
    topic: "CARTAO",
    title: "Limite alto comprometido é dívida futura, não folga",
    body: "O limite disponível que o aplicativo do banco mostra costuma ignorar as parcelas que ainda vão cair. Quando a maior parte do limite já está comprometida, uma emergência encontra o cartão cheio — e sobra o rotativo.",
    href: "/app/cartoes",
    hrefLabel: "Ver o que já está comprometido",
    priority: 3,
    appliesTo: (context) => context.highestCardUtilisation >= 0.8,
  },
  {
    id: "sem-taxa",
    topic: "JUROS",
    title: "Sem a taxa, não dá para saber qual atacar primeiro",
    body: "Comparar dívidas pela parcela engana: a menor parcela pode ser a mais cara. Peça ao credor o CET — o Custo Efetivo Total, que inclui juros, tarifas e seguros — e cadastre aqui. É o único número que compara duas propostas de verdade.",
    href: "/app/dividas",
    hrefLabel: "Cadastrar a taxa",
    priority: 3,
    appliesTo: (context) => context.debtsWithoutKnownRate > 0,
  },
  {
    id: "reserva-de-partida",
    topic: "RESERVA",
    title: "Guarde um pouco antes de quitar tudo",
    body: "Parece contraintuitivo juntar dinheiro devendo. Mas quem zera a reserva para pagar dívida volta ao cartão no primeiro pneu furado — e aí a conta fica maior do que era. Entre R$ 500 e R$ 1.000 já absorve a maioria dos imprevistos.",
    href: "/app/reservas",
    hrefLabel: "Criar a reserva de partida",
    priority: 4,
    appliesTo: (context) => !context.starterReserveComplete,
  },
  {
    id: "mes-negativo",
    topic: "ORCAMENTO",
    title: "Quando o mês fecha no vermelho, o problema é o mês",
    body: "Se os compromissos passam da renda todo mês, nenhum acordo novo se sustenta: a diferença vira dívida de novo. O caminho é reduzir um compromisso fixo ou aumentar a entrada antes de assumir mais uma parcela.",
    href: "/app/negociar",
    hrefLabel: "Ver quanto cabe",
    priority: 4,
    appliesTo: (context) => context.monthlyNetAmount < 0,
  },
  {
    id: "estouro-categoria",
    topic: "ORCAMENTO",
    title: "Teto estourado é informação, não fracasso",
    body: "Uma categoria que passa do planejado quase sempre significa que o teto não era realista, e não que faltou disciplina. Ajustar o valor para o que a vida mostra torna o orçamento útil de novo.",
    href: "/app/orcamento",
    hrefLabel: "Rever o orçamento",
    priority: 5,
    appliesTo: (context) => context.overspentCategories > 0,
  },
  {
    id: "sem-orcamento",
    topic: "ORCAMENTO",
    title: "Um teto por categoria evita a surpresa do fim do mês",
    body: "Definir quanto vai para mercado, lazer e delivery antes de gastar é o que transforma gasto variável em decisão. Não precisa acertar de primeira: o primeiro mês serve para descobrir o número real.",
    href: "/app/orcamento",
    hrefLabel: "Definir tetos",
    priority: 6,
    appliesTo: (context) => !context.hasBudgetForThisMonth,
  },
  {
    id: "parcelamento-invisivel",
    topic: "CARTAO",
    title: "Parcelamento some no total do mês",
    body: "Cada compra parcelada parece pequena sozinha, e a soma delas é que decide o tamanho da fatura. Antes de mais um “12x sem juros”, vale olhar quanto os meses à frente já estão comprometidos.",
    href: "/app/cartoes",
    hrefLabel: "Ver o que vai ser faturado",
    priority: 6,
    appliesTo: (context) => context.committedInstallmentsAmount > 0,
  },

  /* --- Sempre disponíveis, para o cartão nunca ficar vazio ---------- */

  {
    id: "juros-compostos",
    topic: "JUROS",
    title: "Como os juros compostos crescem",
    body: "Juros compostos incidem sobre o que já virou juros. A 10% ao mês, uma dívida de R$ 1.000 não vira R$ 2.200 em um ano — vira cerca de R$ 3.100. É por isso que tempo importa mais do que o valor inicial.",
    priority: 20,
    appliesTo: () => true,
  },
  {
    id: "direitos-bancarios",
    topic: "DIREITOS",
    title: "Você pode exigir o detalhamento da dívida",
    body: "Antes de aceitar qualquer acordo, você pode pedir por escrito o valor original, o que é principal, o que é juros e multa, e o CET. Se o credor não apresentar, isso por si só é motivo para não fechar.",
    href: "/app/negociar",
    hrefLabel: "Ver roteiro para pedir",
    priority: 21,
    appliesTo: () => true,
  },
  {
    id: "portabilidade",
    topic: "DIREITOS",
    title: "Trocar a dívida de banco é um direito",
    body: "A portabilidade de crédito é regulamentada pelo Banco Central e não pode ser cobrada como tarifa. Compare sempre pelo CET, nunca pela parcela: prazo maior com parcela menor costuma custar mais no total.",
    href: "/app/negociar",
    hrefLabel: "Ver roteiro de portabilidade",
    priority: 22,
    appliesTo: () => true,
  },
];

/**
 * The pills that fit this household right now, most relevant first.
 *
 * Always returns something: the general pills apply to everyone, so the card
 * never renders empty - but they only appear once the situational ones run
 * out, which is what keeps the section from feeling like filler.
 */
export function pickPills(context: PillContext, limit = 3): EducationPill[] {
  return EDUCATION_PILLS.filter((pill) => pill.appliesTo(context))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, Math.max(limit, 0));
}
