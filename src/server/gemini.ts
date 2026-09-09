import "server-only";

import { describeError, logger } from "@/lib/observability/logger";

/**
 * A chamada ao modelo que lê arquivos.
 *
 * Quatro rotas mandam um arquivo e um prompt para o mesmo endpoint e leem a
 * resposta da mesma forma. Estava copiado quatro vezes, com pequenas
 * diferenças que não eram decisões: uma tratava erro de rede, outra não; uma
 * lia só a primeira parte da resposta, outra também.
 *
 * O contrato aqui é estreito de propósito: devolve o texto do modelo ou
 * `null`. `null` significa "não deu" — e cada rota já sabe o que oferecer no
 * lugar, que é sempre a digitação manual. Nenhuma rota deve inventar uma
 * leitura porque a chamada falhou.
 *
 * A chave vai no cabeçalho, nunca na query string: uma URL vaza em log de
 * proxy, em histórico e em relatório de erro.
 */

export interface GeminiFileReadInput {
  readonly apiKey: string;
  readonly prompt: string;
  readonly fileBase64: string;
  readonly mimeType: string;
  /** Teto de saída. Leitura estruturada, não redação: cabe pouco. */
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  /** Aparece no log, para saber qual leitura falhou. */
  readonly operation: string;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export async function readFileWithGemini(input: GeminiFileReadInput): Promise<string | null> {
  const model = geminiModel();

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": input.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: input.prompt },
                { inline_data: { mime_type: input.mimeType, data: input.fileBase64 } },
              ],
            },
          ],
          // Leitura, não criação: temperatura zero.
          generationConfig: { temperature: 0, maxOutputTokens: input.maxOutputTokens },
        }),
        signal: AbortSignal.timeout(input.timeoutMs),
      },
    );
  } catch (error) {
    logger.warn("Não foi possível falar com o modelo.", {
      operation: input.operation,
      model,
      ...describeError(error),
    });
    return null;
  }

  if (!response.ok) {
    logger.warn("O modelo recusou a leitura do arquivo.", {
      operation: input.operation,
      status: response.status,
      model,
    });
    return null;
  }

  const data: unknown = await response.json().catch(() => null);
  const text = readCandidateText(data);
  return text && text.trim() !== "" ? text : null;
}

/**
 * O texto da resposta.
 *
 * O modelo pode partir a resposta em vários `parts`; um extrato longo é
 * justamente o caso em que isso acontece. Ler só o primeiro pedaço devolveria
 * um JSON cortado no meio, que falha no parser sem dizer por quê.
 */
function readCandidateText(data: unknown): string | undefined {
  const candidates = readUnknown(data, "candidates");
  if (!Array.isArray(candidates)) return undefined;

  const parts = readUnknown(readUnknown(candidates[0], "content"), "parts");
  if (!Array.isArray(parts)) return undefined;

  const text = parts
    .map((part) => readUnknown(part, "text"))
    .filter((value): value is string => typeof value === "string")
    .join("");

  return text === "" ? undefined : text;
}

function readUnknown(data: unknown, key: string): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  return (data as Record<string, unknown>)[key];
}
