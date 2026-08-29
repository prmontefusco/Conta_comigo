import { getFirebaseApp } from "./client";
import { firebaseEnv } from "./env";
import { describeError, logger } from "@/lib/observability/logger";

/**
 * Firebase App Check.
 *
 * Security Rules decide *who* may read what. App Check adds a different
 * question: whether the request came from this application at all, rather than
 * from a script someone wrote against the same public project id.
 *
 * It is not a replacement for the rules and never guards data on its own. It
 * raises the cost of automated abuse - scripted sign-ups, scraping attempts,
 * read amplification against the billing account.
 *
 * Loaded dynamically, and only when a site key is configured, so that the
 * App Check SDK never reaches the bundle of a build that will not use it.
 * There is no site key in development, and none is wanted: the emulators do
 * not enforce App Check.
 */

let started = false;

export async function initialiseAppCheck(): Promise<void> {
  if (started) return;
  if (typeof window === "undefined") return;

  const siteKey = process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY;
  if (!siteKey) {
    // Expected locally. Announced once so nobody assumes it is on.
    logger.debug("App Check não configurado; ignorando.", {
      operation: "initialiseAppCheck",
      projectId: firebaseEnv.projectId,
    });
    return;
  }

  if (firebaseEnv.useEmulators) {
    logger.debug("App Check ignorado: emuladores não o aplicam.", {
      operation: "initialiseAppCheck",
    });
    return;
  }

  started = true;

  try {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");

    initializeAppCheck(getFirebaseApp(), {
      provider: new ReCaptchaV3Provider(siteKey),
      // Refreshes the token in the background so a long session does not start
      // failing writes halfway through someone entering a month of bills.
      isTokenAutoRefreshEnabled: true,
    });

    logger.info("App Check ativo.", { operation: "initialiseAppCheck" });
  } catch (error) {
    started = false;
    // A failure here must never block the application: the rules are still the
    // thing protecting the data.
    logger.warn("Não foi possível iniciar o App Check.", {
      operation: "initialiseAppCheck",
      ...describeError(error),
    });
  }
}
