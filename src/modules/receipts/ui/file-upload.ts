"use client";

/**
 * Preparar um arquivo para a leitura por IA.
 *
 * Três telas mandam PDF ou foto para uma rota de leitura, e as três precisam
 * das mesmas garantias antes de gastar uma chamada: tipo aceito, tamanho
 * dentro do teto e conteúdo em base64 sem o prefixo `data:`.
 *
 * O arquivo não sobe para lugar nenhum além da requisição que o lê. Não há
 * bucket, não há URL e não há nada para apagar depois (docs/SECURITY.md).
 */

export const AI_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AiUploadMimeType = (typeof AI_UPLOAD_MIME_TYPES)[number];

/** O que o `accept` do input deve oferecer. */
export const AI_UPLOAD_ACCEPT = AI_UPLOAD_MIME_TYPES.join(",");

/** 10 MB. Acima disso o base64 estoura o teto da rota. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class UploadError extends Error {}

export interface PreparedUpload {
  readonly base64: string;
  readonly mimeType: AiUploadMimeType;
}

export async function prepareUpload(file: File): Promise<PreparedUpload> {
  const mimeType = file.type as AiUploadMimeType;

  if (!AI_UPLOAD_MIME_TYPES.includes(mimeType)) {
    throw new UploadError("Formato não aceito. Envie um arquivo PDF, JPG ou PNG.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("O arquivo é grande demais. O limite é de 10MB.");
  }

  return { base64: await toBase64(file), mimeType };
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (base64 === "") reject(new UploadError("Não consegui ler o arquivo escolhido."));
      else resolve(base64);
    };
    reader.onerror = () => reject(new UploadError("Não consegui ler o arquivo escolhido."));
    reader.readAsDataURL(file);
  });
}

/** A mensagem que a rota mandou, quando mandou uma. */
export function messageFromResponse(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const message = (data as Record<string, unknown>).message;
  return typeof message === "string" && message.trim() !== "" ? message : null;
}
