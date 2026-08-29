import Link from "next/link";
import type { Metadata } from "next";
import { SessionProvider } from "@/modules/household/ui/session-provider";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="px-4 py-5">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Conta comigo
          </Link>
        </header>
        <main id="conteudo" className="flex flex-1 items-start justify-center px-4 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}
