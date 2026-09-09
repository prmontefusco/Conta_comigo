import { NextResponse } from "next/server";
import { todayIn, tryCalendarDate } from "@/core/date/calendar-date";
import { describeError, logger } from "@/lib/observability/logger";
import {
  buildStatementPrompt,
  parseStatementReading,
  statementRequestSchema,
} from "@/modules/receipts/domain/statement-reading";
import { requireAuth } from "@/server/auth-guard";
import { readFileWithGemini } from "@/server/gemini";
import { requirePremiumFeature } from "@/server/plan-guard";
import { checkSharedRateLimit } from "@/server/rate-limit-store";

/**
 * Leitura de extrato bancário em PDF ou foto.
 *
 * A rota devolve uma **lista de linhas para conferir**, nunca lançamentos
 * gravados. Quem grava é a pessoa, na tela de importação, depois de desmarcar
 * transferência entre contas próprias, estorno e o que já tinha sido lançado
 * à mão.
 *
 * Os limites são os das outras rotas de leitura, com um teto menor: um
 * extrato de PDF é o arquivo mais caro que o produto manda ao modelo, tanto
 * de entrada quanto de saída.
 *
 * O arquivo não é guardado. Chega, vai ao modelo e some com a requisição —
 * sem Storage, sem log do corpo, sem retenção deste lado.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Extratos por pessoa, por janela. Menor que o de contas: o arquivo é maior. */
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;

/** Um extrato de três meses é a resposta mais longa que o produto pede. */
const MAX_OUTPUT_TOKENS = 8_000;
const GEMINI_TIMEOUT_MS = 60_000;

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const denied = await requirePremiumFeature(
    auth.caller.uid,
    "documentReading",
    "A leitura de extrato por PDF ou foto faz parte do Premium. Você tem 30 dias de teste ao criar a conta — depois disso, dá para importar OFX ou CSV do seu banco, que continua liberado.",
  );
  if (denied) return denied;

  const limit = await checkSharedRateLimit(
    `statement:${auth.caller.uid}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Você enviou muitos extratos seguidos. Aguarde alguns minutos e tente novamente.",
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = statementRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Arquivo inválido. Envie um PDF, JPG ou PNG de até 10MB.",
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "UNAVAILABLE",
        message:
          "A leitura de extrato por arquivo não está disponível agora. Você pode importar um arquivo OFX ou CSV do seu banco.",
      },
      { status: 503 },
    );
  }

  const { fileBase64, mimeType } = parsed.data;
  const today = tryCalendarDate(parsed.data.today ?? "") ?? todayIn("America/Sao_Paulo");

  try {
    const text = await readFileWithGemini({
      apiKey,
      prompt: buildStatementPrompt(),
      fileBase64,
      mimeType,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      timeoutMs: GEMINI_TIMEOUT_MS,
      operation: "aiExtrato",
    });

    if (!text) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message:
            "Não consegui ler este extrato. Tente o arquivo OFX ou CSV do seu banco, que é mais confiável.",
        },
        { status: 422 },
      );
    }

    const reading = parseStatementReading(text, { today });

    if (!reading) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message:
            "O arquivo foi lido, mas não encontrei lançamentos com data e valor claros. Tente o OFX ou o CSV do seu banco.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      reading: {
        institution: reading.institution ?? null,
        accountLabel: reading.accountLabel ?? null,
        periodStart: reading.periodStart ?? null,
        periodEnd: reading.periodEnd ?? null,
        closingBalance: reading.closingBalanceCents ?? null,
        confidence: reading.confidence,
        entries: reading.entries.map((entry) => ({
          date: entry.date,
          description: entry.description,
          amount: entry.amountCents,
        })),
        discarded: reading.discarded,
      },
    });
  } catch (error) {
    logger.error("Falha ao processar extrato com IA.", {
      operation: "aiExtrato",
      ...describeError(error),
    });
    return NextResponse.json(
      {
        error: "INTERNAL",
        message:
          "Não foi possível ler o extrato agora. Tente novamente ou importe o arquivo OFX do seu banco.",
      },
      { status: 500 },
    );
  }
}
