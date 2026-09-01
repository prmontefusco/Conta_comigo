"use client";

import { useEffect } from "react";
import { logger } from "@/lib/observability/logger";

/**
 * Limite de erro das rotas.
 *
 * Sem isto, uma exceção em componente cliente deixa a tela **branca**. Num
 * produto cujo público já está ansioso com dinheiro, uma tela branca não é um
 * detalhe de robustez: é a pessoa sem saber se perdeu o que cadastrou.
 *
 * A mensagem diz duas coisas, e as duas importam: que os dados estão salvos, e
 * o que fazer agora. O conteúdo do erro **não** aparece — ele carrega caminhos
 * e códigos que não ajudam quem está lendo, e vai para o log, que é onde serve.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // `digest` é o identificador que o Next também grava no log do servidor: é
    // por ele que se liga o relato de alguém à falha registrada.
    logger.error("Tela quebrou.", {
      operation: "routeErrorBoundary",
      name: error.name,
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <main
      id="conteudo"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <h1 className="text-xl font-semibold">Algo quebrou nesta tela</h1>

      <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
        A falha foi ao mostrar a página, não ao guardar seus dados.{" "}
        <strong>Nada do que você cadastrou foi perdido.</strong>
      </p>

      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white transition-colors hover:bg-[color:var(--color-brand-700)]"
        >
          Tentar de novo
        </button>
        <a
          href="/app"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 text-sm font-medium transition-colors hover:bg-[color:var(--color-ink-50)]"
        >
          Voltar ao resumo
        </a>
      </div>

      {error.digest ? (
        <p className="text-2xs mt-4" style={{ color: "var(--muted-fg)" }}>
          Código da ocorrência: <code>{error.digest}</code>
        </p>
      ) : null}
    </main>
  );
}
