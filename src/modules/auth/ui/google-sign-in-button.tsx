"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/ui/form";
import { authErrorMessage } from "@/modules/auth/ui/auth-errors";
import {
  completeGoogleRedirect,
  signInWithGoogle,
} from "@/modules/auth/application/google-sign-in";

/**
 * "Continuar com o Google".
 *
 * Handles both legs of the flow: the click, and the page load the browser
 * comes back to when the popup was blocked and a redirect was used instead.
 * Without the second half, a blocked popup would sign the person in and then
 * drop them back on the login screen as if nothing had happened.
 *
 * Someone signing in for the first time lands on the onboarding screen; anyone
 * else goes straight to the app, because being shown a setup checklist you
 * already finished is its own small insult.
 */
export function GoogleSignInButton({ label = "Continuar com o Google" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void completeGoogleRedirect()
      .then((result) => {
        if (!active || !result || result.status !== "SIGNED_IN") return;
        router.replace(result.isNew ? "/app/comecar" : "/app");
      })
      .catch((redirectError) => {
        if (active) setError(authErrorMessage(redirectError));
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function onClick() {
    setError(null);
    setBusy(true);
    try {
      const result = await signInWithGoogle();
      if (result.status === "SIGNED_IN") {
        router.replace(result.isNew ? "/app/comecar" : "/app");
        return;
      }
      // REDIRECTING leaves the page; CANCELLED needs no message at all.
    } catch (signInError) {
      setError(authErrorMessage(signInError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <FormError>{error}</FormError> : null}

      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 text-sm font-medium shadow-2xs transition hover:bg-[color:var(--color-ink-50)] disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "Abrindo o Google…" : label}
      </button>
    </div>
  );
}

/** The Google mark, inline so the button never waits on a network request. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/** A labelled rule, so the two ways in read as alternatives rather than steps. */
export function AuthDivider({ children = "ou" }: { children?: string }) {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-[color:var(--card-border)]" />
      <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
        {children}
      </span>
      <span className="h-px flex-1 bg-[color:var(--card-border)]" />
    </div>
  );
}
