import { type ReactNode } from "react";
import { formatMoney } from "@/core/money/format";
import { isNegative, type Money } from "@/core/money/money";

/**
 * Small, unopinionated building blocks.
 *
 * Deliberately not a component library: the app owns its markup so that
 * accessibility and the tone of the interface stay under its control
 * (docs/ARCHITECTURE.md, "no architectural dependency on a UI kit").
 */

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

/**
 * A panel.
 *
 * ARIA attributes are forwarded, not swallowed. A `<section>` only becomes a
 * landmark a screen reader can navigate to once it has an accessible name, so
 * dropping `aria-labelledby` here would silently make every panel on the page
 * anonymous.
 */
export function Card({
  children,
  className,
  as: Tag = "section",
  ...aria
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
} & Pick<
  React.HTMLAttributes<HTMLElement>,
  "aria-labelledby" | "aria-label" | "aria-describedby" | "id" | "role"
>) {
  return (
    <Tag
      {...aria}
      className={cn(
        "rounded-[var(--radius-card)] border p-4 sm:p-5",
        "border-[color:var(--card-border)] bg-[color:var(--card-bg)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardTitle({
  children,
  hint,
  id,
}: {
  children: ReactNode;
  hint?: string;
  id?: string;
}) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-sm font-semibold tracking-wide uppercase opacity-70">
        {children}
      </h2>
      {hint ? (
        <p className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal scrolling                                                */
/* ------------------------------------------------------------------ */

/**
 * A container that scrolls sideways, reachable by keyboard.
 *
 * Wide tables and charts have to scroll inside themselves so the page never
 * does. But a scroll container that cannot be focused is unreachable with a
 * keyboard: the content past the right edge simply does not exist for someone
 * who does not use a pointer. `tabIndex` makes it focusable and the arrow keys
 * then scroll it; the label says what they are scrolling.
 *
 * Found by an axe audit on mobile viewports, where these actually overflow.
 */
export function ScrollableX({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cn("overflow-x-auto", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export type MoneyTone = "neutral" | "positive" | "outflow" | "attention" | "critical";

/**
 * Tones resolve through theme-aware variables, not straight palette entries.
 *
 * A figure like "contas vencidas" has to stay legible in both themes; the
 * light-mode 700 shades disappear against a dark card (see globals.css).
 */
const TONE_CLASS: Record<MoneyTone, string> = {
  neutral: "",
  positive: "text-[color:var(--tone-positive)]",
  outflow: "text-[color:var(--tone-outflow)]",
  attention: "text-[color:var(--tone-attention)]",
  critical: "text-[color:var(--tone-critical)]",
};

/**
 * Renders an amount.
 *
 * The sign is spelled out for screen readers - "menos R$ 1.234,56" - because a
 * "−" glyph is announced inconsistently, and the difference between hearing a
 * debt and missing it is the whole point.
 *
 * Deliberately without `aria-label`: ARIA prohibits naming a plain `<span>`,
 * which has no role. An earlier version did exactly that and an axe audit
 * caught it: the label was ignorable and the visible text was `aria-hidden`,
 * so a screen reader could have announced nothing at all where a number was.
 * The sign is now a hidden word next to a visible glyph, which needs no ARIA.
 */
export function MoneyText({
  value,
  tone = "neutral",
  size = "base",
  showSign = false,
  className,
}: {
  value: Money;
  tone?: MoneyTone;
  size?: "sm" | "base" | "lg" | "xl";
  showSign?: boolean;
  className?: string;
}) {
  const sizeClass = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-xl font-semibold",
    xl: "text-3xl font-semibold tracking-tight",
  }[size];

  const negative = isNegative(value);
  const resolvedTone: MoneyTone = tone === "neutral" && negative ? "critical" : tone;

  const magnitude = formatMoney({
    amount: Math.abs(value.amount),
    currency: value.currency,
  });
  const showPlus = showSign && !negative && value.amount !== 0;

  return (
    <span className={cn("tabular", sizeClass, TONE_CLASS[resolvedTone], className)}>
      {negative ? (
        <>
          <span aria-hidden="true">−</span>
          <span className="sr-only">menos </span>
        </>
      ) : null}
      {showPlus ? (
        <>
          <span aria-hidden="true">+</span>
          <span className="sr-only">mais </span>
        </>
      ) : null}
      {magnitude}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stat                                                                */
/* ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  size = "lg",
}: {
  label: string;
  value: Money;
  hint?: ReactNode;
  tone?: MoneyTone;
  size?: "base" | "lg" | "xl";
}) {
  return (
    <div>
      <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
        {label}
      </dt>
      <dd className="mt-0.5">
        <MoneyText value={value} tone={tone} size={size} />
        {hint ? (
          <p className="mt-1 text-sm leading-snug" style={{ color: "var(--muted-fg)" }}>
            {hint}
          </p>
        ) : null}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-[color:var(--color-brand-600)] text-white hover:bg-[color:var(--color-brand-700)]",
  secondary:
    "border border-[color:var(--card-border)] bg-[color:var(--card-bg)] hover:bg-[color:var(--color-ink-50)]",
  ghost: "hover:bg-[color:var(--color-ink-100)]",
  danger:
    "border border-[color:var(--color-critical-600)] text-[color:var(--color-critical-700)] hover:bg-[color:var(--color-critical-100)]",
};

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_CLASS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "attention" | "critical" | "positive";
  title?: string;
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-50)] text-[color:var(--color-ink-900)]",
    attention:
      "border-[color:var(--color-attention-600)] bg-[color:var(--color-attention-100)] text-[color:var(--color-ink-900)]",
    critical:
      "border-[color:var(--color-critical-600)] bg-[color:var(--color-critical-100)] text-[color:var(--color-ink-900)]",
    positive:
      "border-[color:var(--color-positive-600)] bg-[color:var(--color-positive-100)] text-[color:var(--color-ink-900)]",
  }[tone];

  return (
    <div className={cn("rounded-lg border-l-4 p-3 text-sm", toneClass)} role="note">
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm" style={{ color: "var(--muted-fg)" }}>
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10" role="status">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-50"
      />
      <span className="text-sm" style={{ color: "var(--muted-fg)" }}>
        {label}…
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

/**
 * A proportion bar with a real accessible value.
 *
 * Used for budgets and card limits, where the number matters more than the
 * decoration, so the figure is always rendered alongside it by the caller.
 */
export function ProgressBar({
  ratio,
  label,
  tone = "brand",
}: {
  ratio: number;
  label: string;
  tone?: "brand" | "attention" | "critical" | "positive";
}) {
  const clamped = Math.max(0, Math.min(ratio, 1));
  const color = {
    brand: "var(--color-brand-600)",
    attention: "var(--color-attention-600)",
    critical: "var(--color-critical-600)",
    positive: "var(--color-positive-600)",
  }[tone];

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-ink-100)]"
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${clamped * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "attention" | "critical" | "positive" | "brand";
}) {
  const toneClass = {
    neutral: "bg-[color:var(--color-ink-100)] text-[color:var(--color-ink-700)]",
    attention: "bg-[color:var(--color-attention-100)] text-[color:var(--color-attention-700)]",
    critical: "bg-[color:var(--color-critical-100)] text-[color:var(--color-critical-700)]",
    positive: "bg-[color:var(--color-positive-100)] text-[color:var(--color-positive-700)]",
    brand: "bg-[color:var(--color-brand-100)] text-[color:var(--color-brand-700)]",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}
