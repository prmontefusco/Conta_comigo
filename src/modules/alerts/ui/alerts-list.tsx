"use client";

import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/primitives";
import type { Alert, AlertSeverity } from "@/modules/alerts/domain/alerts";

const SEVERITY_STYLE: Record<AlertSeverity, { border: string; bg: string; label: string }> = {
  URGENT: {
    border: "border-[color:var(--color-critical-600)]",
    bg: "bg-[color:var(--color-critical-100)]",
    label: "Precisa de atenção agora",
  },
  ATTENTION: {
    border: "border-[color:var(--color-attention-600)]",
    bg: "bg-[color:var(--color-attention-100)]",
    label: "Vale olhar",
  },
  INFO: {
    border: "border-[color:var(--color-brand-500)]",
    bg: "bg-[color:var(--color-brand-50)]",
    label: "Informação",
  },
};

/**
 * Alerts, phrased as facts.
 *
 * Each entry says what is true and what follows from it. None of them
 * evaluates the person.
 */
export function AlertsList({ alerts, limit = 6 }: { alerts: readonly Alert[]; limit?: number }) {
  if (alerts.length === 0) {
    return (
      <Card aria-labelledby="alertas-title">
        <CardTitle id="alertas-title">Pontos de atenção</CardTitle>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Nada exigindo atenção imediata pelos dados registrados até agora.
        </p>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="alertas-title">
      <CardTitle id="alertas-title">Pontos de atenção</CardTitle>
      <ul className="space-y-2">
        {alerts.slice(0, limit).map((alert) => {
          const style = SEVERITY_STYLE[alert.severity];
          const content = (
            <>
              <span className="sr-only">{style.label}: </span>
              {alert.message}
            </>
          );

          return (
            <li
              key={alert.id}
              className={`rounded-lg border-l-4 p-3 text-sm text-[color:var(--color-ink-900)] ${style.border} ${style.bg}`}
            >
              {alert.href ? (
                <Link href={alert.href} className="underline-offset-2 hover:underline">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
