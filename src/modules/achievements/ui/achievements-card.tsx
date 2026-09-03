"use client";

import { useMemo } from "react";
import { addMonthsToKey, monthKeyOf } from "@/core/date/calendar-date";
import { money, subtract } from "@/core/money/money";
import { Badge, Card, CardTitle, ProgressBar } from "@/components/ui/primitives";
import { computeAchievements } from "@/modules/achievements/domain/achievements";
import {
  buildDailyEntries,
  dailyTotals,
  entriesInMonth,
} from "@/modules/daily/domain/daily-entries";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useMembers } from "@/modules/household/ui/use-members";

/**
 * Milestones the household has passed, and the one it is closest to.
 *
 * Repaying debt is months of nothing visibly happening. This card is where
 * something does - a quarter amortised, a fatura back in the green, the first
 * R$ 500 put aside - and it costs nothing to give.
 *
 * Everything shown is derived from the household's own records. There is no
 * badge to collect, no streak to lose, and a bad month removes nothing that
 * was already achieved.
 */
export function AchievementsCard({ nextLimit = 3 }: { nextLimit?: number }) {
  const finance = useFinance();
  const { active: members, nameOf } = useMembers();

  const result = useMemo(() => {
    const wholeMonths = finance.forecast.months.filter((month) => !month.isPartial);
    const average = (values: readonly number[]) =>
      values.length === 0
        ? 0
        : Math.round(values.reduce((total, value) => total + value, 0) / values.length);

    const outflows = average(wholeMonths.map((month) => month.committedOutflows.amount));
    const debt = average(wholeMonths.map((month) => month.debtCommitment.amount));

    // The month that just closed, from what was actually recorded.
    const previous = addMonthsToKey(monthKeyOf(finance.asOf), -1);
    const entries = entriesInMonth(
      buildDailyEntries({
        transactions: finance.transactions,
        cardPurchases: finance.cardPurchases,
      }),
      previous,
    );
    const totals = dailyTotals(entries);

    return computeAchievements({
      asOf: finance.asOf,
      debts: finance.debts,
      paidDebtInstallments: finance.paidDebtInstallments,
      cardStatements: finance.cardStatements,
      reserves: finance.reserves,
      monthlyEssentials: subtract(money(outflows), money(debt)),
      overdueBillsCount: finance.overview.today.overdue.length,
      ...(entries.length > 0
        ? { lastMonth: { received: totals.received, spent: totals.spent } }
        : {}),
    });
  }, [finance]);

  const next = result.next.slice(0, nextLimit);
  if (result.unlocked.length === 0 && next.length === 0) return null;

  return (
    <Card>
      <CardTitle hint="Marcos calculados a partir dos seus registros, não metas atribuídas.">
        Conquistas do grupo
      </CardTitle>

      {result.unlocked.length > 0 ? (
        <div className="mb-5">
          <h3 className="text-xs font-semibold tracking-wider uppercase">Já conquistado</h3>
          <ul className="mt-2 space-y-2">
            {result.unlocked.map((achievement) => (
              <li key={achievement.id} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-0.5 shrink-0">
                  ✅
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {achievement.title}
                    {achievement.memberId && members.length > 1 ? (
                      <span className="ml-2 align-middle">
                        <Badge>{nameOf(achievement.memberId)}</Badge>
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {achievement.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {next.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold tracking-wider uppercase">O mais perto</h3>
          <ul className="mt-2 space-y-4">
            {next.map((achievement) => (
              <li key={achievement.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {achievement.title}
                    {achievement.memberId && members.length > 1 ? (
                      <span className="ml-2 align-middle">
                        <Badge>{nameOf(achievement.memberId)}</Badge>
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {achievement.remaining}
                  </p>
                </div>
                <div className="mt-1.5">
                  <ProgressBar
                    ratio={achievement.progress}
                    label={`Progresso: ${achievement.title}`}
                    tone={achievement.progress >= 0.75 ? "positive" : "brand"}
                  />
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {achievement.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
        Um mês difícil não tira nada do que já foi conquistado.
      </p>
    </Card>
  );
}
