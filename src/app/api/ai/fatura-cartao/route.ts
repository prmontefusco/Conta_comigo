import { NextResponse } from "next/server";
import { toDecimal } from "@/core/money/money";
import { describeError, logger } from "@/lib/observability/logger";
import {
  buildCardStatementPrompt,
  cardStatementRequestSchema,
  parseCardStatementReading,
} from "@/modules/receipts/domain/card-statement-reading";
import { requireAuth } from "@/server/auth-guard";
import { readFileWithGemini } from "@/server/gemini";
import { requirePremiumFeature } from "@/server/plan-guard";
import { checkSharedRateLimit } from "@/server/rate-limit-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const GEMINI_TIMEOUT_MS = 60_000;

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const denied = await requirePremiumFeature(
    auth.caller.uid,
    "documentReading",
    "A leitura de fatura de cartão por PDF ou foto faz parte do Premium. Você tem 30 dias de teste ao criar a conta — depois disso, dá para lançar as compras manualmente.",
  );
  if (denied) return denied;

  const limit = await checkSharedRateLimit(
    `card-statement:${auth.caller.uid}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Você enviou muitas faturas seguidas. Aguarde alguns minutos e tente novamente.",
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = cardStatementRequestSchema.safeParse(body);

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
          "A leitura automática de fatura não está disponível agora. Você pode lançar as compras manualmente.",
      },
      { status: 503 },
    );
  }

  try {
    const maxPurchases = parsed.data.maxPurchases ?? 120;
    const text = await readFileWithGemini({
      apiKey,
      prompt: buildCardStatementPrompt(maxPurchases),
      fileBase64: parsed.data.fileBase64,
      mimeType: parsed.data.mimeType,
      maxOutputTokens: outputTokenBudget(maxPurchases),
      timeoutMs: GEMINI_TIMEOUT_MS,
      operation: "aiFaturaCartao",
    });

    const reading = text ? parseCardStatementReading(text, { maxPurchases }) : null;
    if (!reading) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message: "O arquivo foi lido, mas não encontrei dados claros de fatura de cartão.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      reading: {
        issuer: reading.issuer ?? null,
        cardName: reading.cardName ?? null,
        brand: reading.brand ?? null,
        lastFourDigits: reading.lastFourDigits ?? null,
        dueDate: reading.dueDate ?? null,
        closingDate: reading.closingDate ?? null,
        referenceMonth: reading.referenceMonth ?? null,
        statementTotal: centsToDecimal(reading.statementTotalCents),
        minimumPayment: centsToDecimal(reading.minimumPaymentCents),
        creditLimit: centsToDecimal(reading.creditLimitCents),
        confidence: reading.confidence,
        purchases: reading.purchases.map((purchase) => ({
          date: purchase.date,
          description: purchase.description,
          installmentAmount: purchase.installmentAmountCents,
          installmentNumber: purchase.installmentNumber,
          installmentCount: purchase.installmentCount,
          firstStatementMonth: purchase.firstStatementMonth,
          importKey: purchase.importKey,
        })),
        installmentOffers: reading.installmentOffers.map((offer) => ({
          installments: offer.installments,
          installmentAmount: offer.installmentAmountCents,
          upfrontAmount: offer.upfrontCents,
          annualCetPercent: offer.annualCetPercent ?? null,
        })),
        discarded: reading.discarded,
      },
    });
  } catch (error) {
    logger.error("Falha ao processar fatura de cartão com IA.", {
      operation: "aiFaturaCartao",
      ...describeError(error),
    });
    return NextResponse.json(
      {
        error: "INTERNAL",
        message:
          "Não foi possível ler a fatura agora. Tente novamente ou lance as compras manualmente.",
      },
      { status: 500 },
    );
  }
}

function centsToDecimal(value: number | undefined): number | null {
  return value === undefined ? null : toDecimal({ amount: value, currency: "BRL" });
}

function outputTokenBudget(maxPurchases: number): number {
  // Header fields cost little; purchase rows dominate the answer. Keeping this
  // proportional avoids reserving a long response for ordinary statements.
  return Math.max(1_600, Math.min(8_000, 900 + maxPurchases * 34));
}
