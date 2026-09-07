import type { CalendarDate } from "@/core/date/calendar-date";
import { sum, type Money } from "@/core/money/money";
import type {
  AuditFields,
  HouseholdId,
  MemberId,
  Visibility,
} from "@/modules/shared/domain/common";

/**
 * O que a família decidiu, e quando.
 *
 * O aplicativo já sabia dizer o que está vencido, o que vai apertar e o que
 * dá para negociar. O que faltava era o outro lado: **o que foi feito a
 * respeito**. Sem isso, quem liga para o banco em março e ouve "ligue de novo
 * em abril" não tem onde registrar isso, e em maio ninguém na casa lembra se
 * a ligação aconteceu.
 *
 * O registro é deliberadamente pobre em campos. Não é um sistema de tarefas:
 * é uma linha do tempo do que a casa combinou, para que a conversa da próxima
 * vez comece de onde parou — inclusive numa audiência, num atendimento do
 * Procon ou num mutirão de renegociação, onde "eu já tinha proposto isso em
 * março" vale mais dito com data.
 *
 * ## O que este módulo não faz
 *
 * Não altera saldo, projeção nem dívida. Registrar "renegociei o carnê" não
 * muda um número em lugar nenhum — o número muda quando a dívida for editada
 * ou o pagamento lançado. Misturar as duas coisas faria a projeção depender
 * de uma anotação, e uma anotação otimista viraria um saldo que não existe.
 */

export type DecisionId = string;

export type DecisionKind =
  /** Procurar o credor e propor prazo, desconto ou parcela menor. */
  | "RENEGOTIATE_DEBT"
  /** Deixar uma compra para depois. */
  | "POSTPONE_PURCHASE"
  /** Priorizar e quitar uma conta. */
  | "PAY_BILL"
  /** Começar ou reforçar a reserva. */
  | "BUILD_RESERVE"
  /** Mexer no teto de uma categoria do mês. */
  | "ADJUST_BUDGET"
  /** Qualquer outro próximo passo combinado. */
  | "OTHER_STEP";

/**
 * Só dois estados, de propósito.
 *
 * "Combinado" e "feito" é o que uma casa consegue manter atualizado. Um
 * terceiro estado — em andamento, adiado, cancelado — pede manutenção que
 * ninguém faz, e uma lista desatualizada é pior que uma lista curta.
 */
export type DecisionStatus = "PLANNED" | "DONE";

export interface Decision extends AuditFields {
  readonly id: DecisionId;
  readonly householdId: HouseholdId;
  readonly kind: DecisionKind;
  readonly description: string;
  /** Quanto está em jogo, quando a decisão tem valor. */
  readonly amount?: Money;
  /**
   * O dia da decisão.
   *
   * O formulário já chega preenchido com hoje, então ninguém precisa digitar
   * data para registrar. Continua editável porque muita decisão é anotada
   * dias depois de tomada, e a data errada torna a linha do tempo inútil
   * justamente para o que ela serve: provar quando algo foi combinado.
   */
  readonly decidedOn: CalendarDate;
  readonly status: DecisionStatus;
  /** Quem na casa ficou responsável, quando alguém ficou. */
  readonly responsibleMemberId?: MemberId;
  readonly visibility: Visibility;
  readonly notes?: string;
}

export const DECISION_KINDS: readonly DecisionKind[] = [
  "RENEGOTIATE_DEBT",
  "PAY_BILL",
  "POSTPONE_PURCHASE",
  "BUILD_RESERVE",
  "ADJUST_BUDGET",
  "OTHER_STEP",
];

export const DECISION_KIND_LABELS: Record<DecisionKind, string> = {
  RENEGOTIATE_DEBT: "Renegociar uma dívida",
  PAY_BILL: "Pagar uma conta",
  POSTPONE_PURCHASE: "Adiar uma compra",
  BUILD_RESERVE: "Montar ou reforçar a reserva",
  ADJUST_BUDGET: "Ajustar o orçamento",
  OTHER_STEP: "Outro próximo passo",
};

/** Um exemplo curto do que escrever, para a descrição não ficar vazia. */
export const DECISION_KIND_EXAMPLES: Record<DecisionKind, string> = {
  RENEGOTIATE_DEBT: "Ligar para a financeira e propor parcela de R$ 180 em 12 vezes",
  PAY_BILL: "Pagar a conta de luz atrasada antes da religação",
  POSTPONE_PURCHASE: "Deixar a troca da geladeira para depois do 13º",
  BUILD_RESERVE: "Guardar R$ 50 por semana até chegar a R$ 500",
  ADJUST_BUDGET: "Baixar o teto de mercado para R$ 900 neste mês",
  OTHER_STEP: "Levar os comprovantes ao mutirão de renegociação",
};

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  PLANNED: "Combinado",
  DONE: "Feito",
};

/**
 * A linha do tempo: o mais recente primeiro.
 *
 * O desempate por `createdAt` importa porque várias decisões costumam ser
 * anotadas na mesma data — numa conversa de domingo à noite, por exemplo — e
 * sem ele a ordem entre elas mudaria a cada leitura do Firestore.
 */
export function sortDecisions(decisions: readonly Decision[]): Decision[] {
  return decisions.slice().sort((a, b) => {
    if (a.decidedOn !== b.decidedOn) return a.decidedOn < b.decidedOn ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/** O que ainda está combinado e não foi feito, do mais antigo para o mais novo. */
export function pendingDecisions(decisions: readonly Decision[]): Decision[] {
  return decisions
    .filter((decision) => decision.status === "PLANNED")
    .sort((a, b) => (a.decidedOn === b.decidedOn ? 0 : a.decidedOn < b.decidedOn ? -1 : 1));
}

export interface DecisionSummary {
  readonly total: number;
  readonly planned: number;
  readonly done: number;
  /** Soma dos valores das decisões já cumpridas. Zero quando nenhuma tem valor. */
  readonly amountDone: Money;
  /** Soma dos valores do que ainda está combinado. */
  readonly amountPlanned: Money;
}

/**
 * O resumo da linha do tempo.
 *
 * Conta o que foi feito, e não o que falta fazer. Uma casa endividada já sabe
 * o tamanho do que falta; o que ela raramente tem é o registro de que alguma
 * coisa andou.
 */
export function summariseDecisions(decisions: readonly Decision[]): DecisionSummary {
  const done = decisions.filter((decision) => decision.status === "DONE");
  const planned = decisions.filter((decision) => decision.status === "PLANNED");

  return {
    total: decisions.length,
    planned: planned.length,
    done: done.length,
    amountDone: sum(done.flatMap((decision) => (decision.amount ? [decision.amount] : []))),
    amountPlanned: sum(planned.flatMap((decision) => (decision.amount ? [decision.amount] : []))),
  };
}

/** Filtra por tipo. `null` significa "todos". */
export function filterByKind(
  decisions: readonly Decision[],
  kind: DecisionKind | null,
): readonly Decision[] {
  return kind === null ? decisions : decisions.filter((decision) => decision.kind === kind);
}
