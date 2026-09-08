"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/core/money/format";
import { Badge, Button, Card, Stat } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { detectarDespesasFantasmas } from "../domain/ghost-subscriptions";

export function GhostSubscriptionsCard() {
  const finance = useFinance();
  const [cortadosLocalmente, setCortadosLocalmente] = useState<Set<string>>(new Set());

  const resultado = useMemo(() => {
    return detectarDespesasFantasmas(finance.recurringRules);
  }, [finance.recurringRules]);

  if (resultado.itens.length === 0) {
    return null;
  }

  const itensAtivos = resultado.itens.filter((i) => !cortadosLocalmente.has(i.id));

  const marcarComoCortado = (id: string) => {
    setCortadosLocalmente((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <Card className="border-l-4 border-l-[color:var(--color-attention-600)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-attention-600)] uppercase">
            Detector de Gastos Invisíveis
          </span>
          <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
            Micro-Assinaturas e Despesas Fantasmas
          </h3>
        </div>
        <Badge tone="attention">
          {itensAtivos.length} cobrança(s) identificada(s)
        </Badge>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
        Cobranças recorrentes de pequeno valor (streamings, aplicativos, academias e tarifas) costumam
        passar despercebidas, mas representam uma fortuna quando somadas ao longo dos anos.
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Custo Somado por Mês"
          value={resultado.totalMensal}
          tone="outflow"
        />
        <Stat
          label="Custo em 1 Ano"
          value={resultado.custoAcumulado1Ano}
          tone="outflow"
        />
        <Stat
          label="Em 5 anos (se investido a 100% CDI)"
          value={resultado.projecaoInvestido5Anos}
          tone="positive"
          hint="Projeção com juros compostos"
        />
      </dl>

      <div className="mt-4 divide-y divide-[color:var(--card-border)] rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)]">
        {resultado.itens.map((item) => {
          const jaCortou = cortadosLocalmente.has(item.id);
          return (
            <div key={item.id} className="flex items-center justify-between p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[color:var(--page-fg)]">{item.nome}</span>
                  {item.provavelSupérfluo && (
                    <span className="rounded bg-[color:var(--color-attention-100)] px-1.5 py-0.5 text-2xs font-semibold text-[color:var(--color-attention-800)]">
                      Supérfluo sugerido
                    </span>
                  )}
                  {jaCortou && (
                    <span className="rounded bg-[color:var(--color-positive-100)] px-1.5 py-0.5 text-2xs font-semibold text-[color:var(--color-positive-800)]">
                      ✓ Marcado para o Dossiê
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  {formatMoney(item.valorMensal)} por mês
                </p>
              </div>

              {!jaCortou ? (
                <Button
                  variant="ghost"
                  className="shrink-0 text-xs text-[color:var(--color-critical-600)] hover:bg-[color:var(--color-critical-50)]"
                  onClick={() => marcarComoCortado(item.id)}
                  title="Marca esta despesa como cortada para comprovar boa-fé perante o juiz no Superendividamento"
                >
                  Já Cancelei / Vou Cortar
                </Button>
              ) : (
                <Link
                  href="/app/superendividamento"
                  className="text-xs font-semibold text-[color:var(--color-brand-600)] underline"
                >
                  Ver no Dossiê &rarr;
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <Link href="/app/superendividamento">
          <Button variant="secondary" className="w-full text-xs">
            ⚖️ Gerar Dossiê de Superendividamento com os cortes comprovados
          </Button>
        </Link>
      </div>
    </Card>
  );
}
