import { NextResponse } from "next/server";
import { toDecimal } from "@/core/money/money";
import { describeError, logger } from "@/lib/observability/logger";
import {
  buildIrpfPrompt,
  irpfRequestSchema,
  parseIrpfReading,
} from "@/modules/receipts/domain/irpf-reading";
import { requireAuth } from "@/server/auth-guard";
import { readFileWithGemini } from "@/server/gemini";
import { requirePremiumFeature } from "@/server/plan-guard";
import { checkSharedRateLimit } from "@/server/rate-limit-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const GEMINI_TIMEOUT_MS = 45_000;

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const denied = await requirePremiumFeature(
    auth.caller.uid,
    "documentReading",
    "A leitura automática de documentos do IRPF faz parte do Premium. Você pode cadastrar manualmente quando quiser.",
  );
  if (denied) return denied;

  const limit = await checkSharedRateLimit(`irpf:${auth.caller.uid}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Você enviou muitos documentos seguidos. Aguarde alguns minutos e tente novamente.",
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = irpfRequestSchema.safeParse(body);
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
          "A leitura automática de IRPF não está disponível agora. Você pode cadastrar manualmente.",
      },
      { status: 503 },
    );
  }

  try {
    const text = await readFileWithGemini({
      apiKey,
      prompt: buildIrpfPrompt(),
      fileBase64: parsed.data.fileBase64,
      mimeType: parsed.data.mimeType,
      maxOutputTokens: 1_200,
      timeoutMs: GEMINI_TIMEOUT_MS,
      operation: "aiIrpf",
    });

    const reading = text ? parseIrpfReading(text) : null;
    if (!reading) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message: "O arquivo foi lido, mas não encontrei informações claras para o IRPF.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      reading: {
        kind: reading.kind,
        title: reading.title,
        amount: reading.amount ? toDecimal(reading.amount) : null,
        paidOn: reading.paidOn ?? null,
        documentName: reading.documentName ?? null,
        documentIssuer: reading.documentIssuer ?? null,
        documentIdentifier: reading.documentIdentifier ?? null,
        notes: reading.notes ?? null,
        confidence: reading.confidence,
      },
    });
  } catch (error) {
    logger.error("Falha ao processar documento de IRPF com IA.", {
      operation: "aiIrpf",
      ...describeError(error),
    });
    return NextResponse.json(
      {
        error: "INTERNAL",
        message:
          "Não foi possível ler o documento de IRPF agora. Tente novamente ou cadastre manualmente.",
      },
      { status: 500 },
    );
  }
}
