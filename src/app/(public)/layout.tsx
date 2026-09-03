import { AdSenseScript } from "@/components/ads/ad-slot";
import { PublicFooter, PublicHeader } from "@/components/public-nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AdSenseScript />
      <PublicHeader />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
