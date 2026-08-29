"use client";

import type { ReactNode } from "react";
import { FinanceProvider } from "@/modules/household/ui/finance-provider";
import { SessionProvider } from "@/modules/household/ui/session-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <FinanceProvider>{children}</FinanceProvider>
    </SessionProvider>
  );
}
