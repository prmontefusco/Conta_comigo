import { NextResponse } from "next/server";
import { todayIn, tryCalendarDate } from "@/core/date/calendar-date";
import { toDecimal } from "@/core/money/money";
import { describeError, logger } from "@/lib/observability/logger";
import {
  buildReceiptPrompt,
  parseReceiptReading,
  receiptRequestSchema,
} from "@/modules/receipts/domain/receipt-reading";
import { requireAuth } from "@/server/auth-guard";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * Leitura de comprovante por foto.
 *
 * O que esta rota faz é traduzir uma imagem em uma *sugestão* de lançamento.
 * Ela não grava nada: quem grava é a pessoa, depois de olhar o formulário
 * preenchido. Um número lido errado de um cupom amassado precisa ser corrigido
 * antes de virar um saldo, não depois.
 *
 * Três limites, pelos mesmos motivos da rota de consultoria — mais um que só
 * existe aqui:
 *
 * 1. **Autenticada.** Sem token verificado, ninguém gasta a chave do projeto.
 * 2. **Limitada por uid.** Imagem custa mais que texto, então o teto é menor.
 * 3. **Com teto de entrada.** O tamanho do base64 é validado por Zod antes de
 *    qualquer chamada externa.
 * 4. **A foto não é guardada.** Ela chega, vai ao modelo e some com a
 *    requisição. Não há Storage, não há log do corpo, não há retenção deste
 *    lado — o que também é a única razão pela qual esta rota não precisa de um
 *    ciclo de vida de exclusão (docs/SECURITY.md, docs/ADSENSE.md sobre dados
 *    pessoais).
 *
 * Sem `GEMINI_API_KEY` a rota responde 503 e a tela oferece a digitação
 * normal. Aqui não há motor local: não existe OCR determinístico dentro do
 * produto, e fingir que existe seria pior do que dizer que está indisponível.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Fotos por pessoa, por janela. Menor que o da consultoria: imagem custa mais. */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const GEMINI_TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const limit = checkRateLimit(`receipt:${auth.caller.uid}`, RATE_LIMIT, RATE_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Você enviou muitas fotos seguidas. Aguarde alguns minutos e tente de novo.",
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = receiptRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        message: "Não foi possível ler esta imagem. Tente uma foto menor, em JPG ou PNG.",
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "UNAVAILABLE",
        message: "A leitura por foto não está disponível agora. Você pode digitar os dados.",
      },
      { status: 503 },
    );
  }

  const { imageBase64, mimeType, categories } = parsed.data;
  const today = tryCalendarDate(parsed.data.today ?? "") ?? todayIn("America/Sao_Paulo");

  try {
    const text = await readReceiptWithGemini(apiKey, imageBase64, mimeType, categories);

    if (!text) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message: "Não consegui ler este comprovante. Tente outra foto ou digite os dados.",
        },
        { status: 422 },
      );
    }

    const reading = parseReceiptReading(text, {
      allowedCategoryIds: categories.map((category) => category.id),
      today,
    });

    if (!reading) {
      return NextResponse.json(
        {
          error: "UNREADABLE",
          message:
            "A foto foi lida, mas não deu para identificar o valor. Tente aproximar o valor total.",
        },
        { status: 422 },
      );
    }

    // O valor vai como decimal, e não como Money, porque o cliente preenche um
    // campo de texto: reconstruir centavos no formulário é o mesmo caminho de
    // quem digitou à mão, e não abre uma segunda forma de criar dinheiro.
    return NextResponse.json({
      reading: {
        description: reading.description ?? null,
        amount: reading.amount ? toDecimal(reading.amount) : null,
        date: reading.date ?? null,
        installments: reading.installments ?? null,
        categoryId: reading.categoryId ?? null,
        paymentMethod: reading.paymentMethod,
        confidence: reading.confidence,
      },
    });
  } catch (error) {
    logger.error("Falha ao ler comprovante.", {
      operation: "aiComprovante",
      ...describeError(error),
    });
    return NextResponse.json(
      {
        error: "INTERNAL",
        message: "Não foi possível ler a foto agora. Tente novamente ou digite os dados.",
      },
      { status: 500 },
    );
  }
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

/** `null` significa "não deu": a tela oferece a digitação, nunca um chute. */
async function readReceiptWithGemini(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  categories: { id: string; name: string }[],
): Promise<string | null> {
  const model = geminiModel();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // No cabeçalho, nunca na query string.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildReceiptPrompt(categories) },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        // Leitura, não redação: temperatura zero, e teto baixo porque a
        // resposta é um objeto de sete campos.
        generationConfig: { temperature: 0, maxOutputTokens: 600 },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    logger.warn("O modelo recusou a leitura do comprovante.", {
      operation: "aiComprovante",
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
