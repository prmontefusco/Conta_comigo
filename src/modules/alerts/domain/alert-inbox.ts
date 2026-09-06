import type { Alert, AlertSeverity } from "./alerts";

/**
 * O que ainda não foi visto.
 *
 * O aplicativo já sabia calcular treze tipos de aviso e mostrava todos na
 * mesma lista, toda vez, para sempre. Uma lista que não muda deixa de ser
 * lida — e a conta de luz que venceu ontem some no meio de "sua reserva está
 * abaixo da meta", que é verdade há seis meses.
 *
 * O sininho precisa de uma distinção que os alertas não tinham: **o que é
 * novo**. Sem ela, o contador mostraria o mesmo número eternamente e viraria
 * decoração.
 *
 * ## Por que a marcação é local ao aparelho
 *
 * "Já vi este aviso" é conveniência de leitura, não dado financeiro. Guardar
 * isso no Firestore custaria uma escrita por aviso lido, um caminho de erro no
 * meio da navegação e uma coleção nova nas Security Rules — tudo para
 * sincronizar entre aparelhos a informação menos importante do produto. O
 * navegador guarda, e quem abrir noutro aparelho vê os avisos como novos: um
 * incômodo pequeno, e o pior caso é mostrar de novo algo verdadeiro.
 */

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  URGENT: 0,
  ATTENTION: 1,
  INFO: 2,
};

export interface AlertInboxItem {
  readonly alert: Alert;
  readonly unseen: boolean;
}

export interface AlertInbox {
  readonly items: readonly AlertInboxItem[];
  /** Quantos avisos ainda não foram vistos. É o número do sininho. */
  readonly unseenCount: number;
  /** Quantos deles são urgentes. Decide a cor do contador. */
  readonly unseenUrgentCount: number;
  readonly hasUrgent: boolean;
}

export interface BuildAlertInboxInput {
  readonly alerts: readonly Alert[];
  /** Ids que este aparelho já mostrou. */
  readonly seenIds: readonly string[];
}

/**
 * Monta a caixa de avisos, mais grave primeiro e não visto antes de visto.
 *
 * A ordem por gravidade vem antes da ordem por novidade de propósito: um corte
 * de energia iminente que a pessoa já viu ontem continua mais importante que
 * um aviso novo de orçamento estourado.
 */
export function buildAlertInbox(input: BuildAlertInboxInput): AlertInbox {
  const seen = new Set(input.seenIds);

  const items = input.alerts
    .map((alert) => ({ alert, unseen: !seen.has(alert.id) }))
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[a.alert.severity] - SEVERITY_RANK[b.alert.severity];
      if (bySeverity !== 0) return bySeverity;
      if (a.unseen !== b.unseen) return a.unseen ? -1 : 1;
      return 0;
    });

  const unseen = items.filter((item) => item.unseen);

  return {
    items,
    unseenCount: unseen.length,
    unseenUrgentCount: unseen.filter((item) => item.alert.severity === "URGENT").length,
    hasUrgent: items.some((item) => item.alert.severity === "URGENT"),
  };
}

/**
 * A lista de vistos depois de abrir a caixa.
 *
 * Descarta ids que não correspondem a nenhum aviso atual. Sem isso a lista
 * cresceria para sempre com avisos que já se resolveram — e, pior, um aviso
 * que volta a acontecer (a mesma conta vencida no mês seguinte, com o mesmo
 * id) chegaria já marcado como visto.
 */
export function markAllSeen(alerts: readonly Alert[]): string[] {
  return alerts.map((alert) => alert.id);
}

/** Chave de armazenamento por household: grupos diferentes, caixas diferentes. */
export function inboxStorageKey(householdId: string): string {
  return `conta-comigo:alerts-seen:${householdId}`;
}
