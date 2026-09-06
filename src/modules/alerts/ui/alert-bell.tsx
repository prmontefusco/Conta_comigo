"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { buildAlertInbox, inboxStorageKey, markAllSeen } from "@/modules/alerts/domain/alert-inbox";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

/**
 * O sininho.
 *
 * Os avisos já eram calculados e já apareciam no painel — mas só lá, e só
 * quando alguém abria o painel. Quem estava lançando um gasto não via que uma
 * conta de luz vencia em dois dias.
 *
 * O contador conta apenas o que **ainda não foi visto**. Um número que nunca
 * muda vira decoração, e o objetivo aqui é o oposto: que aparecer significa
 * alguma coisa.
 */
export function AlertBell() {
  const finance = useFinance();
  const { household } = useSession();
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<readonly string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const householdId = household?.id ?? "";

  // Lê a marcação deste aparelho. Falha em silêncio: janela anônima,
  // armazenamento bloqueado ou navegador antigo apenas veem tudo como novo.
  useEffect(() => {
    if (!householdId) return;
    try {
      const raw = window.localStorage.getItem(inboxStorageKey(householdId));
      setSeenIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setSeenIds([]);
    }
  }, [householdId]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (finance.loading || !householdId) return null;

  const inbox = buildAlertInbox({ alerts: finance.alerts, seenIds });

  function toggle() {
    const next = !open;
    setOpen(next);

    // Marca ao abrir, não ao fechar: quem abre e navega direto para a conta
    // vencida não deveria reencontrar o mesmo contador na volta.
    if (next && inbox.unseenCount > 0) {
      const ids = markAllSeen(finance.alerts);
      setSeenIds(ids);
      try {
        window.localStorage.setItem(inboxStorageKey(householdId), JSON.stringify(ids));
      } catch {
        // Sem armazenamento, o contador volta na próxima visita. Só isso.
      }
    }
  }

  const badge = inbox.unseenCount;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          badge > 0 ? `Avisos: ${badge} ${badge === 1 ? "novo" : "novos"}` : "Avisos: nenhum novo"
        }
        className="relative flex size-11 items-center justify-center rounded-lg transition hover:bg-[color:var(--color-surface-sunken)]"
      >
        <span aria-hidden="true" className="text-lg">
          🔔
        </span>
        {badge > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{
              background:
                inbox.unseenUrgentCount > 0 ? "var(--tone-critical)" : "var(--color-brand-600)",
            }}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Avisos"
          className="absolute right-0 z-30 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-[color:var(--card-border)] px-4 py-2.5">
            <p className="text-sm font-semibold">Avisos</p>
            <span className="text-2xs" style={{ color: "var(--muted-fg)" }}>
              {inbox.items.length === 0
                ? "nada por aqui"
                : `${inbox.items.length} ${inbox.items.length === 1 ? "item" : "itens"}`}
            </span>
          </div>

          {inbox.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--muted-fg)" }}>
              Nenhuma conta vencida, nenhum vencimento nos próximos dias e nada fora do lugar na
              projeção. Está tudo em ordem hoje.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-[color:var(--card-border)] overflow-y-auto">
              {inbox.items.map(({ alert, unseen }) => {
                const body = (
                  <div className="flex gap-2.5 px-4 py-3">
                    <span
                      aria-hidden="true"
                      className="mt-1 size-2 shrink-0 rounded-full"
                      style={{
                        background:
                          alert.severity === "URGENT"
                            ? "var(--tone-critical)"
                            : alert.severity === "ATTENTION"
                              ? "var(--tone-attention)"
                              : "var(--card-border)",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                        {alert.date ? formatCalendarDate(alert.date) : null}
                        {alert.date && alert.amount ? " · " : null}
                        {alert.amount ? formatMoney(alert.amount) : null}
                        {unseen ? (
                          <span
                            className="ml-1.5 font-semibold"
                            style={{ color: "var(--color-brand-700)" }}
                          >
                            novo
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={alert.id}>
                    {alert.href ? (
                      <Link
                        href={`/app${alert.href}`}
                        onClick={() => setOpen(false)}
                        className="block transition hover:bg-[color:var(--color-surface-sunken)]"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
