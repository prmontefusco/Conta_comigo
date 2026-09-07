import type { AdvisorContext } from "./advisor-request-schema";

/**
 * Orientação sem modelo de linguagem.
 *
 * Este é o caminho que responde quando não há chave configurada — e, enquanto
 * não houver, é o **único** caminho. Não é um plano B esquecido: é o que a
 * pessoa lê.
 *
 * Por isso ele mora no domínio e não dentro do arquivo de rota. É texto que dá
 * orientação financeira a quem está endividado, e no resto deste projeto nada
 * assim entra sem teste.
 *
 * ## A linha que este texto não cruza
 *
 * Os termos de uso dizem, literalmente: "Não oferecemos, intermediamos nem
 * recomendamos crédito, investimentos ou seguros." O texto daqui precisa
 * caber nessa frase.
 *
 * Na prática: descrever **critérios** que a pessoa pode usar para escolher
 * ("liquidez diária", "sem risco de perder o valor guardado") em vez de nomear
 * produtos ("CDB 100% do CDI", "Tesouro Selic"). Nomear produto é recomendar,
 * mesmo com boa intenção — e recomendação de investimento é atividade regulada.
 *
 * Explicar como funciona o juro rotativo, ou o que é o método avalanche, não é
 * recomendação: é a educação financeira que o produto se propõe a fazer.
 */

/**
 * Nomes de produto que este texto não pode conter — nem para recomendar, nem
 * para desaconselhar. Os testes verificam cada ramo contra esta lista.
 *
 * O casamento é por **palavra inteira**, não por trecho: em português, procurar
 * "ação" dentro do texto acerta "Plano de Ação", "Redução" e "Formação". Por
 * isso "ações" também ficou de fora da lista — em "suas ações de hoje" a palavra
 * não tem nada a ver com bolsa, e um teste que acusa isso vira ruído que alguém
 * acaba desligando. Para renda variável, o termo inequívoco é "bolsa de valores".
 */
export const FORBIDDEN_PRODUCT_TERMS = [
  "cdb",
  "tesouro selic",
  "tesouro direto",
  "lci",
  "lca",
  "poupança",
  "fundo de investimento",
  "bolsa de valores",
  "bitcoin",
  "cripto",
] as const;

/** `true` quando o texto nomeia algum produto da lista, como palavra inteira. */
export function namesInvestmentProduct(text: string): string | undefined {
  const lower = text.toLowerCase();

  return FORBIDDEN_PRODUCT_TERMS.find((term) =>
    new RegExp(`(^|[^\\p{L}])${term}($|[^\\p{L}])`, "u").test(lower),
  );
}

/**
 * How this text refers to the payoff horizon.
 *
 * There is no horizon when the minimum instalments do not fit in the month,
 * and every sentence that names one has to disappear in that case. A plan
 * that cannot be run is not a slow plan.
 */
function horizonSentence(context: AdvisorContext): string {
  if (context.planViability === "NOT_VIABLE") {
    return `Hoje **não há prazo de quitação possível** com os contratos do jeito que estão: faltam **${context.monthlyShortfallFormatted}** por mês só para cobrir as parcelas mínimas. Isso é aritmética, não julgamento — o próximo passo é buscar prazo maior ou outro formato de acordo com os credores.`;
  }
  if (context.monthsToDebtFree === null) {
    return "Ainda não há dados suficientes para estimar um prazo de quitação.";
  }
  return `Quitação estimada em **${context.monthsToDebtFree} meses** (${context.debtFreeDateFormatted}).`;
}

