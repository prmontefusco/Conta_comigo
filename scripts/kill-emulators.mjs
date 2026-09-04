import { execSync } from "node:child_process";

/**
 * Libera as portas dos emuladores.
 *
 * O processo Java do Firestore nem sempre morre ao receber SIGINT no Windows, e
 * a execução seguinte falha com "port taken". O problema estava documentado em
 * docs/LOCAL_DEVELOPMENT.md com a solução manual; isto é a solução manual, sem
 * a parte manual.
 *
 *   npm run emulators:kill
 */

const PORTS = [
  3000, // Next.js dev server
  4000, // Emulator UI
  4400, // Emulator Hub
  4500, // reservada
  5002, // App Hosting
  8080, // Firestore
  9099, // Authentication
  9150, // websocket da UI
];

const isWindows = process.platform === "win32";

function pidsOn(port) {
  try {
    if (isWindows) {
      const output = execSync(`netstat -ano -p TCP | findstr LISTENING | findstr :${port}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      return [
        ...new Set(
          output
            .split("\n")
            .map((line) => line.trim().split(/\s+/).at(-1))
            .filter((pid) => pid && /^\d+$/.test(pid) && pid !== "0"),
        ),
      ];
    }

    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.split("\n").filter(Boolean);
  } catch {
    // Nada escutando nessa porta: é o caso comum, não um erro.
    return [];
  }
}

function kill(pid) {
  try {
    execSync(isWindows ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

let killed = 0;

for (const port of PORTS) {
  for (const pid of pidsOn(port)) {
    if (kill(pid)) {
      console.info(`[emulators:kill] porta ${port} liberada (pid ${pid})`);
      killed += 1;
    } else {
      console.warn(`[emulators:kill] não foi possível encerrar o pid ${pid} na porta ${port}`);
    }
  }
}

console.info(
  killed === 0
    ? "[emulators:kill] nenhuma porta de emulador estava ocupada."
    : `[emulators:kill] ${killed} processo(s) encerrado(s).`,
);
