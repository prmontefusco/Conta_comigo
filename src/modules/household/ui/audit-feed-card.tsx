"use client";

import { useMemo, useState } from "react";
import { Badge, Card, CardTitle } from "@/components/ui/primitives";
import {
  auditActionIcon,
  formatFamilyAuditEventText,
  sortAuditEventsDescending,
  type FamilyAuditEvent,
} from "../domain/audit-log";

interface AuditFeedCardProps {
  readonly events: readonly FamilyAuditEvent[];
}

export function AuditFeedCard({ events }: AuditFeedCardProps) {
  const [filterActor, setFilterActor] = useState<string>("ALL");

  const sorted = useMemo(() => sortAuditEventsDescending(events), [events]);

  const uniqueActors = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      if (!map.has(e.actorId)) {
        map.set(e.actorId, e.actorName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [events]);

  const filtered = useMemo(() => {
    if (filterActor === "ALL") return sorted;
    return sorted.filter((e) => e.actorId === filterActor);
  }, [sorted, filterActor]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--card-border)] pb-3">
        <div>
          <CardTitle hint="Transparência familiar">
            Histórico de Atividades (&ldquo;Quem fez o quê&rdquo;)
          </CardTitle>
          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
            Registro em tempo real das alterações, pagamentos e despesas cadastrados pelos membros da casa.
          </p>
        </div>

        {uniqueActors.length > 1 ? (
          <label className="text-xs flex items-center gap-1.5">
            <span style={{ color: "var(--muted-fg)" }}>Filtrar por:</span>
            <select
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 py-1 text-xs"
            >
              <option value="ALL">Todos os membros</option>
              {uniqueActors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm" style={{ color: "var(--muted-fg)" }}>
          <p className="text-2xl mb-1">🕊️</p>
          <p className="font-medium">Nenhuma atividade registrada ainda</p>
          <p className="text-xs mt-0.5">
            Quando alguém lançar um gasto, marcar uma conta como paga ou alterar um orçamento, o histórico aparecerá aqui.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--card-border)] text-sm">
          {filtered.slice(0, 15).map((event) => (
            <li key={event.id} className="py-2.5 flex items-start gap-3">
              <span className="text-xl shrink-0 pt-0.5" aria-hidden="true">
                {auditActionIcon(event.actionType)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-xs leading-snug">{formatFamilyAuditEventText(event)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone="neutral">{event.actorName}</Badge>
                  <span className="text-[11px]" style={{ color: "var(--muted-fg)" }}>
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}
