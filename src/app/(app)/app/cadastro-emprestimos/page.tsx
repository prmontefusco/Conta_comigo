"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { zero } from "@/core/money/money";
import { Badge, Button, Card, EmptyState, MoneyText, Spinner } from "@/components/ui/primitives";
import {
  buildSchedule,
  DEBT_KIND_LABELS,
  outstandingPrincipal,
  type Debt,
} from "@/modules/debts/domain/debt";
import { DebtDialog } from "@/modules/debts/ui/debt-dialog";
import { legacyCardAgreements, loanContracts } from "@/modules/debts/domain/debt-sections";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

export default function LoanRegistrationPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  if (finance.loading) return <Spinner label="Carregando cadastro de empréstimos" />;

  const loans = loanContracts(finance.debts);
  const olderCardAgreements = legacyCardAgreements(finance.debts);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Empréstimos e financiamentos</h1>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Cadastre empréstimos pessoais, consignados, financiamentos habitacionais, veiculares,
            estudantis, rurais, empresariais e outros contratos de crédito.
          </p>
        </div>
        {canWrite ? <Button onClick={() => setCreating(true)}>Novo contrato</Button> : null}
      </div>

      {loans.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {loans.map((debt) => {
            const paid = finance.paidDebtInstallments.get(debt.id) ?? [];
            const next =
              debt.status === "SETTLED"
                ? undefined
                : buildSchedule(debt).find((item) => !paid.includes(item.number));
            return (
              <Card key={debt.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{debt.description}</h2>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      {DEBT_KIND_LABELS[debt.kind]}
                      {debt.institution ? ` · ${debt.institution}` : ""}
                    </p>
                  </div>
                  {canWrite ? (
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setEditing(debt)}
                      aria-label={`Editar ${debt.description}`}
                    >
                      Editar
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[color:var(--card-border)] pt-3">
                  <div>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      Saldo devedor
                    </p>
                    <MoneyText
                      value={debt.status === "SETTLED" ? zero() : outstandingPrincipal(debt, paid)}
                      size="sm"
                    />
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                      Parcela
                    </p>
                    <MoneyText value={next?.total ?? { amount: 0, currency: "BRL" }} size="sm" />
                  </div>
                </div>
                <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {next
                    ? `Próximo vencimento ${formatCalendarDate(next.dueDate)}`
                    : "Nenhuma parcela pendente"}
                </p>
                {debt.status === "SETTLED" ? <Badge tone="positive">Quitado</Badge> : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="Nenhum contrato cadastrado"
            description="Cadastre um empréstimo ou financiamento para acompanhar parcelas, juros e vencimentos."
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>Novo contrato</Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {olderCardAgreements.length ? (
        <details className="rounded-lg border border-[color:var(--card-border)] p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Acordos de cartão cadastrados anteriormente ({olderCardAgreements.length})
          </summary>
          <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
            Mantidos aqui para correção. Novos parcelamentos de fatura são registrados em Cartões.
          </p>
          <ul className="mt-2 divide-y divide-[color:var(--card-border)]">
            {olderCardAgreements.map((debt) => (
              <li key={debt.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{debt.description}</span>
                {canWrite ? (
                  <Button variant="ghost" className="text-xs" onClick={() => setEditing(debt)}>
                    Editar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
        Acordos vinculados a faturas importadas são acompanhados em{" "}
        <Link href="/app/cartoes" className="underline">
          Cartões
        </Link>
        .
      </p>
      <Link href="/app/dividas" className="inline-block text-sm underline">
        Ver análise dos empréstimos →
      </Link>
      <DebtDialog
        open={creating || editing !== null}
        debt={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
