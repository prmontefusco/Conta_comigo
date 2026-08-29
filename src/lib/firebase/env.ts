import { z } from "zod";

/**
 * Firebase environment.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so the references
 * below have to be written out literally rather than looked up dynamically.
 *
 * Validation is deliberately *lazy*. Reading this module must never throw:
 * `next build` prerenders pages that import it long before any Firebase call
 * happens, and a build machine legitimately has no Firebase configuration.
 * The check runs at the moment the SDK is actually initialised, where a
 * missing value is a genuine problem and the message can be acted on.
 */

const configSchema = z.object({
  projectId: z.string().min(1, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  apiKey: z.string().min(1, "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: z.string().min(1, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  appId: z.string().min(1, "NEXT_PUBLIC_FIREBASE_APP_ID"),
  messagingSenderId: z.string().min(1, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
});

export type FirebaseConfig = z.infer<typeof configSchema>;

export interface FirebaseEnv extends FirebaseConfig {
  readonly useEmulators: boolean;
  readonly authEmulatorHost: string;
  readonly firestoreEmulatorHost: string;
  readonly adsEnabled: boolean;
  readonly adsenseClientId: string | undefined;
  readonly siteUrl: string;
}

export const firebaseEnv: FirebaseEnv = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true",
  authEmulatorHost: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099",
  firestoreEmulatorHost: process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080",
  adsEnabled: process.env.NEXT_PUBLIC_ADS_ENABLED === "true",
  adsenseClientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:5002",
};

/**
 * A `demo-` project id makes the emulators refuse to reach real Google Cloud.
 *
 * It is the strongest available guarantee that a development session cannot
 * touch production data or incur cost (docs/LOCAL_DEVELOPMENT.md).
 */
export const isDemoProject = (): boolean => firebaseEnv.projectId.startsWith("demo-");

/**
 * Validates the configuration and refuses the one genuinely dangerous setup:
 * a development session pointed at a real Firebase project.
 *
 * Called from the Firebase bootstrap, never at module load.
 */
export function assertUsableFirebaseConfig(): FirebaseConfig {
  const parsed = configSchema.safeParse(firebaseEnv);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.message).join(", ");
    throw new Error(
      `Configuração do Firebase ausente: ${missing}. ` +
        `Rode "npm run dev:local" ou copie .env.example para .env.local. ` +
        `Veja docs/LOCAL_DEVELOPMENT.md.`,
    );
  }

  if (process.env.NODE_ENV !== "production" && !firebaseEnv.useEmulators && !isDemoProject()) {
    throw new Error(
      `Recusando iniciar em desenvolvimento contra o projeto real "${firebaseEnv.projectId}". ` +
        `Use os emuladores (NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true) ou um projeto demo-*. ` +
        `Veja docs/LOCAL_DEVELOPMENT.md.`,
    );
  }

  return parsed.data;
}
