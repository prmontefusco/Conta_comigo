import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

/**
 * 404.
 *
 * O padrão do Next é uma página em inglês, sem identidade e sem saída. Numa
 * ferramenta sobre dinheiro, um endereço quebrado assusta mais do que deveria:
 * quem chega aqui vindo de um link salvo precisa saber que não perdeu nada.
 */
export default function NotFound() {
  return (
    <main
      id="conteudo"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <p className="text-sm font-medium" style={{ color: "var(--muted-fg)" }}>
        Erro 404
      </p>

      <h1 className="text-xl font-semibold">Esta página não existe</h1>

      <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
        O endereço pode ter mudado, ou o link pode estar incompleto. Seus dados estão a salvo — nada
        do que você cadastrou depende desta página.
      </p>

      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] px-4 text-sm font-medium text-white transition-colors hover:bg-[color:var(--color-brand-700)]"
        >
          Ir para o resumo
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 text-sm font-medium transition-colors hover:bg-[color:var(--color-ink-50)]"
        >
          Página inicial
        </Link>
      </div>
    </main>
  );
}
