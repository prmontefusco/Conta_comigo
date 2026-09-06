import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sem conexão | Conta comigo",
  robots: { index: false, follow: false },
};

/**
 * A página que o service worker mostra quando não há rede.
 *
 * Não mostra número nenhum de propósito. Um saldo em cache num aparelho sem
 * conexão é um saldo velho, e uma decisão de dinheiro tomada sobre um número
 * desatualizado é pior do que uma decisão adiada.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="text-4xl" aria-hidden="true">
        📶
      </p>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">Sem conexão agora</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        O Conta comigo precisa de internet para mostrar seus números atualizados. Preferimos não
        mostrar nada a mostrar um saldo de ontem como se fosse o de hoje.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        Assim que a conexão voltar, é só recarregar. Nada do que você cadastrou se perdeu.
      </p>
    </main>
  );
}
