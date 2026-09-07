import type { Alert, AlertKind, AlertSeverity } from "@/modules/alerts/domain/alerts";

/**
 * O que precisa de atenção hoje, no topo da tela inicial.
 *
 * A tela inicial já mostrava tudo — saúde financeira, saldo do dia, projeção,
 * tabela de meses — e os avisos apareciam no meio dessa pilha. Quem abre o
 * aplicativo com uma conta de luz vencida não deveria precisar rolar uma tela
 * analítica para descobrir isso.
 *
 * Aqui não se calcula nada de novo: os avisos são os mesmos de
 * `buildAlerts`, com as mesmas ações de `alert-actions`. O que este módulo
 * acrescenta é **ordem** e **corte** — quais três ou quatro coisas merecem o
 * primeiro olhar, e qual delas vem antes.
 *
 * ## Por que a ordem é gravidade primeiro, assunto depois
 *
 * O produto já decidiu que consequência vale mais que valor: perder a energia
 * elétrica supera uma fatura maior sem consequência imediata
 * (docs/PRODUCT.md, seção 12). Inverter isso aqui faria a tela inicial
 * discordar do modo emergência e da caixa de avisos sobre o que é mais grave.
 *
 * Dentro da mesma gravidade, `SUBJECT_ORDER` decide: conta vencida, risco de
 * saldo negativo, fatura próxima, dívida com consequência, e por fim teto de
 * orçamento e reserva.
 */

const SEVERITY_RANK: Record<AlertSeverity, number> = { URGENT: 0, ATTENTION: 1, INFO: 2 };

const SUBJECT_ORDER: Record<AlertKind, number> = {
  /* 1. o que já venceu */
  OVERDUE_BILLS: 1,
  /* 2. o mês que não fecha e o dia em que o dinheiro acaba */
  NEGATIVE_BALANCE_AHEAD: 2,
  PROJECTED_DEFICIT: 3,
  LOW_UNCOMMITTED_CASH: 4,
  /* 3. o que vence a seguir */
  STATEMENT_DUE: 5,
  DUE_SOON: 6,
  /* 4. dívidas cuja consequência é perder alguma coisa */
  ESSENTIAL_SERVICE_AT_RISK: 7,
  COLLATERAL_AT_RISK: 8,
  /* 5. tetos que a própria casa definiu */
  BUDGET_OVERSPENT: 9,
  CARD_LIMIT_HIGH: 10,
  RESERVE_BELOW_TARGET: 11,
  /* informação boa, mas que não muda o dia de hoje */
  INSTALLMENTS_ENDING: 12,
};

/** Um rótulo curto que nomeia o assunto, para quem lê antes da frase inteira. */
const SUBJECT_LABELS: Record<AlertKind, string> = {
  OVERDUE_BILLS: "Conta vencida",
  ESSENTIAL_SERVICE_AT_RISK: "Serviço essencial em risco",
  COLLATERAL_AT_RISK: "Bem dado em garantia",
  NEGATIVE_BALANCE_AHEAD: "O saldo fica negativo",
  PROJECTED_DEFICIT: "Mês que não fecha",
  LOW_UNCOMMITTED_CASH: "Saldo já comprometido",
  STATEMENT_DUE: "Fatura próxima",
  DUE_SOON: "Vence nos próximos dias",
  BUDGET_OVERSPENT: "Teto do mês ultrapassado",
  CARD_LIMIT_HIGH: "Limite do cartão",
  RESERVE_BELOW_TARGET: "Reserva abaixo da meta",
  INSTALLMENTS_ENDING: "Parcela terminando",
};

export interface TodayPriority {
  readonly alert: Alert;
  /** Nomeia o assunto em duas ou três palavras. */
  readonly label: string;
}

export interface TodayPriorities {
  /** No máximo `limit` itens, do mais grave para o menos. */
  readonly items: readonly TodayPriority[];
  /** Quantos ficaram de fora do corte. Vira "e mais N na caixa de avisos". */
  readonly hidden: number;
  readonly urgentCount: number;
  /** Total de itens que pediriam atenção, antes do corte. */
  readonly total: number;
}

export interface BuildTodayPrioritiesInput {
  readonly alerts: readonly Alert[];
  /** Quantos cabem no topo da tela sem virar outra lista longa. */
  readonly limit?: number;
}

/**
 * Escolhe o que aparece no topo da tela inicial.
 *
 * Avisos `INFO` ficam de fora: "faltam R$ 300 para a reserva" é verdade há
 * meses e não é o que alguém precisa ler antes de tudo. Eles continuam
 * inteiros na caixa de avisos.
 */
export function buildTodayPriorities(input: BuildTodayPrioritiesInput): TodayPriorities {
  const limit = input.limit ?? 4;

  const relevant = input.alerts
    .filter((alert) => alert.severity !== "INFO")
    .slice()
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return SUBJECT_ORDER[a.kind] - SUBJECT_ORDER[b.kind];
    });

  return {
    items: relevant.slice(0, limit).map((alert) => ({ alert, label: SUBJECT_LABELS[alert.kind] })),
    hidden: Math.max(relevant.length - limit, 0),
    urgentCount: relevant.filter((alert) => alert.severity === "URGENT").length,
    total: relevant.length,
  };
}

export function prioritySubjectLabel(kind: AlertKind): string {
  return SUBJECT_LABELS[kind];
}
