"use client";

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/primitives";
import { useSession } from "@/modules/household/ui/session-provider";
import { ROLE_LABELS } from "@/modules/household/domain/household";

const SECTIONS = [
  {
    title: "Inteligência & Futuro",
    items: [
      { href: "/app/diagnostico-ia", label: "Diagnóstico & Consultor IA", icon: "✨" },
      { href: "/app/visao-futuro", label: "Visão de Futuro e Quitação", icon: "🚀" },
    ],
  },
  {
    title: "Entender",
    items: [
      { href: "/app/relatorios", label: "Relatórios", icon: "📊" },
      { href: "/app/orcamento", label: "Orçamento do mês", icon: "🎯" },
    ],
  },
  {
    title: "Dinheiro",
    items: [
      { href: "/app/dia-a-dia", label: "Gastos e recebimentos do dia a dia", icon: "🧾" },
      { href: "/app/contas-bancarias", label: "Contas e saldos", icon: "🏦" },
      { href: "/app/reservas", label: "Reservas e metas", icon: "🛟" },
    ],
  },
  {
    title: "Compromissos",
    items: [
      { href: "/app/dividas", label: "Empréstimos e financiamentos", icon: "🏛️" },
      { href: "/app/negociar", label: "Negociar e renegociar dívidas", icon: "🤝" },
      { href: "/app/recorrentes", label: "Contas que se repetem", icon: "🔁" },
    ],
  },
  {
    title: "Grupo",
    items: [
      { href: "/app/membros", label: "Membros e permissões", icon: "👥" },
      { href: "/app/configuracoes", label: "Configurações", icon: "⚙️" },
      { href: "/app/meus-dados", label: "Meus dados", icon: "🗂️" },
      { href: "/app/assinatura", label: "Assinatura", icon: "💳" },
    ],
  },
  {
    title: "Sobre",
    items: [
      { href: "/privacidade", label: "Política de privacidade", icon: "🔒" },
      { href: "/termos", label: "Termos de uso", icon: "📄" },
      { href: "/educacao-financeira", label: "Educação financeira", icon: "📚" },
    ],
  },
] as const;

export default function MorePage() {
  const { household, role, isPremium } = useSession();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mais</h1>

      <Card>
        <CardTitle>Você neste grupo</CardTitle>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt style={{ color: "var(--muted-fg)" }}>Grupo</dt>
            <dd className="font-medium">{household?.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: "var(--muted-fg)" }}>Seu papel</dt>
            <dd className="font-medium">{role ? ROLE_LABELS[role] : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: "var(--muted-fg)" }}>Plano</dt>
            <dd className="font-medium">{isPremium ? "Premium" : "Gratuito"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: "var(--muted-fg)" }}>Fuso horário</dt>
            <dd className="font-medium">{household?.settings.timezone}</dd>
          </div>
        </dl>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardTitle>{section.title}</CardTitle>
          <ul className="divide-y divide-[color:var(--card-border)]">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-12 items-center gap-3 py-2 text-sm hover:underline"
                >
                  <span aria-hidden="true" className="text-lg">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
