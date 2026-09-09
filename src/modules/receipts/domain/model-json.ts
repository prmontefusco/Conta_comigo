/**
 * Tirar o JSON da resposta do modelo.
 *
 * Três leitores diferentes pedem JSON e recebem, com frequência, JSON dentro
 * de uma cerca de markdown, ou precedido de uma frase de cortesia. A extração
 * era copiada em cada um deles, com regras ligeiramente diferentes — o que
 * significa que um leitor aceitava uma resposta que o outro rejeitava, sem
 * nenhuma razão de domínio para isso.
 *
 * Aqui a regra é uma só, e vale para objeto e para lista.
 */

/** O primeiro objeto JSON da resposta, ou `null` se não houver nenhum. */
export function extractJsonObject(text: string): unknown {
  return extractJson(text, "{", "}");
}

/** A primeira lista JSON da resposta, ou `null`. */
export function extractJsonArray(text: string): unknown {
  return extractJson(text, "[", "]");
}

function extractJson(text: string, open: string, close: string): unknown {
  const trimmed = text.trim();

  const direct = tryParse(trimmed);
  if (direct !== null) return direct;

  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (fenced?.[1]) {
    const fromFenced = tryParse(fenced[1]);
    if (fromFenced !== null) return fromFenced;
  }

  const start = trimmed.indexOf(open);
  const end = trimmed.lastIndexOf(close);
  if (start !== -1 && end > start) return tryParse(trimmed.slice(start, end + 1));

  return null;
}

function tryParse(source: string): unknown {
  try {
    const value: unknown = JSON.parse(source);
    return value ?? null;
  } catch {
    return null;
  }
}
