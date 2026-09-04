"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface ContentGuide {
  href: string;
  title: string;
  shortDesc: string;
  icon: string;
  tag?: string;
}

export const CONTENT_GUIDES: readonly ContentGuide[] = [
  {
    href: "/organizar-financas",
    title: "Organizar as Finanças",
    shortDesc: "O passo a passo prático para sair da confusão sem pânico.",
    icon: "🧭",
    tag: "Essencial",
  },
  {
    href: "/controle-de-cartao",
    title: "Controle de Cartão",
    shortDesc: "Como desarmar o efeito bola de neve de faturas e parcelas.",
    icon: "💳",
    tag: "Prático",
  },
  {
    href: "/controle-de-contas",
    title: "Controle de Contas",
    shortDesc: "Organize vencimentos e nunca mais pague juros por atraso.",
    icon: "📄",
  },
  {
    href: "/orcamento-familiar",
    title: "Orçamento Familiar",
    shortDesc: "Como alinhar as contas da casa sem brigas e com transparência.",
    icon: "👨‍👩‍👧‍👦",
  },
  {
    href: "/planejamento-financeiro",
    title: "Planejamento Futuro",
    shortDesc: "Enxergue seus próximos 3, 6 e 12 meses antes que cheguem.",
    icon: "📈",
  },
  {
    href: "/educacao-financeira",
    title: "Educação Financeira",
    shortDesc: "Conceitos simples que mudam suas decisões do dia a dia.",
    icon: "💡",
  },
] as const;

