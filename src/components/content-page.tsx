import Link from "next/link";
import type { ReactNode } from "react";
import { AdSlot } from "@/components/ads/ad-slot";

/**
 * Layout for the public content pages.
 *
 * Advertising sits after the article, never inside it, so an ad can never be
 * mistaken for part of the guidance (docs/ADSENSE.md).
 */
export function ContentPage({
  title,
  intro,
  children,
  cta = true,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  cta?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <article>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg" style={{ color: "var(--muted-fg)" }}>
          {intro}
        </p>
        <div className="prose-content mt-8 space-y-6">{children}</div>
      </article>

      {cta ? (
        <div className="mt-12 rounded-[var(--radius-card)] border border-[color:var(--card-border)] p-6 text-center">
          <p className="font-medium">Quer ver isso com os seus próprios números?</p>
          <Link
            href="/criar-conta"
            className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-[color:var(--color-brand-600)] px-6 font-medium text-white"
          >
            Criar conta gratuita
          </Link>
        </div>
      ) : null}

      <div className="mt-12">
        <AdSlot placement="content-footer" />
      </div>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-3 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
