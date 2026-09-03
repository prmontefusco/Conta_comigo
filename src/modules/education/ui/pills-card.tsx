"use client";

import Link from "next/link";
import { useMemo } from "react";
import { monthKeyOf } from "@/core/date/calendar-date";
import { money, subtract } from "@/core/money/money";
import { Card, CardTitle } from "@/components/ui/primitives";
import { computeLimitStatus } from "@/modules/cards/domain/credit-card";
import { effectiveMonthlyRate } from "@/modules/debts/domain/debt";
import { essentialServiceConsequence, putsAssetAtRisk } from "@/modules/debts/domain/debt-risk";
import { pickPills, type PillContext } from "@/modules/education/domain/pills";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { starterReserveStatus } from "@/modules/reserves/domain/starter-reserve";

/**
 * Guidance where the situation is, not in a separate library.
 *
 * The pills are chosen from the household's own state, so someone with an
 * overdue fatura reads about rotativo and someone with a financed car reads
 * why that one gets paid first. When nothing is pressing, the general ones
 * appear - never an empty card, never a wall of advice.
 */
export function EducationPillsCard({ limit = 3 }: { limit?: number }) {
  const finance = useFinance();

  const context = useMemo<PillContext>(() => {
    const activeDebts = finance.debts.filter((debt) => debt.status !== "SETTLED");
    const wholeMonths = finance.forecast.months.filter((month) => !month.isPartial);

    const utilisations = finance.cards
      .filter((card) => !card.archived && card.creditLimit.amount > 0)
      .map(
        (card) =>
          computeLimitStatus(
            card,
            finance.cardStatements.filter((statement) => statement.creditCardId === card.id),
          ).utilisation,
      );

    const month = monthKeyOf(finance.asOf);
    const budget = finance.budgets.find((item) => item.month === month);

    const monthlyOutflows = averageOf(wholeMonths.map((item) => item.committedOutflows.amount));
    const monthlyDebt = averageOf(wholeMonths.map((item) => item.debtCommitment.amount));
    const monthlyNet = averageOf(wholeMonths.map((item) => item.net.amount));

    const starter = starterReserveStatus(
      finance.reserves,
      subtract(money(monthlyOutflows), money(monthlyDebt)),
    );

    return {
      hasOverdueStatement: finance.cardStatements.some(
        (statement) => statement.remainingAmount.amount > 0 && statement.dueDate < finance.asOf,
      ),
      highestCardUtilisation: utilisations.length === 0 ? 0 : Math.max(...utilisations),
      hasOverdraftDebt: activeDebts.some((debt) => debt.kind === "OVERDRAFT"),
      debtsWithoutKnownRate: activeDebts.filter(
        (debt) => effectiveMonthlyRate(debt).source === "UNKNOWN",
      ).length,
      hasCollateralDebt: activeDebts.some(putsAssetAtRisk),
      hasEssentialBillOverdue: finance.overview.today.overdue.some((obligation) =>
        Boolean(essentialServiceConsequence(obligation.categoryId)),
      ),
      starterReserveComplete: starter.isComplete,
      hasBudgetForThisMonth: Boolean(budget),
      overspentCategories:
        finance.budgetStatus?.lines.filter((line) => line.overspend.amount > 0).length ?? 0,
      monthlyNetAmount: monthlyNet,
      committedInstallmentsAmount: finance.cardStatements
        .filter((statement) => statement.referenceMonth > month)
        .reduce((total, statement) => total + statement.remainingAmount.amount, 0),
    };
  }, [finance]);

  const pills = pickPills(context, limit);
  if (pills.length === 0) return null;

  return (
    <Card>
      <CardTitle hint="Escolhidas a partir da sua situação de hoje.">Vale saber</CardTitle>

      <ul className="space-y-4">
        {pills.map((pill) => (
          <li key={pill.id}>
            <h3 className="text-sm font-semibold">{pill.title}</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
              {pill.body}
            </p>
            {pill.href ? (
              <Link
                href={pill.href}
                className="mt-1.5 inline-block text-sm font-medium text-[color:var(--color-brand-700)] underline underline-offset-2"
              >
                {pill.hrefLabel ?? "Ver"}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
        Explicações gerais sobre como o dinheiro funciona, não recomendação de produto.{" "}
        <Link href="/educacao-financeira" className="underline underline-offset-2">
          Ver os conceitos completos
        </Link>
        .
      </p>
    </Card>
  );
}

function averageOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}
