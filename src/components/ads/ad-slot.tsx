"use client";

import { useEffect, useRef } from "react";
import { firebaseEnv } from "@/lib/firebase/env";

/**
 * The one place advertising can appear.
 *
 * Two rules are enforced here rather than left to reviewers:
 *
 * 1. No real ad script ever loads outside production. Locally and in tests a
 *    labelled placeholder renders instead (docs/ADSENSE.md).
 * 2. Nothing about the person's money is ever passed to the ad network. No
 *    balances, no categories, no income, no household data - not as targeting
 *    parameters, not as custom channels, not in the URL. The component takes
 *    no financial props at all, so there is nothing to leak (docs/PRIVACY
 *    section of docs/SECURITY.md).
 */

export type AdPlacement =
  /** Between two informational blocks on the dashboard. */
  | "dashboard-inline"
  /** Sidebar rail, desktop only. */
  | "app-rail"
  /** Below the article body on public content pages. */
  | "content-footer";

const PLACEMENT_SIZES: Record<AdPlacement, { minHeight: string; label: string }> = {
  "dashboard-inline": { minHeight: "6rem", label: "Espaço publicitário" },
  "app-rail": { minHeight: "15rem", label: "Espaço publicitário" },
  "content-footer": { minHeight: "8rem", label: "Espaço publicitário" },
};

interface AdSlotProps {
  placement: AdPlacement;
  /** AdSense ad unit id. Configured per placement in production. */
  slotId?: string;
  /**
   * Premium plans see no advertising. Passed explicitly so the decision is
   * visible at the call site rather than hidden in a context read.
   */
  hidden?: boolean;
}

export function AdSlot({ placement, slotId, hidden = false }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  const size = PLACEMENT_SIZES[placement];

  const shouldLoadRealAds =
    firebaseEnv.adsEnabled &&
    process.env.NODE_ENV === "production" &&
    Boolean(firebaseEnv.adsenseClientId) &&
    Boolean(slotId);

  useEffect(() => {
    if (!shouldLoadRealAds || pushed.current) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
    } catch {
      // An ad failing to render must never break a financial screen.
    }
  }, [shouldLoadRealAds]);

  if (hidden) return null;

  if (!shouldLoadRealAds) {
    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        data-testid={`ad-placeholder-${placement}`}
        className="flex items-center justify-center rounded-lg border border-dashed border-[color:var(--card-border)] text-xs"
        style={{ minHeight: size.minHeight, color: "var(--muted-fg)" }}
      >
        [ {size.label} ]
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-hidden">
      {/* Labelled so it is never mistaken for part of the product's own advice. */}
      <p
        className="mb-1 text-[0.6875rem] tracking-wide uppercase"
        style={{ color: "var(--muted-fg)" }}
      >
        Publicidade
      </p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block", minHeight: size.minHeight }}
        data-ad-client={firebaseEnv.adsenseClientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

/**
 * Loads the AdSense library, in production only.
 *
 * Rendered once in the layout. Locally it renders nothing at all, so no
 * request ever leaves a developer machine.
 */
export function AdSenseScript() {
  if (process.env.NODE_ENV !== "production") return null;
  if (!firebaseEnv.adsEnabled || !firebaseEnv.adsenseClientId) return null;

  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${firebaseEnv.adsenseClientId}`}
      crossOrigin="anonymous"
    />
  );
}
