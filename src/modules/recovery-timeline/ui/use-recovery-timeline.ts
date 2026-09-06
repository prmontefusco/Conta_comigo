"use client";

import { useMemo } from "react";
import {
  calculateRecoveryTimeline,
  type CalculateRecoveryTimelineInput,
  type RecoveryTimelineResult,
} from "@/modules/recovery-timeline/domain/recovery-calculator";
import { useFinance } from "@/modules/household/ui/finance-provider";
import type { Money } from "@/core/money/money";

/**
 * A linha do tempo, calculada uma vez por tela.
 *
 * Antes, cada componente chamava `calculateRecoveryTimeline` por conta
 * própria — o cartão de destaque, o herói da meta atual, o comparador de
 * estratégias (duas vezes) e o painel de IA. Com argumentos idênticos, em
 * tese; na prática a mesma tela chegou a mostrar "45 meses · 05/06/2030" no
 * topo e "43 meses · 05/04/2030" alguns blocos abaixo, e não havia como o
 * leitor saber qual valia.
 *
 * A causa exata pouco importa diante do consertoccerto: se o número precisa
 * ser o mesmo em todo lugar, ele tem que ser calculado num lugar só. De
 * quebra, a tela de Visão de Futuro deixa de rodar seis simulações completas
 * de até 360 meses a cada render.
 */
export function useRecoveryTimeline(extraMonthlyContribution?: Money): RecoveryTimelineResult {
  const finance = useFinance();

  const cardNames = useMemo(
    () => new Map(finance.cards.map((card) => [card.id, card.name])),
    [finance.cards],
  );

  return useMemo(() => {
    const input: CalculateRecoveryTimelineInput = {
      asOf: finance.asOf,
      openingBalance: finance.totalCash,
      totalCash: finance.totalCash,
      protectedReserve: finance.protectedReserve,
      forecast: finance.forecast,
      debts: finance.debts,
      cardStatements: finance.cardStatements,
      cardNames,
      reserves: finance.reserves,
      paidDebtInstallments: finance.paidDebtInstallments,
      ...(extraMonthlyContribution ? { extraMonthlyContribution } : {}),
    };
    return calculateRecoveryTimeline(input);
  }, [
    finance.asOf,
    finance.totalCash,
    finance.protectedReserve,
    finance.forecast,
    finance.debts,
    finance.cardStatements,
    finance.reserves,
    finance.paidDebtInstallments,
    cardNames,
    extraMonthlyContribution,
  ]);
}
