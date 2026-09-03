"use client";

import { useMemo } from "react";
import { formatMonthKey } from "@/core/date/calendar-date";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  ProgressBar,
} from "@/components/ui/primitives";
import { openInstallmentPlans } from "@/modules/cards/domain/credit-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useMembers } from "@/modules/household/ui/use-members";

/**
 * Purchases still being paid off, and when each one ends.
 *
 * A parcelamento hides in a monthly total: it always looks small. What makes
 * it visible is the pair of facts shown here - how many are left and the month
 * of the last one - so that "cabe no meu mês" is decided against a date, not
 * against a feeling.
 */
export function InstallmentPlansCard({ cardId }: { cardId?: string }) {
  const finance = useFinance();
  const { nameOf } = useMembers();

  const plans = useMemo(() => {
    const all = openInstallmentPlans(finance.cards, finance.cardPurchases, finance.asOf);
    return cardId ? all.filter((plan) => plan.creditCardId === cardId) : all;
  }, [finance.cards, finance.cardPurchases, finance.asOf, cardId]);

  const cardName = (id: string) => finance.cards.find((card) => card.id === id)?.name ?? "Cartão";

  if (plans.length === 0) {
    return (
      <Card>
        <CardTitle>Compras parceladas</CardTitle>
        <EmptyState
          title="Nenhuma parcela em aberto"
          description="Quando você registrar uma compra parcelada, ela aparece aqui até a última parcela cair."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle hint="Some tudo o que ainda vai ser cobrado destas compras.">
        Compras parceladas em andamento
      </CardTitle>

      <ul className="divide-y divide-[color:var(--card-border)]">
        {plans.map((plan) => (
          <li key={plan.purchaseId} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{plan.description}</p>
                <p className="truncate text-xs" style={{ color: "var(--muted-fg)" }}>
                  {cardName(plan.creditCardId)} · parcela {plan.chargedCount + 1} de{" "}
                  {plan.installmentCount} · última em {formatMonthKey(plan.lastMonth)}
                </p>
                {plan.responsibleMemberId || plan.visibility === "PERSONAL" ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {plan.responsibleMemberId ? (
                      <Badge>{nameOf(plan.responsibleMemberId)}</Badge>
                    ) : null}
                    {plan.visibility === "PERSONAL" ? <Badge tone="neutral">Pessoal</Badge> : null}
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 text-right">
                {plan.next ? <MoneyText value={plan.next.amount} size="sm" tone="outflow" /> : null}
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  por parcela
                </p>
              </div>
            </div>

            <div className="mt-2">
              <ProgressBar
                ratio={plan.chargedCount / plan.installmentCount}
                label={`Andamento do parcelamento de ${plan.description}`}
                tone="brand"
              />
              <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                Faltam {plan.remainingCount} {plan.remainingCount === 1 ? "parcela" : "parcelas"},
                somando <MoneyText value={plan.remainingAmount} size="sm" tone="outflow" />.
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
