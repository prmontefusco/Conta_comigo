"use client";

import { useEffect } from "react";
import { logger } from "@/lib/observability/logger";

/**
 * Último limite de erro.
 *
 * Só entra quando o próprio layout raiz falha — caso em que o `error.tsx` das
 * rotas nunca chega a montar. Por isso este arquivo traz `<html>` e `<body>`
 * próprios: neste ponto não existe layout nenhum acima dele.
 *
 * Sem CSS do projeto e sem componentes: se o layout quebrou, não dá para
 * assumir que o resto carregou. O estilo aqui é inline de propósito, e feio de
 * propósito — o que precisa funcionar é a frase e o botão.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Layout raiz quebrou.", {
      operation: "globalErrorBoundary",
      name: error.name,
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8f9",
          color: "#1a1d21",
        }}
      >
        <main style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>O aplicativo não carregou</h1>

          <p style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
            A falha foi ao abrir a aplicação, não ao guardar seus dados.{" "}
            <strong>Nada do que você cadastrou foi perdido.</strong> Recarregar costuma resolver.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "2.75rem",
              padding: "0 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#0f6b73",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>

          {error.digest ? (
            <p style={{ fontSize: "0.6875rem", marginTop: "1.5rem", opacity: 0.7 }}>
              Código da ocorrência: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
