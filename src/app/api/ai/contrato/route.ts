import { NextResponse } from "next/server";
import { describeError, logger } from "@/lib/observability/logger";
import {
  buildLoanContractPrompt,
  loanContractRequestSchema,
  parseLoanContractReading,
} from "@/modules/receipts/domain/loan-contract-reading";
import { requireAuth } from "@/server/auth-guard";
import { readFileWithGemini } from "@/server/gemini";
import { requirePremiumFeature } from "@/server/plan-guard";
import { checkSharedRateLimit } from "@/server/rate-limit-store";

/**
 * Leitura de contrato de empréstimo ou financiamento.
 *
 * O cadastro manual de uma dívida pede quinze números espalhados por um PDF
 * de oito páginas, e é o formulário que as pessoas mais abandonam pela
 * metade. Ler o contrato preenche o formulário; conferir e confirmar continua
 * sendo da pessoa, contra o papel.
 *
 * A rota devolve uma sugestão. Ela não grava dívida nenhuma — uma taxa lida
 * errada e gravada em silêncio mudaria a ordem de quitação recomendada pelo
 * aplicativo, que é a decisão mais cara que ele ajuda a tomar.
 *
 * O arquivo não é guardado: chega, vai ao modelo e some com a requisição.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const MAX_OUTPUT_TOKENS = 1_200;
const GEMINI_TIMEOUT_MS = 45_000;

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const denied = await requirePremiumFeature(
    auth.caller.uid,
    "documentReading",
    "A leitura de contratos faz parte do Premium. Você tem 30 dias de teste ao criar a conta — depois disso, dá para cadastrar o contrato manualmente.",
  );
  if (denied) return denied;

  const limit = await checkSharedRateLimit(
    `contract:${auth.caller.uid}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Você enviou muitos contratos seguidos. Aguarde alguns minutos e tente de novo.",
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = loanContractRequestSchema.safeParse(body);

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
          "A leitura de contratos não está disponível agora. Você pode cadastrar os dados do contrato manualmente.",
      },
      { status: 503 },
    );
  }

  const { fileBase64, mimeType } = parsed.data;

  try {
    const text = await readFileWithGemini({
      apiKey,
      prompt: buildLoanContractPrompt(),
      fileBase64,
      mimeType,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      timeoutMs: GEMINI_TIMEOUT_MS,
      operation: "aiContrato",
    });

    if (!text) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message:
            "Não consegui ler este contrato. Tente outro arquivo ou preencha os dados à mão.",
        },
        { status: 422 },
      );
    }

    const reading = parseLoanContractReading(text);

    if (!reading) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message:
            "O arquivo foi lido, mas não encontrei valor, parcelas nem prestação. Confira se é o contrato e não o comprovante de depósito.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      reading: {
        institution: reading.institution ?? null,
        kind: reading.kind,
        description: reading.description,
        principalContracted: reading.principalContractedCents ?? null,
        amountDisbursed: reading.amountDisbursedCents ?? null,
        disbursementDate: reading.disbursementDate ?? null,
        amortisationSystem: reading.amortisationSystem,
        interestRateMonthly: reading.interestRateMonthly ?? null,
        rateSource: reading.rateSource,
        cetAnnual: reading.cetAnnual ?? null,
        installmentCount: reading.installmentCount ?? null,
        installmentAmount: reading.installmentAmountCents ?? null,
        firstDueDate: reading.firstDueDate ?? null,
        monthlyFees: reading.monthlyFeesCents ?? null,
        monthlyInsurance: reading.monthlyInsuranceCents ?? null,
        confidence: reading.confidence,
      },
    });
  } catch (error) {
    logger.error("Falha ao processar contrato com IA.", {
      operation: "aiContrato",
      ...describeError(error),
    });
    return NextResponse.json(
      {
        error: "INTERNAL",
        message:
          "Não foi possível ler o contrato agora. Tente novamente ou preencha os dados à mão.",
      },
      { status: 500 },
    );
  }
}
