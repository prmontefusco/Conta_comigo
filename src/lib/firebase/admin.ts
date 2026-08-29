import "server-only";

import { getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "@/lib/observability/logger";

/**
 * Firebase Admin SDK, for the payments surface only.
 *
 * `server-only` at the top is load-bearing: importing this file from a Client
 * Component becomes a build error rather than a privileged handle shipped to a
 * browser.
 *
 * There is no service account file anywhere. Credentials come from the
 * environment:
 *
 * - On App Hosting, the backend has its own identity at runtime.
 * - Locally, the App Hosting emulator injects `FIRESTORE_EMULATOR_HOST`,
 *   `FIREBASE_AUTH_EMULATOR_HOST` and `GCLOUD_PROJECT` into the Next process,
 *   and the Admin SDK talks to the emulators without any credential at all.
 *
 * See docs/adr/0009-server-side-payments.md.
 */

let app: App | undefined;

function projectId(): string {
  return (
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    ""
  );
}

/** True when this process is pointed at the local Emulator Suite. */
export function usingEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

/**
 * Refuses the one configuration that would be genuinely dangerous: a
 * development process holding privileged credentials against a real project.
 *
 * Mirrors `assertUsableFirebaseConfig` on the client side, but the stakes here
 * are higher - the Admin SDK ignores Security Rules.
 */
function assertSafeEnvironment(): void {
  if (process.env.NODE_ENV === "production") return;
  if (usingEmulators()) return;
  if (projectId().startsWith("demo-")) return;

  throw new Error(
    `Recusando iniciar o Admin SDK em desenvolvimento contra o projeto real "${projectId()}". ` +
      `O Admin SDK ignora as Security Rules. Use os emuladores. ` +
      `Veja docs/LOCAL_DEVELOPMENT.md.`,
  );
}

export function getAdminApp(): App {
  if (app) return app;

  assertSafeEnvironment();

  const existing = getApps();
  app =
    existing.length > 0 && existing[0]
      ? existing[0]
      : initializeApp(
          usingEmulators()
            ? // No credential is needed - and none should be attempted, or the
              // SDK tries to reach the metadata server and stalls.
              { projectId: projectId() }
            : { credential: applicationDefault(), projectId: projectId() },
        );

  logger.debug("Admin SDK iniciado.", {
    operation: "getAdminApp",
    emulators: usingEmulators(),
  });

  return app;
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}
