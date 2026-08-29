"use client";

import { useEffect, type ReactNode } from "react";
import { initialiseAppCheck } from "@/lib/firebase/app-check";
import { FinanceProvider } from "@/modules/household/ui/finance-provider";
import { SessionProvider } from "@/modules/household/ui/session-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  // Starts App Check when a site key is configured. It is a no-op locally and
  // never blocks rendering: Security Rules remain what protects the data.
  useEffect(() => {
    void initialiseAppCheck();
  }, []);

  return (
    <SessionProvider>
      <FinanceProvider>{children}</FinanceProvider>
    </SessionProvider>
  );
}
