import net from "node:net";
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const npx = isWindows ? "npx.cmd" : "npx";
const children = new Set();

const ports = {
  firestore: { host: "127.0.0.1", port: 8080 },
  auth: { host: "127.0.0.1", port: 9099 },
};

process.env.FIRESTORE_EMULATOR_HOST ??= `${ports.firestore.host}:${ports.firestore.port}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${ports.auth.host}:${ports.auth.port}`;
process.env.GCLOUD_PROJECT ??= "demo-conta-comigo";
process.env.GOOGLE_CLOUD_PROJECT ??= process.env.GCLOUD_PROJECT;

function log(message = "") {
  console.info(`[start-app] ${message}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(isWindows ? [command, ...args].join(" ") : command, isWindows ? [] : args, {
      cwd: process.cwd(),
      env: process.env,
      shell: isWindows,
      stdio: options.stdio ?? "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function start(command, args, name) {
  const child = spawn(isWindows ? [command, ...args].join(" ") : command, isWindows ? [] : args, {
    cwd: process.cwd(),
    env: process.env,
    shell: isWindows,
    stdio: "inherit",
  });

  children.add(child);
  child.on("exit", () => children.delete(child));
  child.on("error", (error) => {
    console.error(`[start-app] ${name} falhou:`, error);
  });

  return child;
}

function canConnect({ host, port }) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function waitForPort(label, target, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(target)) {
      log(`${label} pronto em ${target.host}:${target.port}`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${label} não ficou pronto em ${target.host}:${target.port}`);
}

async function shutdown(signal) {
  log(`${signal} recebido. Encerrando processos locais...`);

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }

  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function main() {
  console.info("");
  console.info("=================================================================");
  console.info("  CONTA COMIGO - AMBIENTE LOCAL COMPLETO");
  console.info("=================================================================");
  console.info("");
  log("Limpando portas locais antigas...");
  await run("node", ["scripts/kill-emulators.mjs"]);

  log("Subindo Firebase Auth e Firestore em modo demo...");
  start(npm, ["run", "emulators"], "Firebase emulators");

  await Promise.all([
    waitForPort("Firestore", ports.firestore),
    waitForPort("Auth", ports.auth),
  ]);

  log("Criando dados padrão...");
  await run(npm, ["run", "seed"]);

  log("Criando usuário completo para teste...");
  await run(npx, ["tsx", "scripts/seed-test-user.ts"]);

  console.info("");
  console.info("Usuário de teste:");
  console.info("  E-mail: teste@contacomigo.local");
  console.info("  Senha:  Teste1234!");
  console.info("");
  console.info("Aplicativo:       http://localhost:3000");
  console.info("Firebase Emulator: http://127.0.0.1:4000");
  console.info("");
  log("Iniciando Next.js...");
  start(npm, ["run", "dev"], "Next.js");
}

main().catch((error) => {
  console.error("[start-app] Falhou:", error);
  process.exitCode = 1;
});
