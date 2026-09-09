"use client";

import { useRef, useState } from "react";
import { Button, Callout } from "@/components/ui/primitives";
import { useSession } from "@/modules/household/ui/session-provider";
import { AI_UPLOAD_ACCEPT, messageFromResponse, prepareUpload, UploadError } from "./file-upload";

/**
 * Ler o contrato de empréstimo e preencher o formulário.
 *
 * O cadastro de uma dívida pede quinze números espalhados por um PDF de oito
 * páginas — taxa ao mês, CET ao ano, valor liberado, primeiro vencimento — e é
 * o formulário que as pessoas mais abandonam pela metade. Uma dívida não
 * cadastrada é uma parcela que não aparece na projeção, e a projeção é o
 * produto.
 *
 * O que este botão faz é preencher. Ele **não salva**: a pessoa vê o
 * formulário preenchido, confere contra o contrato e confirma. Uma taxa lida
 * errada e gravada em silêncio mudaria a ordem de quitação que o aplicativo
 * recomenda, que é a decisão mais cara que ele ajuda a tomar.
 */

export interface ContractSuggestion {
  readonly institution: string | null;
  readonly kind: string;
  readonly description: string;
  /** Centavos. */
  readonly principalContracted: number | null;
  readonly amountDisbursed: number | null;
  readonly disbursementDate: string | null;
  readonly amortisationSystem: "PRICE" | "SAC" | "SIMPLE";
  /** Pontos percentuais ao mês. */
  readonly interestRateMonthly: number | null;
  readonly rateSource: "CONTRACT" | "CONVERTED_FROM_ANNUAL" | "UNKNOWN";
  readonly cetAnnual: number | null;
  readonly installmentCount: number | null;
  readonly installmentAmount: number | null;
  readonly firstDueDate: string | null;
  readonly monthlyFees: number | null;
  readonly monthlyInsurance: number | null;
  readonly confidence: "ALTA" | "MEDIA" | "BAIXA";
}

export function ContractImportButton({
  onRead,
}: {
  onRead: (suggestion: ContractSuggestion) => void;
}) {
  const { user } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "reading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"info" | "attention">("info");

  async function onPick(file: File) {
    setMessage(null);
    setStatus("reading");

    try {
      const { base64, mimeType } = await prepareUpload(file);
      const token = await user?.getIdToken();

      if (!token) {
        setTone("attention");
        setMessage("Entre na sua conta para usar a leitura de contrato.");
        return;
      }

      const response = await fetch("/api/ai/contrato", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileBase64: base64, mimeType }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setTone("attention");
        setMessage(
          messageFromResponse(data) ??
            "Não consegui ler este contrato agora. Você pode preencher os dados à mão.",
        );
        return;
      }

      const suggestion = readSuggestion(data);
      if (!suggestion) {
        setTone("attention");
        setMessage("O arquivo foi lido, mas não encontrei os dados do contrato.");
        return;
      }

      onRead(suggestion);
      setTone("info");
      setMessage(describe(suggestion));
    } catch (error) {
      setTone("attention");
      setMessage(
        error instanceof UploadError
          ? error.message
          : "Não consegui ler este contrato agora. Você pode preencher os dados à mão.",
      );
    } finally {
      setStatus("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={AI_UPLOAD_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onPick(file);
        }}
      />

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={status === "reading"}
        onClick={() => inputRef.current?.click()}
      >
        {status === "reading" ? "Lendo o contrato…" : "📄 Ler contrato em PDF ou foto"}
      </Button>

      {message ? (
        <Callout tone={tone}>
          <span className="text-sm">{message}</span>
        </Callout>
      ) : null}

      {status === "idle" && !message ? (
        <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
          O contrato é enviado só para ser lido, não fica guardado, e o formulário abaixo é
          preenchido para você conferir antes de salvar.
        </p>
      ) : null}
    </div>
  );
}

/** O que dizer depois de ler, incluindo de onde saiu a taxa. */
function describe(suggestion: ContractSuggestion): string {
  const parts: string[] = ["Contrato lido. Confira os campos contra o documento antes de salvar."];

  if (suggestion.rateSource === "CONVERTED_FROM_ANNUAL") {
    parts.push(
      "A taxa mensal foi calculada a partir da taxa anual do contrato — confira se bate com o que está escrito.",
    );
  }
  if (suggestion.rateSource === "UNKNOWN") {
    parts.push(
      "Não encontrei a taxa de juros. Sem ela, a parcela inteira conta como amortização e o custo do contrato não aparece.",
    );
  }
  if (suggestion.confidence === "BAIXA") {
    parts.push("A leitura ficou incerta: vale conferir número por número.");
  }

  return parts.join(" ");
}

function readSuggestion(data: unknown): ContractSuggestion | null {
  const reading = readField(data, "reading");
  if (typeof reading !== "object" || reading === null) return null;

  const system = readField(reading, "amortisationSystem");
  const rateSource = readField(reading, "rateSource");
  const confidence = readField(reading, "confidence");
  const description = readField(reading, "description");
  const kind = readField(reading, "kind");

  return {
    institution: readString(reading, "institution"),
    kind: typeof kind === "string" ? kind : "PERSONAL_LOAN",
    description: typeof description === "string" ? description : "Contrato de crédito",
    principalContracted: readNumber(reading, "principalContracted"),
    amountDisbursed: readNumber(reading, "amountDisbursed"),
    disbursementDate: readString(reading, "disbursementDate"),
    amortisationSystem: system === "SAC" || system === "SIMPLE" ? system : "PRICE",
    interestRateMonthly: readNumber(reading, "interestRateMonthly"),
    rateSource:
      rateSource === "CONTRACT" || rateSource === "CONVERTED_FROM_ANNUAL" ? rateSource : "UNKNOWN",
    cetAnnual: readNumber(reading, "cetAnnual"),
    installmentCount: readNumber(reading, "installmentCount"),
    installmentAmount: readNumber(reading, "installmentAmount"),
    firstDueDate: readString(reading, "firstDueDate"),
    monthlyFees: readNumber(reading, "monthlyFees"),
    monthlyInsurance: readNumber(reading, "monthlyInsurance"),
    confidence: confidence === "ALTA" || confidence === "BAIXA" ? confidence : "MEDIA",
  };
}

function readField(data: unknown, key: string): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  return (data as Record<string, unknown>)[key];
}

function readString(data: unknown, key: string): string | null {
  const value = readField(data, key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readNumber(data: unknown, key: string): number | null {
  const value = readField(data, key);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
