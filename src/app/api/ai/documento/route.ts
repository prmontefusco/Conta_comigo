import { NextResponse } from "next/server";
import { toDecimal } from "@/core/money/money";
import { describeError, logger } from "@/lib/observability/logger";
import {
  buildDocumentPrompt,
  documentRequestSchema,
  parseDocumentReading,
} from "@/modules/receipts/domain/document-reading";
import { requireAuth } from "@/server/auth-guard";
import { readFileWithGemini } from "@/server/gemini";
import { requirePremiumFeature } from "@/server/plan-guard";
import { checkSharedRateLimit } from "@/server/rate-limit-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const GEMINI_TIMEOUT_MS = 35_000;

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const denied = await requirePremiumFeature(
    auth.caller.uid,
    "documentReading",
    "A leitura automática de contas faz parte do Premium. Você tem 30 dias de teste ao criar a conta — depois disso, dá para cadastrar manualmente.",
  );
  if (denied) return denied;

  const limit = await checkSharedRateLimit(
    `document:${auth.caller.uid}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message:
          "Você enviou muitos documentos seguidos. Aguarde alguns instantes e tente novamente.",
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = documentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Arquivo inválido. Envie um arquivo PDF, JPG ou PNG de até 10MB.",
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
          "A leitura automática de contas não está disponível no momento. Você pode cadastrar manualmente.",
      },
      { status: 503 },
    );
  }

  const { fileBase64, mimeType } = parsed.data;

  try {
    const text = await readFileWithGemini({
      apiKey,
      prompt: buildDocumentPrompt(),
      fileBase64,
      mimeType,
      maxOutputTokens: 800,
      timeoutMs: GEMINI_TIMEOUT_MS,
      operation: "aiDocumento",
    });

    if (!text) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message:
            "Não foi possível extrair as informações deste documento. Tente outro arquivo ou digite os dados.",
        },
        { status: 422 },
      );
    }

    const reading = parseDocumentReading(text);

    if (!reading) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message: "O documento foi lido, mas não encontramos valor ou data de vencimento claros.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      reading: {
        documentType: reading.documentType,
        issuer: reading.issuer ?? null,
        description: reading.description,
        totalAmount: reading.totalAmount ? toDecimal(reading.totalAmount) : null,
        minimumAmount: reading.minimumAmount ? toDecimal(reading.minimumAmount) : null,
        dueDate: reading.dueDate ?? null,
        barcode: reading.barcode ?? null,
        confidence: reading.confidence,
      },
    });
  } catch (error) {
    logger.error("Falha ao processar documento com IA.", {
      operation: "aiDocumento",
      ...describeError(error),
    });
    return NextResponse.json(
      {
        error: "INTERNAL",
        message:
          "Não foi possível ler o documento no momento. Tente novamente ou cadastre manualmente.",
      },
      { status: 500 },
    );
  }
}
