import Link from "next/link";
import { AdSenseScript } from "@/components/ads/ad-slot";

const FOOTER_LINKS = [
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/organizar-financas", label: "Organizar as finanças" },
  { href: "/planejamento-financeiro", label: "Planejamento financeiro" },
  { href: "/controle-de-contas", label: "Controle de contas" },
  { href: "/controle-de-cartao", label: "Controle de cartão" },
  { href: "/orcamento-familiar", label: "Orçamento familiar" },
  { href: "/educacao-financeira", label: "Educação financeira" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos de uso" },
] as const;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AdSenseScript />

      <header className="border-b border-[color:var(--card-border)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Conta comigo
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-2 text-sm">
            <Link
              href="/como-funciona"
              className="hidden min-h-11 items-center px-3 sm:inline-flex"
            >
              Como funciona
            </Link>
            <Link href="/entrar" className="inline-flex min-h-11 items-center px-3">
              Entrar
            </Link>
            <Link
              href="/criar-conta"
              className="inline-flex min-h-11 items-center rounded-lg bg-[color:var(--color-brand-600)] px-4 font-medium text-white"
            >
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="flex-1">
        {children}
      </main>

      <footer className="mt-16 border-t border-[color:var(--card-border)]">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <nav aria-label="Rodapé">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="mt-8 max-w-prose text-xs" style={{ color: "var(--muted-fg)" }}>
            O Conta comigo organiza e apresenta as suas próprias informações financeiras. Não somos
            instituição financeira, não oferecemos crédito e não fazemos recomendação de
            investimentos. As projeções são cálculos a partir do que você cadastra, não previsões
            garantidas. As decisões são sempre suas.
          </p>

          <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
            © {new Date().getFullYear()} Conta comigo
          </p>
        </div>
      </footer>
    </div>
  );
}
