import type { Alert, AlertKind } from "@/modules/alerts/domain/alerts";

const ACTION_LABELS: Record<AlertKind, string> = {
  OVERDUE_BILLS: "Ver contas vencidas",
  DUE_SOON: "Ver contas a pagar",
  STATEMENT_DUE: "Ver fatura",
  PROJECTED_DEFICIT: "Abrir projeção",
  NEGATIVE_BALANCE_AHEAD: "Abrir projeção",
  CARD_LIMIT_HIGH: "Ver cartão",
  RESERVE_BELOW_TARGET: "Ver reserva",
  INSTALLMENTS_ENDING: "Ver dívidas",
  LOW_UNCOMMITTED_CASH: "Ver compromissos",
  COLLATERAL_AT_RISK: "Ver dívida",
  ESSENTIAL_SERVICE_AT_RISK: "Abrir modo emergência",
  BUDGET_OVERSPENT: "Ajustar orçamento",
};

export function alertActionLabel(alert: Alert): string {
  return ACTION_LABELS[alert.kind];
}

export function alertAppHref(alert: Alert): string {
  if (!alert.href) return "/app/avisos";
  if (alert.kind === "ESSENTIAL_SERVICE_AT_RISK") return "/app/emergencia";
  if (alert.href.startsWith("/app")) return alert.href;
  return `/app${alert.href}`;
}
