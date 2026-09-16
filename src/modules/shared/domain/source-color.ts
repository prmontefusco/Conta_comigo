const DEFAULT_COLOR = "#64748b";

/** Restrict stored colors to plain CSS hex values before putting them in styles. */
export function sourceColor(value?: string): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_COLOR;
}
