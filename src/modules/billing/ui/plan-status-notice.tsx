"use client";

import Link from "next/link";
import { Callout } from "@/components/ui/primitives";
import { buildPlanNotice } from "@/modules/billing/domain/plan-notice";
import { usePlanEndDate, usePlanStatus } from "./use-plan-status";

/**
 * Renderiza o aviso do plano, quando existe algum.
 *
 * A decisão de mostrar ou calar mora em `buildPlanNotice`, no domínio, porque
 * ela é a parte que precisa de teste: o silêncio por padrão é uma escolha de
 * produto, não um detalhe de layout.
 */
export function PlanStatusNotice() {
  const status = usePlanStatus();
  const endDate = usePlanEndDate(status.endsAt);

  const notice = buildPlanNotice(status, endDate);
  if (!notice) return null;

  return (
    <Callout tone={notice.tone} title={notice.title}>
      {notice.body}{" "}
      <Link href="/app/assinatura" className="font-semibold underline underline-offset-2">
        {notice.action}
      </Link>
    </Callout>
  );
}
