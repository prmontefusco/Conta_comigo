import { NextResponse } from "next/server";

interface AdvisorRequest {
  readonly message?: string;
  readonly context: {
    readonly score: number;
    readonly statusLabel: string;
    readonly totalCashFormatted: string;
    readonly monthlyIncomeFormatted: string;
    readonly monthlyExpensesFormatted: string;
    readonly monthlyNetFormatted: string;
    readonly debtCommitmentRatio: number;
    readonly totalDebtFormatted: string;
    readonly overdueBillsCount: number;
    readonly overdueBillsTotalFormatted: string;
    readonly emergencyFundMonths: number;
    readonly monthsToDebtFree: number;
    readonly debtFreeDateFormatted: string;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdvisorRequest;
    const { context, message } = body;

    const userQuestion = message?.trim() || "";

    // 1. Check if Gemini API is available
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const aiResponse = await callGeminiAI(geminiApiKey, context, userQuestion);
        if (aiResponse) {
          return NextResponse.json({ reply: aiResponse, source: "gemini" });
        }
      } catch (err) {
        console.error("[ContaComigo AI] Fallback para motor analítico:", err);
      }
    }

    // 2. Deterministic AI Financial Advisor (Local Expert Engine)
    const localAdvice = generateLocalFinancialAdvice(context, userQuestion);
    return NextResponse.json({ reply: localAdvice, source: "deterministic_ai" });
  } catch (error) {
    console.error("[ContaComigo AI] Erro no endpoint:", error);
    return NextResponse.json(
      { error: "Não foi possível gerar a consultoria no momento. Tente novamente." },
      { status: 500 },
    );
  }
}

async function callGeminiAI(
  apiKey: string,
  context: AdvisorRequest["context"],
  question: string,
): Promise<string | null> {
  const prompt = `
Você é o Consultor Financeiro Inteligente do aplicativo "Conta Comigo", especializado em ajudar pessoas e famílias brasileiras com dificuldades financeiras, endividamento ou desorganização de orçamento.

SEU TOM E POSTURA:
- Empático, encorajador, acolhedor e jamais julgador.
- Prático, direto ao ponto e com passos acionáveis em bom português do Brasil.
- Focado na realidade brasileira (entende cartão de crédito, rotativo, cheque especial, consignado, Serasa, inflação).

DADOS FINANCEIROS ATUAIS DO USUÁRIO:
- Score de Saúde Financeira: ${context.score}/100 (${context.statusLabel})
- Saldo atual em conta: ${context.totalCashFormatted}
- Receita média mensal: ${context.monthlyIncomeFormatted}
- Despesas comprometidas: ${context.monthlyExpensesFormatted}
- Sobra/Déficit mensal: ${context.monthlyNetFormatted}
- Comprometimento da renda com dívidas: ${context.debtCommitmentRatio}%
- Saldo total de dívidas: ${context.totalDebtFormatted}
- Contas em atraso: ${context.overdueBillsCount} (Total: ${context.overdueBillsTotalFormatted})
- Meses de reserva de emergência: ${context.emergencyFundMonths} meses
- Previsão de quitação total: ${context.monthsToDebtFree} meses (Data: ${context.debtFreeDateFormatted})

PERGUNTA OU SOLICITAÇÃO DO USUÁRIO:
"${question || "Por favor, faça um diagnóstico completo da minha situação atual e me dê um plano de ação prioritário para me organizar e sair das dívidas."}"

Responda em formato Markdown bem formatado, com títulos em negrito, listas fáceis de ler e um plano claro de passos práticos.
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || null;
}

function generateLocalFinancialAdvice(
  context: AdvisorRequest["context"],
  question: string,
): string {
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

  if (q.includes("quitar") || q.includes("bola de neve") || q.includes("avalanche") || q.includes("dívida") || q.includes("divida")) {
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
3. **Onde guardar**: Aplicações com liquidez diária e segurança garantida pelo FGC (CDB 100% do CDI ou Tesouro Selic), nunca na poupança tradicional ou em investimentos de risco.`;
  }

  // General Diagnostic Response
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
   - Atualmente, as dívidas consom ${context.debtCommitmentRatio}% da renda. Aplique qualquer sobra mensal (**${context.monthlyNetFormatted}**) para amortizar parcelas e antecipar sua liberdade financeira.

3. **🌱 Etapa 3: Formação da Reserva de Tranquilidade**
   - Conforme as dívidas forem quitadas, direcione esse valor mensal diretamente para sua reserva de emergência. Em pouco tempo você estará no grupo de pessoas com total estabilidade financeira!

*Dica: Você pode me fazer perguntas como "Como cortar despesas?", "Qual dívida pagar primeiro?" ou "Como negociar no banco?".*`;
}
