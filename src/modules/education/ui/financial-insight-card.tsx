"use client";

import { useState } from "react";
import { Card } from "@/components/ui/primitives";

export interface FinancialInsightProps {
  readonly tag: string;
  readonly title: string;
  readonly description: string;
  readonly tips: readonly string[];
  readonly helpTopic?: string;
  readonly defaultOpen?: boolean;
}

export function FinancialInsightCard({
  tag,
  title,
  description,
  tips,
  helpTopic,
  defaultOpen = false,
}: FinancialInsightProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border-l-4 border-l-[color:var(--color-brand-600)] bg-gradient-to-r from-[color:var(--color-surface-sunken)] to-[color:var(--card-bg)] shadow-xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] text-sm text-white shadow-2xs">
            💡
          </span>
          <div>
            <span className="text-xs font-bold tracking-wider text-[color:var(--color-brand-600)] uppercase">
              {tag}
            </span>
            <h3 className="text-sm font-bold text-[color:var(--page-fg)]">{title}</h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--page-fg)] transition hover:bg-[color:var(--color-surface-sunken)]"
        >
          {open ? "Recolher dica ▲" : "Ver dicas e ajuda ▼"}
        </button>
      </div>

      <p className="mt-2 text-xs text-[color:var(--page-fg)]">{description}</p>

      {open && (
        <div className="animate-in fade-in mt-3 space-y-3 border-t border-[color:var(--card-border)] pt-3 duration-200">
          <div>
            <h4 className="text-xs font-semibold text-[color:var(--page-fg)]">
              📌 Dicas de Ouro para sua Família:
            </h4>
            <ul className="mt-1.5 space-y-1 text-xs" style={{ color: "var(--muted-fg)" }}>
              {tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="font-bold text-[color:var(--color-brand-600)]">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {helpTopic && (
            <div className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-2.5">
              <span className="text-xs font-semibold text-[color:var(--color-positive-600)] uppercase">
                Como usar esta tela:
              </span>
              <p className="mt-0.5 text-xs" style={{ color: "var(--muted-fg)" }}>
                {helpTopic}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
