import type { Metadata } from "next";
import { AdSenseScript } from "@/components/ads/ad-slot";
import { AppShell } from "@/components/app-shell";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "Minhas finanças",
  // The authenticated area must never be indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      {/* Renders nothing outside production, so no ad script ever loads
          locally. The auth screens deliberately do not include it. */}
      <AdSenseScript />
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
