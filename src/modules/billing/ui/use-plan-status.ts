"use client";

import { useMemo } from "react";
import { formatCalendarDate, instantToCalendarDate, type Instant } from "@/core/date/calendar-date";
import { describePlanStatus, type PlanStatus } from "@/modules/billing/domain/plan-status";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * O estado do plano, pronto para a tela.
 *
 * Existe para que cabeçalho, tela de assinatura e "Mais" leiam o mesmo número.
 * Antes disso, cada uma juntava `planSource`, `daysUntilExpiry` e
 * `trialDaysLeft` do seu jeito, e discordar era questão de tempo.
 */
export function usePlanStatus(): PlanStatus {
  const { subscription, profile, user } = useSession();

  const accountCreatedAt = profile?.createdAt;
  const emailVerified = user?.emailVerified ?? false;

  return useMemo(
    () =>
      describePlanStatus({
        subscription,
        accountCreatedAt,
        emailVerified,
      }),
    [subscription, accountCreatedAt, emailVerified],
  );
}

/**
 * A data do fim, no fuso da casa.
 *
 * `expiresAt` é um instante UTC. Formatá-lo sem fuso faz um plano que vence à
 * meia-noite de Brasília aparecer com a data do dia seguinte — e a pessoa
 * conta um dia a mais do que tem.
 */
export function usePlanEndDate(endsAt: Instant | null): string | null {
  const { household } = useSession();
  const timezone = household?.settings.timezone ?? "America/Sao_Paulo";

  return useMemo(() => {
    if (!endsAt) return null;
    try {
      return formatCalendarDate(instantToCalendarDate(endsAt, timezone), { style: "long" });
    } catch {
      // Um instante malformado não pode derrubar a tela de assinatura.
      return null;
    }
  }, [endsAt, timezone]);
}

// `formatDays` mora no domínio, junto do texto dos avisos: uma concordância
// só, para as três telas.
export { formatDays } from "@/modules/billing/domain/plan-notice";
