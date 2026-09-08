import { NextResponse } from "next/server";
import { z } from "zod";
import { describeError, logger } from "@/lib/observability/logger";
import { requireAuth } from "@/server/auth-guard";
import { checkSharedRateLimit } from "@/server/rate-limit-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const GEMINI_TIMEOUT_MS = 25_000;

const superendividamentoRequestSchema = z.object({
  rendaLiquida: z.string(),
  dependentes: z.number().int().min(0).max(20),
  motivoInadimplencia: z.string().max(1000).optional(),
  despesasEssenciaisTotal: z.string(),
  despesasEssenciaisDescricao: z.string().max(2000),
  cortesRealizadosDescricao: z.string().max(2000),
  totalEconomiaCortes: z.string(),
  totalPassivo: z.string(),
  totalParcelasAtuais: z.string(),
  credoresResumo: z.string().max(2000),
  propostaMensal60m: z.string(),
});

type SuperendividamentoPayload = z.infer<typeof superendividamentoRequestSchema>;

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const limit = await checkSharedRateLimit(
    `ai_super:${auth.caller.uid}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Muitas solicitações seguidas. Aguarde alguns minutos.",
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = superendividamentoRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Dados incompletos para gerar o dossiê de superendividamento.",
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      const aiNarrativa = await callGeminiSuperendividamento(apiKey, payload);
      if (aiNarrativa) {
        return NextResponse.json({ narrativa: aiNarrativa, source: "gemini" });
      }
    }

    // Fallback determinístico robusto
    return NextResponse.json({
      narrativa: gerarNarrativaDeterminada(payload),
      source: "deterministic_engine",
    });
  } catch (error) {
    logger.error("Falha ao gerar narrativa de superendividamento.", {
      operation: "aiSuperendividamento",
      ...describeError(error),
    });

    return NextResponse.json({
      narrativa: gerarNarrativaDeterminada(payload),
      source: "deterministic_fallback",
    });
  }
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

async function callGeminiSuperendividamento(
  apiKey: string,
  data: SuperendividamentoPayload,
): Promise<string | null> {
  const model = geminiModel();

  const prompt = `
Você é um especialista em Direito do Consumidor brasileiro, finanças e na Lei do Superendividamento (Lei nº 14.181/2021).
Elabore uma síntese fática, técnica e contundente para instruir uma petição judicial ou requerimento perante a Defensoria Pública/CEJUSC/Procon.

DADOS DO CASO:
- Renda Líquida Familiar: ${data.rendaLiquida} (dependentes: ${data.dependentes})
- Causa da Dificuldade Financeira: ${data.motivoInadimplencia || "Perda de poder aquisitivo, aumento de juros e despesas emergenciais"}
- Despesas Essenciais de Sobrevivência (Mínimo Existencial): ${data.despesasEssenciaisTotal}/mês
  Itens essenciais: ${data.despesasEssenciaisDescricao}
- GASTOS JÁ CORTADOS/CANCELADOS PELO CONSUMIDOR (PROVA FORMAL DE BOA-FÉ):
  ${data.cortesRealizadosDescricao}
  Economia comprovada gerada com cortes: ${data.totalEconomiaCortes}/mês
- Passivo Total Devedor: ${data.totalPassivo}
- Parcelas Mensais Atuais Cobradas: ${data.totalParcelasAtuais}/mês
- Relação de Credores: ${data.credoresResumo}
- Proposta de Repactuação em 60 meses: ${data.propostaMensal60m}/mês

DIRETRIZES FUNDAMENTAIS PARA O TEXTO (ATENÇÃO CRÍTICA):
1. Demonstre de forma categórica a BOA-FÉ do consumidor (Art. 54-A do CDC), salientando que o requerente NÃO contraiu dívidas por má-fé ou luxo.
2. ENFATIZE com muito destaque os CORTES JÁ REALIZADOS (ex: streamings cancelados, lazer suspenso, refeições fora eliminadas), explicando ao juiz que o consumidor já sacrificou todo e qualquer conforto supérfluo e que as parcelas cobradas atualmente invadem o MÍNIMO EXISTENCIAL (Decreto nº 11.567/2023).
3. Fundamente na Lei 14.181/2021 e nos Arts. 54-A, 104-A do CDC, demonstrando a necessidade de repactuação em bloco para que nenhum banco liquide a renda do devedor individualmente.
4. Apresente a Proposta de Pagamento de 60 meses com carência de 180 dias como uma solução viável e de boa-fé.
5. Tom respeitoso, técnico, objetivo e estruturado em tópicos claros (I. Da Boa-Fé e Cortes Já Efetuados; II. Da Violação do Mínimo Existencial; III. Da Proposta de Repactuação Conforme a Lei).
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 1500 },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );

    if (!response.ok) return null;
    const json: unknown = await response.json();
    const text = readCandidateText(json);
    return text?.trim() || null;
  } catch {
    return null;
  }
}

