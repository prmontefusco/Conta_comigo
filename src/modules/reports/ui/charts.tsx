"use client";

import { type ReactNode } from "react";
import { formatMonthShort, type MonthKey } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import type { Money } from "@/core/money/money";
import { MoneyText, ScrollableX } from "@/components/ui/primitives";

/**
 * Charts.
 *
 * Hand-written SVG rather than a charting library: these are simple shapes,
 * and owning them keeps colours theme-aware and the accessible alternative
 * honest. A library would add weight and take both out of our hands.
 *
 * Every chart here is decorative to assistive technology (`aria-hidden`) and
 * is always accompanied by the same data as real text or a real table. A chart
 * nobody can read is not a chart, it is decoration.
 */

/* ------------------------------------------------------------------ */
/* Horizontal bars                                                     */
/* ------------------------------------------------------------------ */

export interface BarListItem {
  readonly key: string;
  readonly label: string;
  readonly value: Money;
  /** 0 to 1. */
  readonly ratio: number;
  readonly caption?: ReactNode;
  readonly tone?: "brand" | "attention" | "critical" | "positive";
}

/**
 * A ranked list with proportional bars.
 *
 * The number is always rendered next to the bar, so the bar adds a sense of
 * proportion without ever being the only way to read the value.
 */
export function BarList({
  items,
  emptyLabel,
}: {
  items: readonly BarListItem[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-sm" style={{ color: "var(--muted-fg)" }}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium">{item.label}</span>
            <MoneyText value={item.value} size="sm" tone="outflow" />
          </div>

          <div
            aria-hidden="true"
            className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-ink-100)]"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(Math.min(item.ratio, 1), 0) * 100}%`,
                backgroundColor: toneColor(item.tone ?? "brand"),
              }}
            />
          </div>

          {item.caption ? (
            <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
              {item.caption}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Monthly columns                                                     */
/* ------------------------------------------------------------------ */

export interface ColumnSeries {
  readonly key: string;
  readonly label: string;
  readonly tone: "brand" | "attention" | "critical" | "positive" | "muted";
  readonly values: readonly Money[];
}

/**
 * Grouped columns over months.
 *
 * Used for income against spending, and for planned against realised. The
 * table underneath carries the same figures for screen readers and for anyone
 * who wants the exact numbers.
 */
export function MonthlyColumns({
  months,
  series,
  caption,
}: {
  months: readonly MonthKey[];
  series: readonly ColumnSeries[];
  caption: string;
}) {
  const peak = Math.max(
    1,
    ...series.flatMap((entry) => entry.values.map((value) => Math.abs(value.amount))),
  );

  const columnWidth = 100 / Math.max(months.length, 1);
  const barWidth = (columnWidth * 0.7) / Math.max(series.length, 1);

  return (
    <figure className="m-0">
      <ScrollableX label={caption} className="-mx-1 px-1">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 44"
          preserveAspectRatio="none"
          className="h-40 w-full min-w-[20rem]"
          role="presentation"
        >
          {[0, 0.5, 1].map((line) => (
            <line
              key={line}
              x1="0"
              x2="100"
              y1={40 - line * 38}
              y2={40 - line * 38}
              stroke="var(--card-border)"
              strokeWidth="0.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {months.map((month, monthIndex) =>
            series.map((entry, seriesIndex) => {
              const value = entry.values[monthIndex];
              if (!value) return null;
              const height = (Math.abs(value.amount) / peak) * 38;
              const x = monthIndex * columnWidth + columnWidth * 0.15 + seriesIndex * barWidth;

              return (
                <rect
                  key={`${month}-${entry.key}`}
                  x={x}
                  y={40 - height}
                  width={Math.max(barWidth - 0.4, 0.4)}
                  height={Math.max(height, value.amount === 0 ? 0 : 0.4)}
                  fill={toneColor(entry.tone)}
                  rx="0.4"
                />
              );
            }),
          )}
        </svg>
      </ScrollableX>

      <div
        aria-hidden="true"
        className="mt-1 flex text-[0.6875rem]"
        style={{ color: "var(--muted-fg)" }}
      >
        {months.map((month) => (
          <span key={month} className="flex-1 text-center">
            {formatMonthShort(month)}
          </span>
        ))}
      </div>

      <ChartLegend series={series} />

      <figcaption className="sr-only">{caption}</figcaption>
      <DataTable months={months} series={series} caption={caption} />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Trend line                                                          */
/* ------------------------------------------------------------------ */

/**
 * A single line over months.
 *
 * Used for the debt trajectory, where the shape of the line - falling, flat or
 * rising - is the whole message.
 */
export function TrendLine({
  months,
  values,
  caption,
  tone = "brand",
}: {
  months: readonly MonthKey[];
  values: readonly Money[];
  caption: string;
  tone?: "brand" | "attention" | "critical" | "positive";
}) {
  const peak = Math.max(1, ...values.map((value) => Math.abs(value.amount)));
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;

  const points = values.map((value, index) => ({
    x: index * step,
    y: 40 - (Math.abs(value.amount) / peak) * 36,
  }));

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  const area = points.length ? `${path} L100,42 L0,42 Z` : "";

  return (
    <figure className="m-0">
      <ScrollableX label={caption} className="-mx-1 px-1">
        <svg
          aria-hidden="true"
          viewBox="0 0 100 44"
          preserveAspectRatio="none"
          className="h-40 w-full min-w-[20rem]"
          role="presentation"
        >
          <path d={area} fill={toneColor(tone)} opacity="0.12" />
          <path
            d={path}
            fill="none"
            stroke={toneColor(tone)}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => (
            <circle
              key={months[index] ?? index}
              cx={point.x}
              cy={point.y}
              r="1"
              fill={toneColor(tone)}
            />
          ))}
        </svg>
      </ScrollableX>

      <div
        aria-hidden="true"
        className="mt-1 flex text-[0.6875rem]"
        style={{ color: "var(--muted-fg)" }}
      >
        {months.map((month) => (
          <span key={month} className="flex-1 text-center">
            {formatMonthShort(month)}
          </span>
        ))}
      </div>

      <figcaption className="sr-only">{caption}</figcaption>
      <DataTable
        months={months}
        series={[{ key: "total", label: caption, tone, values }]}
        caption={caption}
      />
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function ChartLegend({ series }: { series: readonly ColumnSeries[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {series.map((entry) => (
        <li key={entry.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-sm"
            style={{ backgroundColor: toneColor(entry.tone) }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The chart's data as a real table, visible only to assistive technology.
 *
 * This is the accessible alternative for every SVG on the page. It carries the
 * exact figures, not a summary.
 */
function DataTable({
  months,
  series,
  caption,
}: {
  months: readonly MonthKey[];
  series: readonly ColumnSeries[];
  caption: string;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Mês</th>
          {series.map((entry) => (
            <th key={entry.key} scope="col">
              {entry.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {months.map((month, index) => (
          <tr key={month}>
            <th scope="row">{month}</th>
            {series.map((entry) => (
              <td key={entry.key}>
                {entry.values[index] ? formatMoney(entry.values[index]!) : "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function toneColor(tone: string): string {
  switch (tone) {
    case "positive":
      return "var(--tone-positive)";
    case "attention":
      return "var(--tone-attention)";
    case "critical":
      return "var(--tone-critical)";
    case "muted":
      return "var(--color-ink-300)";
    default:
      return "var(--color-brand-600)";
  }
}