export function generateLocalFinancialAdvice(context: AdvisorContext, question: string): string {
  const q = question.toLowerCase();

  if (q.includes("cartão") || q.includes("cartao") || q.includes("fatura")) {
    return `### 💳 Estratégia para o Cartão de Crédito

O cartão de crédito pode acelerar a dívida quando parte da fatura entra no rotativo. O objetivo é enxergar isso cedo, antes que o custo cresça.

**Passos possíveis:**
1. **Olhe a fatura antes do vencimento**: Se não for possível pagar o total, peça à instituição opções por escrito e compare pelo CET.
2. **Segure novos parcelamentos por um tempo**: Isso dá espaço para as parcelas atuais saírem da frente.
3. **Use débito ou Pix no dia a dia quando fizer sentido**: Ver o dinheiro saindo na hora ajuda a manter a noção do caixa real.`;
  }

  if (q.includes("cortar") || q.includes("economizar") || q.includes("despesa")) {
    return `### ✂️ Onde procurar respiro no mês

Com base no seu perfil (comprometimento de **${context.debtCommitmentRatio}%** em dívidas e sobra de **${context.monthlyNetFormatted}**):

1. **Auditoria de Assinaturas e Recorrentes**:
   - Liste serviços de streaming, academias, planos de celular e clubes de benefícios. Os que não foram usados nos últimos 30 dias são bons candidatos a pausa.
2. **Renegociação de Serviços Fixos**:
   - Internet, celular e tarifas costumam ter margem de negociação. Pedir uma oferta atual pode reduzir uma conta sem mexer no essencial.
3. **Supermercado e Alimentação Fora**:
   - Lista de compras e menos pedidos por aplicativo podem liberar caixa sem exigir uma mudança enorme de rotina.`;
  }

  if (
    q.includes("quitar") ||
    q.includes("bola de neve") ||
    q.includes("avalanche") ||
    q.includes("dívida") ||
    q.includes("divida")
  ) {
    return `### 🎯 Plano de Quitação das suas Dívidas (${context.totalDebtFormatted})

${horizonSentence(context)}

1. **Bola de Neve vs Avalanche**:
   - **Método Avalanche**: prioriza a dívida com maior taxa. Costuma reduzir custo quando existe sobra no mês.
   - **Método Bola de Neve**: prioriza a menor dívida. Pode dar alívio quando há muitas contas abertas e pouca energia para acompanhar tudo.
2. **Renegociação Direta**:
   - Ao falar com credores, peça saldo atualizado, CET, valor total parcelado e prazo. Desconto só ajuda se a parcela couber no mês.`;
  }

  if (q.includes("reserva") || q.includes("emergência") || q.includes("emergencia")) {
    return `### 🛟 Construção do seu Colchão de Emergência

Atualmente, sua reserva cobre **${context.emergencyFundMonths} meses** do seu custo de vida.

**Metas por etapas:**
1. **Primeira Meta (R$ 1.000 a R$ 2.000)**: Guardar um valor inicial para pequenos imprevistos (remédios, conserto de carro) e evitar entrar no cartão de crédito.
2. **Segunda Meta (3 meses de gastos básicos)**: Aumenta a proteção contra perda temporária de renda.
3. **Que características procurar**: reserva de emergência é o dinheiro que precisa estar disponível no dia em que der problema. Ao comparar as opções que o seu banco oferece, olhe três coisas: **resgate no mesmo dia**, **sem risco de sacar menos do que você guardou** e **sem taxa que coma o rendimento**.

*Qual aplicação atende a esses critérios é uma decisão sua, e vale conversar com o seu banco ou com um profissional certificado. O Conta comigo organiza os seus números; não indica onde investir.*`;
  }

  return `### 🩺 Diagnóstico Financeiro & Plano de Recuperação

**Sua Situação Geral:**
- **Score de Saúde:** **${context.score}/100** (${context.statusLabel}).
- **Comprometimento com Dívidas:** **${context.debtCommitmentRatio}%** da sua renda.
- **Sobra Mensal Estimada:** **${context.monthlyNetFormatted}**.
- **Horizonte para Quitação Total:** ${horizonSentence(context)}

---

### 🚀 Seu Plano de Ação em 3 Etapas:

1. **${context.overdueBillsCount > 0 ? "🔥 Etapa 1: Regularizar Contas Vencidas" : "🛡️ Etapa 1: Blindagem e Controle Imediato"}**
   - ${context.overdueBillsCount > 0 ? `Há ${context.overdueBillsCount} conta(s) em atraso (${context.overdueBillsTotalFormatted}). Comece pelas que cortam serviço essencial ou crescem mais rápido.` : "As contas fixas estão em dia. O foco agora é manter visibilidade sobre os próximos vencimentos."}

2. **⚖️ Etapa 2: Redução do Comprometimento de Dívidas**
   - Atualmente, as dívidas consomem ${context.debtCommitmentRatio}% da renda. Se houver sobra mensal (**${context.monthlyNetFormatted}**), ela pode reduzir custo ou liberar uma parcela futura.

3. **🌱 Etapa 3: Formação da Reserva de Tranquilidade**
   - Conforme parcelas forem saindo da frente, direcione parte desse espaço para uma reserva pequena de emergência. Ela evita que um imprevisto vire nova dívida.

*Dica: Você pode me fazer perguntas como "Como cortar despesas?", "Qual dívida pagar primeiro?" ou "Como negociar no banco?".*`;
}