function readCandidateText(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const candidates = (data as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  const content = candidates[0].content;
  if (typeof content !== "object" || content === null) return undefined;
  const parts = content.parts;
  if (!Array.isArray(parts) || parts.length === 0) return undefined;
  return typeof parts[0].text === "string" ? parts[0].text : undefined;
}

function gerarNarrativaDeterminada(data: SuperendividamentoPayload): string {
  return `### I. DA MANIFESTA BOA-FÉ DO REQUERENTE E ESFORÇO PRÉVIO DE REDUÇÃO DE GASTOS
O(A) Requerente aufere renda líquida mensal de ${data.rendaLiquida}, possuindo ${data.dependentes} dependente(s). O quadro de desequilíbrio orçamentário sobreveio em decorrência de fatores alheios à sua vontade (${data.motivoInadimplencia || "estrangulamento financeiro por encargos e juros bancários"}), jamais decorrente de fraude ou má-fé (requisito do Art. 54-A do CDC).

Cumpre destacar e comprovar perante este d. Juízo que o Requerente NÃO mantém despesas supérfluas. Pelo contrário, em estrita demonstração de responsabilidade orçamentária, já promoveu cortes drásticos em seu padrão de consumo familiar:
${data.cortesRealizadosDescricao}
Totalizando uma contenção de gastos mensal de ${data.totalEconomiaCortes}. As despesas atualmente mantidas resumem-se estritamente ao Mínimo Existencial (${data.despesasEssenciaisTotal}/mês) para garantir moradia, alimentação básica, saúde e subsistência digna.

### II. DO COMPROMETIMENTO DA RENDA E VIOLAÇÃO AO MÍNIMO EXISTENCIAL (DECRETO Nº 11.567/2023)
Atualmente, as parcelas mensais cobradas pelas instituições financeiras perfazem a quantia de ${data.totalParcelasAtuais}, o que, somado às despesas indispensáveis de subsistência, consome e ultrapassa integralmente os rendimentos da família.
Tal situação configura a exata hipótese fática da Lei nº 14.181/2021, tornando manifesta a impossibilidade de quitação das obrigações da forma como originalmente contratadas sem que se aniquile a dignidade da pessoa humana.

### III. DO PLANO DE REPACTUAÇÃO EM 60 MESES (ART. 104-A DO CDC)
Para viabilizar o pagamento de todos os credores em igualdade de condições (par conditio creditorum) e sem preferência injustificada, propõe-se:
1. Prazo de quitação em até 60 (sessenta) parcelas mensais sucessivas;
2. Período de carência inicial de 180 (cento e oitenta) dias para recomposição do fôlego financeiro;
3. Destinação mensal do valor total de ${data.propostaMensal60m}, rateado proporcionalmente entre os seguintes credores quirografários:
${data.credoresResumo}

Requer-se, assim, a instauração do procedimento conciliatório prévio e, caso infrutífero, a homologação judicial do plano de pagamento compulsório nos moldes da legislação vigente.`;
}
