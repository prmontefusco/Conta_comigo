"use client";

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/primitives";
import { planStatusLabel } from "@/modules/billing/domain/plan-status";
import { formatDays, usePlanEndDate, usePlanStatus } from "@/modules/billing/ui/use-plan-status";
import { useSession } from "@/modules/household/ui/session-provider";
import { ROLE_LABELS } from "@/modules/household/domain/household";
import { navSectionsFor } from "@/modules/shared/ui/app-nav";
import { PWAInstallCard } from "@/components/pwa-install-prompt";

/**
 * O menu do celular.
 *
 * No desktop a coluna lateral leva a tudo. No celular ela não existe: a barra
 * de baixo comporta cinco ou seis alvos do tamanho de um polegar, e esta
 * página é o único caminho para o resto do produto.
 *
 * Por isso ela não tem lista própria. Tinha, escrita à mão, e a lista
 * divergiu da coluna do desktop — Contas a pagar, Cartões, Importar extrato,
 * Antes de comprar e Projeção deixaram de ter qualquer caminho no telefone,
 * sem que nada quebrasse ou aparecesse como erro. Agora as duas leem
 * `modules/shared/ui/app-nav`, e um teste confere que toda rota do aplicativo
 * está lá.
 *
 * As seções vêm filtradas pelo papel de quem está olhando: um dependente não
 * vê aqui um atalho para uma tela que a coluna do desktop esconde dele.
 */
export default function MorePage() {
  const { household, role } = useSession();
  const plan = usePlanStatus();
  const planEndDate = usePlanEndDate(plan.endsAt);

  const sections = navSectionsFor(role);

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
            <dd className="text-right font-medium">
              <Link href="/app/assinatura" className="underline underline-offset-2">
                {planStatusLabel(plan)}
              </Link>
              {plan.daysRemaining !== null ? (
                <span className="block text-xs font-normal" style={{ color: "var(--muted-fg)" }}>
                  {plan.daysRemaining > 0
                    ? `Restam ${formatDays(plan.daysRemaining)}`
                    : "Termina hoje"}
                  {planEndDate ? ` · até ${planEndDate}` : ""}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: "var(--muted-fg)" }}>Fuso horário</dt>
            <dd className="font-medium">{household?.settings.timezone}</dd>
          </div>
        </dl>
      </Card>

      <PWAInstallCard />

      {sections.map((section) => (
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
