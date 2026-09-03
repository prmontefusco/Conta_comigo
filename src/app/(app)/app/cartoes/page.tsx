"use client";

import { useMemo, useState } from "react";
import { formatCalendarDate, formatMonthKey } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  ProgressBar,
  Spinner,
  Stat,
} from "@/components/ui/primitives";
import {
  computeLimitStatus,
  splitStatements,
  type CardStatement,
} from "@/modules/cards/domain/credit-card";
import { BillingCalendarCard } from "@/modules/cards/ui/billing-calendar-card";
import { InstallmentPlansCard } from "@/modules/cards/ui/installment-plans-card";
import { NewCardDialog } from "@/modules/cards/ui/new-card-dialog";
import { NewPurchaseDialog } from "@/modules/cards/ui/new-purchase-dialog";
import { PayStatementDialog } from "@/modules/cards/ui/pay-statement-dialog";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useMembers } from "@/modules/household/ui/use-members";

/**
 * Cards and statements.
 *
 * Two numbers are shown for every card because they answer different
 * questions: what the next fatura will cost, and how much of the limit is
 * already spoken for by installments that have not been billed yet.
 */
export default function CardsPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [creatingCard, setCreatingCard] = useState(false);
  const [purchaseCardId, setPurchaseCardId] = useState<string | null>(null);
  const [payingStatement, setPayingStatement] = useState<CardStatement | null>(null);

  if (finance.loading) return <Spinner label="Carregando seus cartões" />;

  const cards = finance.cards.filter((card) => !card.archived);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Cartões</h1>
        {canWrite ? <Button onClick={() => setCreatingCard(true)}>Novo cartão</Button> : null}
      </div>

      {cards.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum cartão cadastrado"
            description="Cadastre seus cartões para que as parcelas apareçam nos meses certos da projeção."
            action={
              canWrite ? (
                <Button onClick={() => setCreatingCard(true)}>Novo cartão</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {cards.map((card) => (
            <CardSummary
              key={card.id}
              cardId={card.id}
              onAddPurchase={() => setPurchaseCardId(card.id)}
              onPayStatement={setPayingStatement}
            />
          ))}

          <InstallmentPlansCard />
          <BillingCalendarCard />
        </>
      )}

      <NewCardDialog open={creatingCard} onClose={() => setCreatingCard(false)} />
      <NewPurchaseDialog cardId={purchaseCardId} onClose={() => setPurchaseCardId(null)} />
      <PayStatementDialog statement={payingStatement} onClose={() => setPayingStatement(null)} />
    </div>
  );
}

