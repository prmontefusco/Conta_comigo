"use client";

import { Badge, Callout, Card, CardTitle, ProgressBar } from "@/components/ui/primitives";
import { planStatusLabel, type PlanStatus } from "@/modules/billing/domain/plan-status";
import { FREE_LIMITS, PREMIUM_LIMITS } from "@/modules/billing/domain/plan-limits";
import { formatDays, usePlanEndDate } from "./use-plan-status";

/**
 * "Plano atual": o que foi contratado, até quando, e quanto falta.
 *
 * A tela de assinatura já dizia "Premium" e os dias restantes, mas nunca o
 * **ciclo** — a pessoa que pagou o anual via exatamente o que a que pagou o
 * mensal veria. O ciclo estava gravado na assinatura e não chegava à
 * interface.
 *
 * Também faltava a **data**. "23 dias restantes" obriga a fazer conta; "vale
 * até 1º de outubro de 2026" é o que se anota na geladeira.
 */
export function PlanStatusCard({ status }: { status: PlanStatus }) {
  const endDate = usePlanEndDate(status.endsAt);

  return (
    <Card aria-labelledby="plano-atual-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitle id="plano-atual-title">Plano atual</CardTitle>
        <Badge tone={status.plan === "PREMIUM" ? "positive" : "neutral"}>
          {status.plan === "PREMIUM" ? "Premium ativo" : "Gratuito"}
        </Badge>
      </div>

      <p className="text-lg font-semibold">{planStatusLabel(status)}</p>

      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Row label="Como você tem acesso" value={accessLabel(status)} />
        <Row label="Período contratado" value={status.cycleLabel ?? "—"} />
        <Row
          label={status.kind === "PAID" ? "Vale até" : "Termina em"}
          value={endDate ?? "Sem prazo"}
        />
      </dl>

      {status.daysRemaining !== null ? (
        <div className="mt-4">
          <p className="text-sm font-medium">
            {status.daysRemaining > 0
              ? `Restam ${formatDays(status.daysRemaining)}`
              : "Termina hoje"}
            {status.kind === "TRIAL" ? ` dos ${status.trialTotalDays} de teste` : null}
          </p>
          {status.kind === "TRIAL" ? (
            <div className="mt-1.5">
              <ProgressBar
                ratio={Math.max(0, Math.min(status.daysRemaining / status.trialTotalDays, 1))}
                label="Quanto resta do período de teste"
                tone={status.endingSoon ? "brand" : "positive"}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-t border-[color:var(--card-border)] pt-4">
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          {status.plan === "PREMIUM"
            ? `Liberados: projeção de ${PREMIUM_LIMITS.forecastMonths} meses, leitura de faturas e boletos por foto, diagnóstico redigido por IA, até ${PREMIUM_LIMITS.members} pessoas no grupo e ${PREMIUM_LIMITS.creditCards} cartões.`
            : `No gratuito continuam liberados: contas e dívidas sem limite, modo emergência, cálculo de multa e juros, calculadora de acordo e roteiros de negociação. O Premium estende a projeção de ${FREE_LIMITS.forecastMonths} para ${PREMIUM_LIMITS.forecastMonths} meses, lê documentos por foto e abre espaço para ${PREMIUM_LIMITS.members} pessoas no grupo.`}
        </p>
      </div>

      {/*
        Não há botão de cancelar, e a ausência é deliberada. O pagamento é
        avulso: sem cartão guardado e sem cobrança recorrente, cancelar só
        poderia encurtar o que já foi pago — sugerindo que a pessoa evita uma
        cobrança que nunca aconteceria.
      */}
      {status.kind === "PAID" ? (
        <Callout tone="positive" title="Nada será cobrado de novo">
          Este pagamento vale até a data acima e termina nela. Não guardamos seu cartão, não existe
          renovação automática e por isso não há nada para cancelar. Quando o prazo acabar, a conta
          volta ao plano gratuito com todos os dados no lugar.
        </Callout>
      ) : null}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--muted-fg)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

function accessLabel(status: PlanStatus): string {
  switch (status.kind) {
    case "PAID":
      return "Assinatura paga";
    case "TRIAL":
      return "Período de teste";
    case "TRIAL_PENDING_EMAIL":
      return "Aguardando confirmação de e-mail";
    case "FREE":
      return status.hadPaidPlan ? "Assinatura encerrada" : "Plano gratuito";
  }
}
