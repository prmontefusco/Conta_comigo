import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { assertUsableFirebaseConfig, firebaseEnv } from "./env";

/**
 * Firebase bootstrap for the browser.
 *
 * All data access happens from the client, with Firestore Security Rules as
 * the authorisation layer. That is a deliberate choice: it keeps a single,
 * testable place where access is decided, and it means the project needs no
 * service account anywhere near the repository
 * (docs/adr/0002-client-side-data-access.md).
 */

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let firestoreInstance: Firestore | undefined;

// The SDK throws if an emulator is connected after the first request, and React
// Fast Refresh re-runs modules freely, so both connections must be idempotent.
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;

  // Validated here rather than at module load, so prerendering a page that
  // merely imports this file never fails on a machine without Firebase config.
  const config = assertUsableFirebaseConfig();

  app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function getAuthClient(): Auth {
  if (authInstance) return authInstance;

  authInstance = getAuth(getFirebaseApp());

  // Connected here, not in a shared helper that waits for Firestore too. A
  // screen that only signs someone in must still reach the emulator: coupling
  // the two meant a page using Auth alone would silently talk to the real
  // Firebase project.
  if (firebaseEnv.useEmulators && !authEmulatorConnected) {
    const [host, port] = firebaseEnv.authEmulatorHost.split(":");
    connectAuthEmulator(authInstance, `http://${host ?? "127.0.0.1"}:${port ?? "9099"}`, {
      disableWarnings: true,
    });
    authEmulatorConnected = true;
    logEmulatorConnection("Auth", firebaseEnv.authEmulatorHost);
  }

  return authInstance;
}

export function getDb(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  firestoreInstance = getFirestore(getFirebaseApp());

  if (firebaseEnv.useEmulators && !firestoreEmulatorConnected) {
    const [host, port] = firebaseEnv.firestoreEmulatorHost.split(":");
    connectFirestoreEmulator(firestoreInstance, host ?? "127.0.0.1", Number(port ?? 8080));
    firestoreEmulatorConnected = true;
    logEmulatorConnection("Firestore", firebaseEnv.firestoreEmulatorHost);
  }

  return firestoreInstance;
}

function logEmulatorConnection(service: string, host: string): void {
  if (process.env.NODE_ENV === "production") return;
  // Safe to log: service name, host and project id. Never tokens or data.
  console.info(
    `[conta-comigo] ${service} conectado ao emulador em ${host} (projeto ${firebaseEnv.projectId}).`,
  );
}

/** Test seam: forgets the cached instances between test files. */
export function resetFirebaseForTests(): void {
  app = undefined;
  authInstance = undefined;
  firestoreInstance = undefined;
  authEmulatorConnected = false;
  firestoreEmulatorConnected = false;
}