function CardSummary({
  cardId,
  onAddPurchase,
  onPayStatement,
}: {
  cardId: string;
  onAddPurchase: () => void;
  onPayStatement: (statement: CardStatement) => void;
}) {
  const finance = useFinance();
  const { canWrite } = useSession();
  const { nameOf } = useMembers();

  const card = finance.cards.find((item) => item.id === cardId);

  const statements = useMemo(
    () =>
      finance.cardStatements
        .filter((statement) => statement.creditCardId === cardId)
        .sort((a, b) => (a.referenceMonth < b.referenceMonth ? 1 : -1)),
    [finance.cardStatements, cardId],
  );

  if (!card) return null;

  const limit = computeLimitStatus(card, statements);
  const { overdue, upcoming, settled, next } = splitStatements(statements, finance.asOf);

  // Overdue first, then what is coming, then a short tail of settled ones.
  const listed = [...overdue, ...upcoming.slice(0, 6), ...settled.slice(0, 3)];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle hint={`Fecha dia ${card.closingDay} · vence dia ${card.dueDay}`}>
            {card.name}
          </CardTitle>
          {card.holderMemberId || card.visibility === "PERSONAL" ? (
            <div className="-mt-2 mb-3 flex flex-wrap gap-1.5">
              {card.holderMemberId ? <Badge>{nameOf(card.holderMemberId)}</Badge> : null}
              {card.visibility === "PERSONAL" ? <Badge tone="neutral">Pessoal</Badge> : null}
            </div>
          ) : null}
        </div>
        {canWrite ? (
          <Button variant="secondary" onClick={onAddPurchase}>
            Nova compra
          </Button>
        ) : null}
      </div>

      {overdue.length > 0 ? (
        <div className="mb-4">
          <Callout tone="critical" title="Fatura em atraso">
            {overdue.length === 1
              ? `A fatura de ${formatMonthKey(overdue[0]!.referenceMonth)} venceu em ${formatCalendarDate(overdue[0]!.dueDate)} e ainda tem ${formatMoney(overdue[0]!.remainingAmount)} em aberto.`
              : `${overdue.length} faturas venceram e continuam em aberto.`}
          </Callout>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat
          label="Próxima fatura"
          value={next?.remainingAmount ?? { amount: 0, currency: "BRL" }}
          size="lg"
          tone="outflow"
          hint={
            next
              ? `Vence em ${formatCalendarDate(next.dueDate)}`
              : "Nenhuma fatura futura em aberto."
          }
        />
        <Stat
          label="Comprometido no limite"
          value={limit.committed}
          size="base"
          tone="outflow"
          hint="Inclui parcelas de faturas futuras."
        />
        <Stat
          label="Limite disponível"
          value={limit.available}
          size="base"
          tone={limit.isOverLimit ? "critical" : "positive"}
        />
      </dl>

      <div className="mt-4">
        <ProgressBar
          ratio={limit.utilisation}
          label={`Uso do limite do ${card.name}`}
          tone={
            limit.utilisation >= 0.9 ? "critical" : limit.utilisation >= 0.7 ? "attention" : "brand"
          }
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--muted-fg)" }}>
          {limit.isOverLimit
            ? `Os compromissos somam ${formatMoney(limit.committed)}, acima do limite de ${formatMoney(card.creditLimit)}.`
            : `${Math.round(limit.utilisation * 100)}% de ${formatMoney(card.creditLimit)} comprometido.`}
        </p>
      </div>

      {listed.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Faturas</h3>
          <ul className="mt-2 divide-y divide-[color:var(--card-border)]">
            {listed.map((statement) => (
              <li key={statement.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{formatMonthKey(statement.referenceMonth)}</p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    Fecha {formatCalendarDate(statement.closingDate)} · vence{" "}
                    {formatCalendarDate(statement.dueDate)} · {statement.installments.length}{" "}
                    {statement.installments.length === 1 ? "lançamento" : "lançamentos"}
                  </p>
                  <div className="mt-1">
                    <StatementBadge statement={statement} today={finance.asOf} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <MoneyText value={statement.total} size="sm" tone="outflow" />
                  {canWrite && statement.remainingAmount.amount > 0 ? (
                    <Button
                      variant="secondary"
                      className="mt-1 block w-full text-xs"
                      onClick={() => onPayStatement(statement)}
                    >
                      Pagar
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs" style={{ color: "var(--muted-fg)" }}>
            Pagar a fatura movimenta dinheiro, mas não gera uma nova despesa: as compras já foram
            contabilizadas no mês em que aconteceram.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

function StatementBadge({ statement, today }: { statement: CardStatement; today: string }) {
  // An unpaid statement past its due date is overdue, whatever its own status
  // says about closing. That is the fact the person needs first.
  if (statement.remainingAmount.amount > 0 && statement.dueDate < today) {
    return <Badge tone="critical">Vencida</Badge>;
  }

  switch (statement.status) {
    case "PAID":
      return <Badge tone="positive">Paga</Badge>;
    case "PARTIALLY_PAID":
      return <Badge tone="attention">Paga em parte</Badge>;
    case "CLOSED":
      return <Badge tone="neutral">Fechada</Badge>;
    case "OPEN":
      return <Badge tone="brand">Aberta</Badge>;
  }
}
