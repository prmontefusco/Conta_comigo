"use client";

import { useState, useEffect } from "react";
import { formatMoney } from "@/core/money/format";
import { type Money, isPositive } from "@/core/money/money";
import { Badge, Button, Card, CardTitle } from "@/components/ui/primitives";
import {
  createImpulseReflection,
  checkReflectionStatus,
  resolveReflection,
  getSelfControlStats,
  loadLocalReflections,
  saveLocalReflections,
  type ImpulseReflection,
} from "../domain/impulse-lock";

interface ImpulseLockCardProps {
  householdId: string;
  suggestedItemName?: string;
  suggestedAmount?: Money;
  onActivateSuggestion?: () => void;
}

export function ImpulseLockCard({
  householdId,
  suggestedItemName,
  suggestedAmount,
  onActivateSuggestion,
}: ImpulseLockCardProps) {
  const [reflections, setReflections] = useState<ImpulseReflection[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Carrega reflexões persistidas
  useEffect(() => {
    if (householdId) {
      setReflections(loadLocalReflections(householdId));
    }
  }, [householdId]);

  // Atualiza relógio para countdown a cada 30 segundos
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const updateReflections = (next: ImpulseReflection[]) => {
    setReflections(next);
    saveLocalReflections(householdId, next);
  };

  const handleCreateLock = (name: string, amount: Money, reason?: string) => {
    const newRefl = createImpulseReflection({
      householdId,
      itemName: name,
      amount,
      reason: reason || "Desejo espontâneo de compra",
      now: new Date(),
    });
    const next = [newRefl, ...reflections];
    updateReflections(next);
    if (onActivateSuggestion) onActivateSuggestion();
  };

  const handleResolve = (
    id: string,
    decision: "ABANDONED" | "PURCHASED",
    note?: string,
  ) => {
    const next = reflections.map((r) =>
      r.id === id ? resolveReflection(r, decision, note, new Date()) : r,
    );
    updateReflections(next);
  };

  const stats = getSelfControlStats(reflections);
  const activeLocks = reflections.filter((r) => r.status === "IN_PROGRESS");
  const pastLocks = reflections.filter((r) => r.status !== "IN_PROGRESS");

  return (
    <Card className="border-l-4 border-l-[color:var(--color-brand-600)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle hint="Neurociência aplicada ao bolso: dar 24 horas ao cérebro elimina o impulso de dopamina e evita arrependimento.">
          Trava de Impulso &bull; Reflexão de 24 Horas
        </CardTitle>
        {isPositive(stats.totalSaved) ? (
          <Badge tone="positive">
            🎉 {formatMoney(stats.totalSaved)} economizados por autocontrole!
          </Badge>
        ) : null}
      </div>

      {/* Botão de acionamento rápido se houver item preenchido */}
      {suggestedAmount && isPositive(suggestedAmount) && suggestedItemName ? (
        <div className="mt-3 rounded-xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3 dark:border-[color:var(--color-brand-800)] dark:bg-[color:var(--color-brand-950)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[color:var(--color-brand-900)] dark:text-[color:var(--color-brand-100)]">
                Pensando em comprar <span className="font-bold">{suggestedItemName}</span> (
                {formatMoney(suggestedAmount)})?
              </p>
              <p className="text-xs text-[color:var(--color-brand-700)] dark:text-[color:var(--color-brand-300)]">
                Não decida agora sob o efeito da novidade. Deixe a trava segurar a decisão por 24h.
              </p>
            </div>
            <Button
              variant="primary"
              className="text-xs"
              onClick={() => handleCreateLock(suggestedItemName, suggestedAmount)}
            >
              ⏳ Ativar Reflexão de 24h
            </Button>
          </div>
        </div>
      ) : null}

      {/* Itens em reflexão ativa */}
      <div className="mt-4 space-y-3">
        {activeLocks.length === 0 ? (
          <p className="text-xs italic" style={{ color: "var(--muted-fg)" }}>
            Nenhuma compra sob trava de reflexão no momento. Sempre que sentir vontade súbita de gastar,
            ative a trava aqui antes de passar o cartão.
          </p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-fg)]">
              Em período de reflexão ({activeLocks.length})
            </p>
            <div className="space-y-3">
              {activeLocks.map((item) => {
                const progress = checkReflectionStatus(item, currentTime);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-sm">{item.itemName}</h4>
                        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                          {formatMoney(item.amount)} &bull; Motivo: {item.reason}
                        </p>
                      </div>
                      <Badge
                        tone={progress.isLocked ? "attention" : "positive"}
                      >
                        {progress.isLocked
                          ? `🔒 Faltam ${progress.remainingHours}h ${progress.remainingMinutes}m`
                          : "🔓 24h concluídas!"}
                      </Badge>
                    </div>

                    {/* Barra de progresso visual */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-ink-200)]">
                      <div
                        className="h-full bg-[color:var(--color-brand-600)] transition-all duration-500"
                        style={{ width: `${progress.percentElapsed}%` }}
                      />
                    </div>

                    {/* Botões de Decisão */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleResolve(
                            item.id,
                            "ABANDONED",
                            "Desisti friamente após o período de reflexão!",
                          )
                        }
                        className="rounded-lg bg-[color:var(--color-positive-600)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[color:var(--color-positive-700)] transition"
                      >
                        ✅ Desisti de comprar (+{formatMoney(item.amount)} poupados)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleResolve(
                            item.id,
                            "PURCHASED",
                            "Refleti e concluí que o item é realmente necessário.",
                          )
                        }
                        className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--color-ink-50)] transition"
                      >
                        🛒 Decidi comprar com consciência
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Histórico e Estatísticas */}
      {pastLocks.length > 0 ? (
        <div className="mt-5 border-t border-[color:var(--card-border)] pt-3">
          <div className="flex items-center justify-between text-xs text-[color:var(--muted-fg)]">
            <span>
              Histórico: {stats.abandonedCount} compras evitadas ({Math.round(stats.abandonmentRate * 100)}% de taxa de autocontrole).
            </span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