export function PublicHeader() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Fecha menus ao trocar de página
  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--card-border)] bg-[color:var(--card-bg)]/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:py-3.5">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-xs transition-transform group-hover:scale-105">
            <Image
              src="/logo.png"
              alt="Logo Conta comigo"
              width={36}
              height={36}
              className="size-full object-cover"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight text-[color:var(--color-ink-900)]">
              Conta comigo
            </span>
            <span className="text-[10px] font-medium tracking-wide text-[color:var(--muted-fg)] uppercase">
              Finanças sem ansiedade
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Principal" className="hidden items-center gap-1.5 md:flex">
          <Link
            href="/como-funciona"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-ink-700)] transition-colors hover:bg-slate-100/80 hover:text-[color:var(--color-ink-900)]"
          >
            Como funciona
          </Link>

          {/* Modern Dropdown: Guias & Conteúdos */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                dropdownOpen
                  ? "bg-slate-100 text-[color:var(--color-ink-900)]"
                  : "text-[color:var(--color-ink-700)] hover:bg-slate-100/80 hover:text-[color:var(--color-ink-900)]"
              }`}
            >
              <span>Guias & Dicas</span>
              <svg
                className={`size-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180 text-[color:var(--color-brand-600)]" : "text-slate-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="glass-panel animate-in fade-in slide-in-from-top-2 absolute top-full left-1/2 mt-2 w-[480px] -translate-x-1/2 rounded-2xl p-3 shadow-xl ring-1 ring-slate-900/5 duration-150">
                <div className="mb-2 flex items-center justify-between border-b border-slate-100 px-3 pb-2">
                  <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Aprenda a recuperar o controle
                  </span>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                    Conteúdos Gratuitos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {CONTENT_GUIDES.map((guide) => (
                    <Link
                      key={guide.href}
                      href={guide.href}
                      className="group flex flex-col rounded-xl p-2.5 transition-colors hover:bg-slate-50/90"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base transition-transform group-hover:scale-110">
                          {guide.icon}
                        </span>
                        <span className="text-sm font-medium text-slate-900 group-hover:text-teal-700">
                          {guide.title}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {guide.shortDesc}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/planos"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-ink-700)] transition-colors hover:bg-slate-100/80 hover:text-[color:var(--color-ink-900)]"
          >
            Planos
          </Link>

          <div className="mx-2 h-4 w-px bg-slate-200" aria-hidden="true" />

          <Link
            href="/entrar"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-ink-700)] transition-colors hover:bg-slate-100/80 hover:text-[color:var(--color-ink-900)]"
          >
            Entrar
          </Link>

          <Link
            href="/criar-conta"
            className="inline-flex min-h-10 items-center rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-4.5 text-sm font-medium text-white shadow-sm transition-all hover:from-teal-700 hover:to-cyan-700 hover:shadow"
          >
            Começar agora
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          className="flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 md:hidden"
        >
          {mobileMenuOpen ? (
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-100 bg-white/95 px-4 pt-3 pb-6 shadow-lg backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-2">
            <Link
              href="/como-funciona"
              className="rounded-lg px-3 py-2 text-base font-medium text-slate-800 hover:bg-slate-50"
            >
              🚀 Como funciona
            </Link>

            <Link
              href="/planos"
              className="rounded-lg bg-teal-50/60 px-3 py-2 text-base font-medium text-teal-800 hover:bg-teal-50"
            >
              💎 Planos (30 dias grátis)
            </Link>

            <div className="mt-2 border-t border-slate-100 pt-2">
              <p className="px-3 py-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Guias & Conteúdos
              </p>
              <div className="mt-1 space-y-1">
                {CONTENT_GUIDES.map((guide) => (
                  <Link
                    key={guide.href}
                    href={guide.href}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>{guide.icon}</span>
                    <span className="font-medium">{guide.title}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Link
                href="/entrar"
                className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Entrar
              </Link>
              <Link
                href="/criar-conta"
                className="flex min-h-11 items-center justify-center rounded-xl bg-teal-600 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
              >
                Criar conta gratuita
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200/80 bg-slate-50/60 backdrop-blur-xs">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coluna 1: Missão & Propósito */}
          <div className="space-y-3 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <div className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-2xs">
                <Image
                  src="/logo.png"
                  alt="Conta comigo"
                  width={28}
                  height={28}
                  className="size-full object-cover"
                />
              </div>
              <span className="font-semibold tracking-tight text-slate-900">Conta comigo</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Planejamento pessoal e familiar sem ansiedade. Criado para acolher, clarear os números
              e devolver o fôlego a quem quer organizar as contas sem julgamentos morais.
            </p>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Seus dados nunca são vendidos
            </div>
          </div>

          {/* Coluna 2: Guias e Conteúdos */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Guias Práticos
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/organizar-financas"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Organizar as Finanças
                </Link>
              </li>
              <li>
                <Link
                  href="/controle-de-cartao"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Controle de Cartão
                </Link>
              </li>
              <li>
                <Link
                  href="/orcamento-familiar"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Orçamento Familiar
                </Link>
              </li>
              <li>
                <Link
                  href="/educacao-financeira"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Educação Financeira
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Planejamento & Rotina */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Planejamento
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/planos"
                  className="font-medium text-teal-700 transition-colors hover:text-teal-800"
                >
                  Planos & Assinatura (30 dias grátis)
                </Link>
              </li>
              <li>
                <Link
                  href="/como-funciona"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Como Funciona
                </Link>
              </li>
              <li>
                <Link
                  href="/planejamento-financeiro"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Visão de Futuro
                </Link>
              </li>
              <li>
                <Link
                  href="/controle-de-contas"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Contas a Pagar
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Transparência & Segurança */}
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Transparência
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/privacidade"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/termos"
                  className="text-slate-600 transition-colors hover:text-teal-700"
                >
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer Legal & Ético */}
        <div className="mt-12 border-t border-slate-200/60 pt-6">
          <p className="max-w-3xl text-[11px] leading-relaxed text-slate-500">
            O Conta comigo organiza e apresenta as suas próprias informações financeiras. Não somos
            instituição bancária nem oferecemos empréstimos ou consultoria de investimentos. As
            projeções são cálculos matemáticos transparentes baseados no que você insere. As
            decisões são sempre soberanamente suas.
          </p>

          <div className="mt-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Conta comigo. Todos os direitos reservados.
            </p>
            <p className="text-xs text-slate-400">Feito com carinho para famílias brasileiras.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
