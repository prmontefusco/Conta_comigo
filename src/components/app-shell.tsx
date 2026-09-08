"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Spinner } from "@/components/ui/primitives";
import { useSession } from "@/modules/household/ui/session-provider";
import { AlertBell } from "@/modules/alerts/ui/alert-bell";

/**
 * The authenticated shell.
 *
 * Mobile-first: primary navigation sits at the bottom, within thumb reach, and
 * moves to a sidebar from the medium breakpoint up. Every destination is a real
 * link, so the browser's back button and keyboard navigation behave normally.
 */

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  readonly restrictedForDependent?: boolean;
}

interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/**
 * O menu lateral leva **tudo**, e o do celular leva o essencial.
 *
 * Antes, o lateral tinha um item "Mais Opções" que abria uma página com metade
 * do produto: contas bancárias, reservas, orçamento, recorrentes, relatórios,
 * negociação. Quem está no desktop tem espaço de sobra na coluna e não deveria
 * precisar de um segundo salto para chegar a uma tela que cabe aqui — o efeito
 * prático era que essas telas não existiam para quem não caçasse.
 *
 * No celular a decisão é a oposta, e por um motivo físico: a barra inferior
 * comporta cinco ou seis alvos do tamanho de um polegar. Ali "Mais" continua
 * sendo o único caminho para a cauda longa, e `/app/mais` continua existindo
 * por causa disso.
 */
const DESKTOP_NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Visão Geral",
    items: [
      { href: "/app", label: "Início", icon: "🏠" },
      { href: "/app/avisos", label: "Avisos", icon: "🔔" },
    ],
  },
  {
    title: "Dia a Dia & Contas",
    items: [
      { href: "/app/dia-a-dia", label: "Lançamentos", icon: "🧾" },
      { href: "/app/contas", label: "Contas a Pagar", icon: "📄" },
      {
        href: "/app/contas-bancarias",
        label: "Contas e saldos",
        icon: "🏦",
        restrictedForDependent: true,
      },
      { href: "/app/cartoes", label: "Cartões", icon: "💳", restrictedForDependent: true },
      {
        href: "/app/recorrentes",
        label: "Contas que se repetem",
        icon: "🔁",
        restrictedForDependent: true,
      },
      {
        href: "/app/importar",
        label: "Importar extrato",
        icon: "📥",
        restrictedForDependent: true,
      },
    ],
  },
  {
    title: "Planejamento & Futuro",
    items: [
      { href: "/app/emergencia", label: "Pagar primeiro", icon: "🚨" },
      { href: "/app/plano", label: "Plano de ação", icon: "🧭" },
      {
        href: "/app/orcamento",
        label: "Orçamento do mês",
        icon: "🎯",
        restrictedForDependent: true,
      },
      {
        href: "/app/reservas",
        label: "Reservas e metas",
        icon: "🛟",
        restrictedForDependent: true,
      },
      { href: "/app/comprar", label: "Antes de comprar", icon: "🛒" },
      {
        href: "/app/projecao",
        label: "Projeção & Fluxo",
        icon: "📈",
        restrictedForDependent: true,
      },
      { href: "/app/visao-futuro", label: "Visão de Futuro", icon: "🚀" },
      { href: "/app/diagnostico-ia", label: "Diagnóstico IA", icon: "✨" },
    ],
  },
  {
    title: "Dívidas & Recuperação",
    items: [
      {
        href: "/app/dividas",
        label: "Dívidas & Empréstimos",
        icon: "🏛️",
        restrictedForDependent: true,
      },
      {
        href: "/app/negociar",
        label: "Negociar dívidas",
        icon: "🤝",
        restrictedForDependent: true,
      },
      {
        href: "/app/superendividamento",
        label: "Superendividamento",
        icon: "⚖️",
        restrictedForDependent: true,
      },
    ],
  },
  {
    title: "Registro & Relatórios",
    items: [
      { href: "/app/decisoes", label: "Decisões da família", icon: "🗒️" },
      { href: "/app/relatorios", label: "Relatórios", icon: "📊", restrictedForDependent: true },
    ],
  },
  {
    title: "Minha Conta",
    items: [
      { href: "/app/meus-dados", label: "Meus Dados & Família", icon: "👤" },
      { href: "/app/membros", label: "Membros e permissões", icon: "👥" },
      { href: "/app/assinatura", label: "Assinatura", icon: "💳" },
      { href: "/app/configuracoes", label: "Configurações", icon: "⚙️" },
    ],
  },
  {
    title: "Ajuda & Sobre",
    items: [
      { href: "/contato", label: "Fale Conosco / Suporte", icon: "💬" },
      { href: "/educacao-financeira", label: "Educação financeira", icon: "📚" },
      { href: "/privacidade", label: "Política de privacidade", icon: "🔒" },
      { href: "/termos", label: "Termos de uso", icon: "📄" },
    ],
  },
];

