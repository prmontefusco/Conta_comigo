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

export function generateLocalFinancialAdvice(context: AdvisorContext, question: string): string {
  const q = question.toLowerCase();

  if (q.includes("cartão") || q.includes("cartao") || q.includes("fatura")) {
    return `### 💳 Estratégia para o Cartão de Crédito

O cartão de crédito costuma ser o principal acelerador do endividamento devido aos juros rotativos (que chegam a mais de 400% ao ano no Brasil).

**Passos recomendados para você:**
1. **Evite pagar o mínimo**: Pagar o valor mínimo ativa o juro rotativo. Se não for possível pagar o total da fatura, procure o parcelamento de fatura fixo da instituição, que possui taxas menores que o rotativo.
2. **Congele novos parcelamentos**: Pare temporariamente de fazer compras parceladas até que as parcelas atuais comecem a vencer e liberar seu limite.
3. **Use débito ou Pix para o dia a dia**: Sentir o dinheiro saindo na hora ajuda a recuperar a percepção real de gastos.`;
  }

  if (q.includes("cortar") || q.includes("economizar") || q.includes("despesa")) {
    return `### ✂️ Onde e Como Cortar Gastos sem Sofrimento

Com base no seu perfil (comprometimento de **${context.debtCommitmentRatio}%** em dívidas e sobra de **${context.monthlyNetFormatted}**):

1. **Auditoria de Assinaturas e Recorrentes**:
   - Liste todos os serviços de streaming, academias, planos de celular e clubes de benefícios. Cancele os que não foram usados nos últimos 30 dias.
2. **Renegociação de Serviços Fixos**:
   - Ligue para sua operadora de internet e celular a cada 6 meses pedindo alinhamento com as ofertas atuais para novos clientes.
3. **Supermercado e Alimentação Fora**:
   - Faça lista de compras e evite ir ao mercado com fome. Reduzir 1 a 2 refeições por aplicativo na semana costuma liberar de R$ 150 a R$ 300 por mês.`;
  }

  if (
    q.includes("quitar") ||
    q.includes("bola de neve") ||
    q.includes("avalanche") ||
    q.includes("dívida") ||
    q.includes("divida")
  ) {
    return `### 🎯 Plano de Quitação das suas Dívidas (${context.totalDebtFormatted})

Para atingir a sua **quitação estimada em ${context.monthsToDebtFree} meses (${context.debtFreeDateFormatted})**:

1. **Método Recomendado: Bola de Neve vs Avalanche**:
   - **Método Avalanche (Mais Econômico)**: Se você tem dívidas com juros altos (cheque especial, cartão), priorize quitá-las primeiro para estancar os juros.
   - **Método Bola de Neve (Mais Motivador)**: Se você se sente desmotivado com muitas contas abertas, quite a menor dívida primeiro para ter uma vitória rápida e liberar fluxo.
2. **Renegociação Direta**:
   - Entre em contato com os credores ou acompanhe feirões como o Serasa Limpa Nome para obter descontos de até 70% a 90% para quitação à vista ou parcelada.`;
  }

  if (q.includes("reserva") || q.includes("emergência") || q.includes("emergencia")) {
    return `### 🛟 Construção do seu Colchão de Emergência

Atualmente, sua reserva cobre **${context.emergencyFundMonths} meses** do seu custo de vida.

**Metas por etapas:**
1. **Primeira Meta (R$ 1.000 a R$ 2.000)**: Guardar um valor inicial para pequenos imprevistos (remédios, conserto de carro) e evitar entrar no cartão de crédito.
2. **Segunda Meta (3 meses de gastos básicos)**: Garante estabilidade contra perda temporária de renda.
3. **Que características procurar**: reserva de emergência é o dinheiro que precisa estar disponível no dia em que der problema. Ao comparar as opções que o seu banco oferece, olhe três coisas: **resgate no mesmo dia**, **sem risco de sacar menos do que você guardou** e **sem taxa que coma o rendimento**.

*Qual aplicação atende a esses critérios é uma decisão sua, e vale conversar com o seu banco ou com um profissional certificado. O Conta comigo organiza os seus números; não indica onde investir.*`;
  }

  return `### 🩺 Diagnóstico Financeiro & Plano de Recuperação

**Sua Situação Geral:**
- **Score de Saúde:** **${context.score}/100** (${context.statusLabel}).
- **Comprometimento com Dívidas:** **${context.debtCommitmentRatio}%** da sua renda.
- **Sobra Mensal Estimada:** **${context.monthlyNetFormatted}**.
- **Horizonte para Quitação Total:** **${context.monthsToDebtFree} meses** (previsão: **${context.debtFreeDateFormatted}**).

---

### 🚀 Seu Plano de Ação em 3 Etapas:

1. **${context.overdueBillsCount > 0 ? "🔥 Etapa 1: Regularizar Contas Vencidas" : "🛡️ Etapa 1: Blindagem e Controle Imediato"}**
   - ${context.overdueBillsCount > 0 ? `Você tem ${context.overdueBillsCount} conta(s) em atraso (${context.overdueBillsTotalFormatted}). Regularize-as prioritariamente para estancar juros de mora.` : "Mantenha todas as contas fixas rigorosamente em dia para não pagar multas ou juros desnecessários."}

2. **⚖️ Etapa 2: Redução do Comprometimento de Dívidas**
   - Atualmente, as dívidas consomem ${context.debtCommitmentRatio}% da renda. Aplique qualquer sobra mensal (**${context.monthlyNetFormatted}**) para amortizar parcelas e antecipar sua liberdade financeira.

3. **🌱 Etapa 3: Formação da Reserva de Tranquilidade**
   - Conforme as dívidas forem quitadas, direcione esse valor mensal diretamente para sua reserva de emergência. Em pouco tempo você estará no grupo de pessoas com total estabilidade financeira!

*Dica: Você pode me fazer perguntas como "Como cortar despesas?", "Qual dívida pagar primeiro?" ou "Como negociar no banco?".*`;
}
