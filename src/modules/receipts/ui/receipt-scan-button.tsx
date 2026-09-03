"use client";

import { useRef, useState } from "react";
import { Button, Callout } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * Reading a receipt from a photo, so the person types as little as possible.
 *
 * Three things this deliberately does not do:
 *
 * - It does not save anything. The reading fills the form; the person still
 *   looks at it and confirms. An OCR that writes straight to the ledger turns
 *   one misread digit into a wrong balance nobody notices.
 * - It does not upload the photo anywhere. The image is resized in the
 *   browser, sent in the request that reads it, and forgotten. There is no
 *   bucket, no URL, nothing to delete later.
 * - It does not send the original file. A modern phone photo is several
 *   megabytes; downscaling first is what makes this usable on a mobile data
 *   plan, which is where it will actually be used - standing at the counter.
 */

export interface ReceiptSuggestion {
  readonly description: string | null;
  /** Reais, as a decimal number. The form still parses it like typed text. */
  readonly amount: number | null;
  readonly date: string | null;
  readonly installments: number | null;
  readonly categoryId: string | null;
  readonly paymentMethod: "CREDITO" | "DEBITO" | "DINHEIRO" | "PIX" | "OUTRO" | "DESCONHECIDO";
  readonly confidence: "ALTA" | "MEDIA" | "BAIXA";
}

/** Long enough that text stays legible, small enough to upload on 4G. */
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.72;

export function ReceiptScanButton({ onRead }: { onRead: (reading: ReceiptSuggestion) => void }) {
  const { user } = useSession();
  const { categories, asOf } = useFinance();
  const inputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "reading">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onPick(file: File) {
    setMessage(null);
    setStatus("reading");

    try {
      const { base64, mimeType } = await downscaleToJpeg(file);
      const token = await user?.getIdToken();

      if (!token) {
        setMessage("Entre na sua conta para usar a leitura por foto.");
        return;
      }

      const response = await fetch("/api/ai/comprovante", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          today: asOf,
          categories: categories
            .filter((category) => category.kind === "EXPENSE" && !category.archived)
            .map((category) => ({ id: category.id, name: category.name })),
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(
          readMessage(data) ?? "Não foi possível ler a foto agora. Você pode digitar os dados.",
        );
        return;
      }

      const reading = (data as { reading?: ReceiptSuggestion } | null)?.reading;
      if (!reading) {
        setMessage("Não consegui ler este comprovante. Tente outra foto ou digite os dados.");
        return;
      }

      onRead(reading);
      setMessage(
        reading.confidence === "ALTA"
          ? "Li o comprovante. Confira os campos antes de salvar."
          : "Li o que deu para ver. Confira com atenção — a foto estava difícil.",
      );
    } catch (error) {
      console.error(error);
      setMessage("Não foi possível ler a foto agora. Você pode digitar os dados.");
    } finally {
      setStatus("idle");
      // Lets the same file be picked again after a correction.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // On a phone this opens the camera directly; on a desktop it is
        // ignored and the file picker opens, which is the right fallback.
        capture="environment"
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
        {status === "reading" ? "Lendo a foto…" : "📷 Ler comprovante por foto"}
      </Button>

      {message ? (
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          {message}
        </p>
      ) : (
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          A foto é lida na hora e não fica guardada. Os campos vêm preenchidos para você conferir.
        </p>
      )}

      {status === "reading" ? (
        <Callout tone="info" title="Lendo">
          Isso leva alguns segundos. Não feche esta janela.
        </Callout>
      ) : null}
    </div>
  );
}

function readMessage(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const message = (data as Record<string, unknown>).message;
  return typeof message === "string" ? message : null;
}

/**
 * Resizes the photo in the browser and returns it as base64 JPEG.
 *
 * Done here rather than on the server because the bytes never need to travel:
 * a 12-megapixel photo and a 1600px one are read exactly the same by the
 * model, and only one of them costs the person their data plan.
 */
async function downscaleToJpeg(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível para redimensionar a imagem.");

  // A receipt is dark text on white paper; a white ground keeps a photo with
  // transparency from arriving as text on black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
}
