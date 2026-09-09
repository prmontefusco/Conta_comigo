import { addDays, addMonths, type CalendarDate } from "@/core/date/calendar-date";
import {
  materialisedOccurrenceKeys,
  type Obligation,
} from "@/modules/obligations/domain/obligation";
import { occurrencesBetween, type RecurringRule, type RuleOccurrence } from "./recurring-rule";

/**
 * As ocorrências de regra que ainda esperam confirmação.
 *
 * Uma regra recorrente — o salário — vive só na projeção: ela é expandida a
 * cada cálculo e nunca vira documento. É barato e correto para projetar, e
 * deixa um buraco na hora de dizer "caiu, e caiu R$ 1.850". Esta função é o
 * que a tela precisa para oferecer essa confirmação.
 *
 * ## A janela é diferente da janela da projeção, de propósito
 *
 * `occurrencesBetween` só emite ocorrências a partir de `from`, e a projeção
 * passa `from = asOf`. Com isso, o salário do dia 5 deixa de existir no dia 6 —
 * e o dia 6 é justamente quando alguém vai confirmá-lo. Ninguém confirma um
 * salário antes de ele cair.
 *
 * Por isso a listagem olha para trás. O que **não** se pode fazer é alargar a
 * janela da projeção: lá, uma ocorrência antiga não confirmada voltaria como
 * receita futura e inflaria o saldo projetado. Duas perguntas diferentes, duas
 * janelas diferentes.
 *
 * ## Confirmada uma vez, some da lista
 *
 * A deduplicação usa `materialisedOccurrenceKeys`, a mesma função que o motor
 * de projeção usa. Sem ela, uma ocorrência já confirmada continuaria listada,
 * a pessoa apertaria "Recebi" de novo e o salário entraria duas vezes no
 * saldo — o pior defeito que este caminho pode ter.
 */

export interface PendingOccurrence {
  readonly rule: RecurringRule;
  /** A ocorrência como o expansor a produziu, nunca remontada. */
  readonly occurrence: RuleOccurrence;
  /** A data esperada já passou e nada foi confirmado. */
  readonly late: boolean;
}

export interface PendingOccurrencesInput {
  readonly rules: readonly RecurringRule[];
  readonly obligations: readonly Obligation[];
  readonly asOf: CalendarDate;
  /** Quantos dias olhar para trás. O suficiente para o mês anterior caber. */
  readonly lookbackDays?: number;
  /** Quantos meses olhar para frente. */
  readonly lookaheadMonths?: number;
  /** `INFLOW`, `OUTFLOW` ou ambos quando ausente. */
  readonly direction?: "INFLOW" | "OUTFLOW";
}

const DEFAULT_LOOKBACK_DAYS = 45;
const DEFAULT_LOOKAHEAD_MONTHS = 2;

export function pendingOccurrences(input: PendingOccurrencesInput): PendingOccurrence[] {
  const from = addDays(input.asOf, -(input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS));
  const to = addMonths(input.asOf, input.lookaheadMonths ?? DEFAULT_LOOKAHEAD_MONTHS);

  const confirmed = materialisedOccurrenceKeys(input.obligations);
  const pending: PendingOccurrence[] = [];

  for (const rule of input.rules) {
    if (!rule.active) continue;
    if (input.direction && rule.direction !== input.direction) continue;

    for (const occurrence of occurrencesBetween(rule, from, to)) {
      if (confirmed.has(occurrence.occurrenceKey)) continue;

      pending.push({ rule, occurrence, late: occurrence.dueDate < input.asOf });
    }
  }

  // O que já venceu primeiro, depois o que está por vir: a ordem da lista é a
  // ordem em que as coisas precisam de resposta.
  return pending.sort((a, b) =>
    a.occurrence.dueDate === b.occurrence.dueDate
      ? 0
      : a.occurrence.dueDate < b.occurrence.dueDate
        ? -1
        : 1,
  );
}
