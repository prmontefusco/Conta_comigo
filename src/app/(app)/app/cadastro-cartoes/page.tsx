"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  Spinner,
} from "@/components/ui/primitives";
import { NewCardDialog } from "@/modules/cards/ui/new-card-dialog";
import type { CreditCard } from "@/modules/cards/domain/credit-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { SourceColorMark, sourceColor } from "@/modules/shared/ui/source-color";

export default function CardRegistrationPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  if (finance.loading) return <Spinner label="Carregando cadastro de cartões" />;

  const active = finance.cards.filter((card) => !card.archived);
  const archived = finance.cards.filter((card) => card.archived);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cadastro de cartões</h1>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Dados, limites e datas dos cartões. Faturas, compras e importação ficam em Cartões.
          </p>
        </div>
        {canWrite ? <Button onClick={() => setCreating(true)}>Novo cartão</Button> : null}
      </div>

      {active.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((card) => (
            <Card key={card.id}>
              {card.color ? (
                <div
                  aria-hidden="true"
                  className="mb-3 h-1 rounded-full"
                  style={{ backgroundColor: sourceColor(card.color) }}
                />
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 truncate font-semibold">
                    <SourceColorMark color={card.color} />
                    {card.name}
                  </h2>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {card.issuer ?? "Emissor não informado"}
                    {card.lastFourDigits ? ` · final ${card.lastFourDigits}` : ""}
                  </p>
                </div>
                {canWrite ? (
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setEditing(card)}
                    aria-label={`Editar ${card.name}`}
                  >
                    Editar
                  </Button>
                ) : null}
              </div>
              <div className="mt-3">
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  Limite cadastrado
                </p>
                <MoneyText value={card.creditLimit} size="lg" />
              </div>
              <p className="mt-2 text-xs">
                Fecha dia {card.closingDay} · vence dia {card.dueDay}
              </p>
              {card.visibility === "PERSONAL" ? (
                <span className="mt-2 inline-block">
                  <Badge>Pessoal</Badge>
                </span>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="Nenhum cartão cadastrado"
            description="Cadastre o primeiro cartão para acompanhar as faturas."
            action={
              canWrite ? <Button onClick={() => setCreating(true)}>Novo cartão</Button> : undefined
            }
          />
        </Card>
      )}

      {archived.length ? (
        <Card>
          <CardTitle>Cartões arquivados</CardTitle>
          <ul className="divide-y divide-[color:var(--card-border)]">
            {archived.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <SourceColorMark color={card.color} />
                  {card.name}
                </span>
                {canWrite ? (
                  <Button variant="ghost" className="text-xs" onClick={() => setEditing(card)}>
                    Editar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Link href="/app/cartoes" className="inline-block text-sm underline">
        Ver faturas, compras e importações →
      </Link>
      <NewCardDialog
        open={creating || editing !== null}
        card={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
