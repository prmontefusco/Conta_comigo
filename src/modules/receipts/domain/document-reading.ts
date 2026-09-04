import { z } from "zod";
import { type CalendarDate, tryCalendarDate } from "@/core/date/calendar-date";
import { fromDecimal, type Money } from "@/core/money/money";

/**
 * Reading bank bills, utility bills and credit card statements in PDF or Image.
 *
 * In Brazil, households receive bills by email in PDF format (energy, water,
 * telecom, condo fees, credit card statements) or as pictures.
 *
 * This module extracts and validates the essential fields:
 * - Document type (utility bill vs card statement vs generic boleto).
 * - Issuer / Institution (e.g. Sabesp, Enel, Nubank, Itaú).
 * - Total amount.
 * - Due date (vencimento).
 * - Digitable line / barcode (linha digitável), if present.
 */

export const documentModelSchema = z.object({
  tipoDocumento: z.enum(["CONTA_CONSUMO", "FATURA_CARTAO", "BOLETO_GERAL", "OUTRO"]).nullish(),
  emissor: z.string().trim().max(120).nullish(),
  descricao: z.string().trim().max(120).nullish(),
  valorTotal: z.number().nullish(),
  valorMinimo: z.number().nullish(),
  dataVencimento: z.string().trim().max(10).nullish(),
  linhaDigitavel: z.string().trim().max(80).nullish(),
  confianca: z.enum(["ALTA", "MEDIA", "BAIXA"]).nullish(),
});

export type DocumentType = "CONTA_CONSUMO" | "FATURA_CARTAO" | "BOLETO_GERAL" | "OUTRO";

export interface DocumentReading {
  readonly documentType: DocumentType;
  readonly issuer?: string;
  readonly description: string;
  readonly totalAmount?: Money;
  readonly minimumAmount?: Money;
  readonly dueDate?: CalendarDate;
  readonly barcode?: string;
  readonly confidence: "ALTA" | "MEDIA" | "BAIXA";
}

export const documentRequestSchema = z.object({
  fileBase64: z.string().min(20).max(15_000_000), // Suporta até ~10MB codificado
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
});

export function buildDocumentPrompt(): string {
  return [
    "Você é um assistente financeiro especialista em leitura de contas, boletos e faturas de cartão de crédito brasileiras.",
    "Analise o arquivo anexo (PDF ou imagem) e extraia os dados com precisão:",
    "",
    "Retorne EXCLUSIVAMENTE um objeto JSON válido com as seguintes propriedades:",
    "- tipoDocumento: 'CONTA_CONSUMO' (água, luz, gás, telefone, internet, condomínio), 'FATURA_CARTAO' (fatura de cartão de crédito), 'BOLETO_GERAL' ou 'OUTRO'.",
    "- emissor: nome da empresa, concessionária ou banco (ex: Enel, Sabesp, Vivo, Claro, Nubank, Itaú, Bradesco).",
    "- descricao: resumo curto (ex: 'Conta de Luz - Enel', 'Fatura Cartão Nubank', 'Condomínio').",
    "- valorTotal: número decimal do valor total a pagar (ex: 184.50). Não inclua símbolo de moeda.",
    "- valorMinimo: se for fatura de cartão e houver pagamento mínimo, número decimal.",
    "- dataVencimento: data de vencimento no formato 'YYYY-MM-DD'.",
    "- linhaDigitavel: os números da linha digitável ou código de barras do boleto, se visível.",
    "- confianca: 'ALTA', 'MEDIA' ou 'BAIXA'.",
    "",
    "Se algum campo não estiver legível, preencha com null.",
  ].join("\n");
}

export function parseDocumentReading(text: string): DocumentReading | null {
  const json = extractJsonObject(text);
  if (!json) return null;

  const parsed = documentModelSchema.safeParse(json);
  if (!parsed.success) return null;

  const raw = parsed.data;

  const totalAmount =
    typeof raw.valorTotal === "number" && Number.isFinite(raw.valorTotal) && raw.valorTotal > 0
      ? fromDecimal(Math.round(raw.valorTotal * 100) / 100)
      : undefined;

  const minimumAmount =
    typeof raw.valorMinimo === "number" && Number.isFinite(raw.valorMinimo) && raw.valorMinimo > 0
      ? fromDecimal(Math.round(raw.valorMinimo * 100) / 100)
      : undefined;

  const dueDate = raw.dataVencimento
    ? (tryCalendarDate(raw.dataVencimento) ?? undefined)
    : undefined;

  const issuer = raw.emissor?.trim() || undefined;
  const description = raw.descricao?.trim() || (issuer ? `Conta - ${issuer}` : "Conta importada");

  if (!totalAmount && !dueDate && !issuer) return null;

  return {
    documentType: raw.tipoDocumento ?? "BOLETO_GERAL",
    issuer,
    description,
    totalAmount,
    minimumAmount,
    dueDate,
    barcode: raw.linhaDigitavel?.trim() || undefined,
    confidence: raw.confianca ?? "MEDIA",
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    const fromFenced = tryParse(fenced[1]);
    if (fromFenced) return fromFenced;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return tryParse(trimmed.slice(start, end + 1));
  }

  return null;
}

function tryParse(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}
