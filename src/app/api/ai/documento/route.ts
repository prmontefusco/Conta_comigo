import { NextResponse } from "next/server";
import { toDecimal } from "@/core/money/money";
import { describeError, logger } from "@/lib/observability/logger";
import {
  buildDocumentPrompt,
  documentRequestSchema,
  parseDocumentReading,
} from "@/modules/receipts/domain/document-reading";
import { requireAuth } from "@/server/auth-guard";
import { checkRateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const GEMINI_TIMEOUT_MS = 35_000;

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const limit = checkRateLimit(`document:${auth.caller.uid}`, RATE_LIMIT, RATE_WINDOW_MS);

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
    const text = await readDocumentWithGemini(apiKey, fileBase64, mimeType);

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

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

async function readDocumentWithGemini(
  apiKey: string,
  fileBase64: string,
  mimeType: string,
): Promise<string | null> {
  const model = geminiModel();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildDocumentPrompt() },
              { inline_data: { mime_type: mimeType, data: fileBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 800 },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    logger.warn("O modelo recusou a leitura do documento.", {
      operation: "aiDocumento",
      status: response.status,
      model,
    });
    return null;
  }

  const data: unknown = await response.json();
  const text = readCandidateText(data);
  return text && text.trim() !== "" ? text : null;
}

function readCandidateText(data: unknown): string | undefined {
  const candidates = readUnknown(data, "candidates");
  if (!Array.isArray(candidates)) return undefined;
  const parts = readUnknown(readUnknown(candidates[0], "content"), "parts");
  if (!Array.isArray(parts)) return undefined;
  const text = readUnknown(parts[0], "text");
  return typeof text === "string" ? text : undefined;
}

function readUnknown(data: unknown, key: string): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  return (data as Record<string, unknown>)[key];
}
