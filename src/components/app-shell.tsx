"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button, Spinner } from "@/components/ui/primitives";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * The authenticated shell.
 *
 * Mobile-first: primary navigation sits at the bottom, within thumb reach, and
 * moves to a sidebar from the medium breakpoint up. Every destination is a real
 * link, so the browser's back button and keyboard navigation behave normally.
 */

const DESKTOP_NAV = [
  { href: "/app", label: "Início", icon: "🏠" },
  { href: "/app/dia-a-dia", label: "Dia a dia", icon: "🧾" },
  { href: "/app/diagnostico-ia", label: "Diagnóstico IA", icon: "✨" },
  { href: "/app/visao-futuro", label: "Visão de Futuro", icon: "🚀" },
  { href: "/app/contas", label: "Contas a Pagar", icon: "📄" },
  { href: "/app/cartoes", label: "Cartões", icon: "💳" },
  { href: "/app/dividas", label: "Dívidas & Empréstimos", icon: "🏛️" },
  { href: "/app/projecao", label: "Projeção & Fluxo", icon: "📈" },
  { href: "/app/mais", label: "Mais Opções", icon: "⋯" },
] as const;

// The bottom bar holds what someone opens standing in a queue. Registering a
// gasto is the most frequent of those; Diagnóstico is one tap further, in Mais.
const MOBILE_NAV = [
  { href: "/app", label: "Início", icon: "🏠" },
  { href: "/app/dia-a-dia", label: "Dia a dia", icon: "🧾" },
  { href: "/app/visao-futuro", label: "Futuro", icon: "🚀" },
  { href: "/app/contas", label: "Contas", icon: "📄" },
  { href: "/app/mais", label: "Mais", icon: "⋯" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { status, household, households, selectHousehold, logout, profile } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/entrar");
  }, [status, router]);

  if (status === "loading") {
    return <Spinner label="Carregando sua conta" />;
  }

  if (status === "unauthenticated") {
    return <Spinner label="Redirecionando" />;
  }

  if (!household) {
    return (
      <main id="conteudo" className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Vamos criar seu primeiro grupo</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
          Um grupo pode ser você sozinho, um casal ou a família inteira. É onde suas contas, cartões
          e projeções ficam guardados.
        </p>
        <Button className="mt-6 w-full" onClick={() => router.push("/app/comecar")}>
          Criar meu grupo
        </Button>
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[color:var(--card-border)] bg-[color:var(--card-bg)]/95 shadow-2xs backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{household.name}</p>
            <p className="truncate text-xs" style={{ color: "var(--muted-fg)" }}>
              {profile?.displayName ?? "Você"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {households.length > 1 ? (
              <label className="text-sm">
                <span className="sr-only">Trocar de grupo</span>
                <select
                  value={household.id}
                  onChange={(event) => selectHousehold(event.target.value)}
                  className="min-h-11 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 text-sm shadow-2xs"
                >
                  {households.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button variant="ghost" onClick={() => void logout()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-4 md:py-6">
        <nav aria-label="Navegação principal" className="hidden w-52 shrink-0 md:block">
          <ul className="sticky top-20 space-y-1">
            {DESKTOP_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={navLinkClass(isActive(pathname, item.href))}
                >
                  <span aria-hidden="true" className="text-base">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main id="conteudo" className="min-w-0 flex-1 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--card-border)] bg-[color:var(--card-bg)]/98 shadow-lg backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg">
          {MOBILE_NAV.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition ${
                  isActive(pathname, item.href)
                    ? "bg-[color:var(--color-brand-50)] font-bold text-[color:var(--color-brand-700)]"
                    : "text-[color:var(--page-fg)] hover:text-[color:var(--color-brand-600)]"
                }`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

function navLinkClass(active: boolean): string {
  return [
    "flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
    active
      ? "bg-[color:var(--color-brand-100)] font-semibold text-[color:var(--color-brand-700)] shadow-2xs border border-[color:var(--color-brand-600)]/20"
      : "hover:bg-[color:var(--color-ink-100)] text-[color:var(--page-fg)]",
  ].join(" ");
}
