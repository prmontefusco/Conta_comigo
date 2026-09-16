"use client";

import { sourceColor } from "@/modules/shared/domain/source-color";
export { sourceColor } from "@/modules/shared/domain/source-color";

export function SourceColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span>Cor de identificação</span>
      <input
        type="color"
        value={sourceColor(value)}
        onChange={(event) => onChange(event.target.value)}
        className="size-11 cursor-pointer rounded border border-[color:var(--card-border)]"
        aria-label="Escolher cor de identificação"
      />
      <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
        Usada para identificar esta conta ou cartão nos lançamentos; não altera saldos.
      </span>
    </label>
  );
}

export function SourceColorMark({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: sourceColor(color) }}
    />
  );
}
