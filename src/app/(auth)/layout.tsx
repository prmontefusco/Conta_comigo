import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { SessionProvider } from "@/modules/household/ui/session-provider";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="px-4 py-5">
          <Link href="/" className="inline-flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="relative size-10 overflow-hidden rounded-xl shadow-sm">
              <Image src="/logo.png" alt="" fill sizes="40px" className="object-cover" priority />
            </span>
            <span>Conta comigo</span>
          </Link>
        </header>
        <main id="conteudo" className="flex flex-1 items-start justify-center px-4 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}