// A barra inferior guarda o que alguém abre em pé, numa fila. Lançar um gasto
// é o mais frequente disso. "Mais" fica porque no celular ele é o único acesso
// ao resto do produto — no desktop, o menu lateral já leva tudo.
const MOBILE_NAV = [
  { href: "/app", label: "Início", icon: "🏠" },
  { href: "/app/avisos", label: "Avisos", icon: "🔔" },
  { href: "/app/dia-a-dia", label: "Dia a dia", icon: "🧾" },
  { href: "/app/emergencia", label: "Pagar 1º", icon: "🚨" },
  { href: "/app/plano", label: "Plano", icon: "🧭" },
  { href: "/app/mais", label: "Mais", icon: "⋯" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const {
    status,
    role,
    household,
    households,
    selectHousehold,
    logout,
    profile,
    user,
    isEmailVerified,
    sendVerificationEmail,
  } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      window.location.href = "/";
    }
  }

  async function handleResendEmail() {
    setSendingEmail(true);
    try {
      await sendVerificationEmail();
      setEmailSent(true);
    } finally {
      setSendingEmail(false);
    }
  }

  const isDependent = role === "DEPENDENT";

  useEffect(() => {
    if (
      isDependent &&
      [
        "/app/dividas",
        "/app/superendividamento",
        "/app/projecao",
        "/app/cartoes",
        "/app/importar",
      ].some((p) => pathname.startsWith(p))
    ) {
      router.replace("/app/dia-a-dia");
    }
  }, [isDependent, pathname, router]);

  const desktopSections = DESKTOP_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (isDependent && item.restrictedForDependent) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  useEffect(() => {
    if (status === "unauthenticated" && !loggingOut) {
      router.replace("/entrar");
    }
  }, [status, router, loggingOut]);

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
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href="/app" className="group shrink-0" title="Ir para o início">
              <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-2xs transition-transform group-hover:scale-105">
                <Image
                  src="/logo.png"
                  alt="Conta comigo"
                  width={32}
                  height={32}
                  className="size-full object-cover"
                />
              </div>
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{household.name}</p>
              <p className="truncate text-xs" style={{ color: "var(--muted-fg)" }}>
                {profile?.displayName ?? "Você"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AlertBell />
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
            <Button variant="ghost" onClick={() => void handleLogout()} disabled={loggingOut}>
              {loggingOut ? "Saindo…" : "Sair"}
            </Button>
          </div>
        </div>
      </header>

      {!isEmailVerified && user?.email ? (
        <aside
          aria-label="Confirmação de e-mail"
          className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-950 dark:text-amber-200"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-base">
                📧
              </span>
              <span>
                <strong>Confirme seu e-mail ({user.email})</strong> para validar sua conta e ativar
                seus 30 dias de teste grátis do Premium.
              </span>
            </div>
            <div>
              <button
                type="button"
                disabled={sendingEmail || emailSent}
                onClick={handleResendEmail}
                className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1 font-semibold text-white shadow-2xs transition hover:bg-amber-700 disabled:opacity-60"
              >
                {emailSent
                  ? "E-mail enviado! Verifique sua caixa"
                  : sendingEmail
                    ? "Enviando…"
                    : "Reenviar confirmação"}
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-4 md:py-6">
        <nav aria-label="Navegação principal" className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto pr-1">
            {desktopSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="text-2xs px-3 font-bold tracking-wider text-[color:var(--muted-fg)] uppercase">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive(pathname, item.href) ? "page" : undefined}
                        className={navLinkClass(isActive(pathname, item.href))}
                      >
                        <span aria-hidden="true" className="text-base">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
