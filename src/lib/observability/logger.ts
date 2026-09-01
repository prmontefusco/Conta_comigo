/**
 * Logging.
 *
 * The rule from docs/SECURITY.md is that logs never carry financial values,
 * tokens or personal data. Relying on everyone remembering that is how a
 * balance ends up in a log aggregator, so this module enforces it: the context
 * object is scrubbed before anything is written.
 *
 * What logs are for here: which operation failed, on which collection, with
 * which error code. That is enough to fix a bug and never enough to learn what
 * someone earns.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Keys whose values are never written, whatever they contain. */
const FORBIDDEN_KEYS = new Set([
  "amount",
  "balance",
  "saldo",
  "valor",
  "openingbalance",
  "creditlimit",
  "settledamount",
  "totalamount",
  "installmentamount",
  "principalcontracted",
  "amountdisbursed",
  "currentamount",
  "targetamount",
  "plannedamount",
  "email",
  "displayname",
  "description",
  "notes",
  "password",
  "token",
  "idtoken",
  "refreshtoken",
  "accesstoken",
  "authorization",
  "apikey",
  "credential",
]);

/**
 * A value shaped like Money, whatever it is called.
 *
 * Catches the case a key-based list cannot: someone passing `{ delta: {...} }`
 * or a nested object that happens to hold an amount.
 */
function looksLikeMoney(value: unknown): boolean {
  return typeof value === "object" && value !== null && "amount" in value && "currency" in value;
}

const REDACTED = "[omitido]";
const MAX_DEPTH = 4;
const MAX_STRING = 200;

export function scrub(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return REDACTED;

  if (looksLikeMoney(value)) return REDACTED;

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => scrub(entry, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = FORBIDDEN_KEYS.has(key.toLowerCase()) ? REDACTED : scrub(entry, depth + 1);
    }
    return result;
  }

  return REDACTED;
}

export interface LogContext {
  /** What was being attempted, e.g. "settleObligation". */
  readonly operation?: string;
  /** Firestore path or collection name, never a document's contents. */
  readonly path?: string;
  /** Error code, e.g. "permission-denied". */
  readonly code?: string;
  readonly [key: string]: unknown;
}

/**
 * Cloud Logging severity, from the level.
 *
 * O App Hosting roda sobre Cloud Run: o que a instância escreve em stdout já é
 * coletado. O que faltava não era o transporte, era a **forma**. Uma linha de
 * texto vira uma entrada sem severidade, e "taxa de erro" não é consultável
 * sobre texto solto — não dá para alertar sobre o que não dá para contar.
 *
 * Uma linha de JSON com `severity` vira entrada estruturada, e aí `severity >=
 * ERROR` é uma consulta, e uma consulta é um alerta.
 */
const SEVERITY: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
};

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (level === "debug" && process.env.NODE_ENV === "production") return;

  const payload = context ? (scrub(context) as Record<string, unknown>) : undefined;

  // `typeof window` separa servidor de navegador. O JSON estruturado só faz
  // sentido no servidor: é o stdout da instância que o Cloud Logging coleta.
  // No navegador não há stdout nenhum — `process.stdout` é `undefined` ali, e
  // escrever nele derrubaria a tela em produção.
  if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
    // Uma linha, um evento. Quebrar em várias linhas viraria várias entradas
    // soltas, e o contexto se perderia justamente no erro que interessa.
    //
    // O conteúdo continua passando por `scrub`: estruturar o log não afrouxa o
    // que ele pode carregar.
    process.stdout.write(
      `${JSON.stringify({
        severity: SEVERITY[level],
        message,
        service: "conta-comigo",
        ...(payload ? { context: payload } : {}),
      })}\n`,
    );
    return;
  }

  // Em desenvolvimento, legível para gente. JSON numa aba de terminal é pior
  // para quem está depurando, e ninguém alerta sobre a própria máquina.
  const prefix = "[conta-comigo]";

  switch (level) {
    case "error":
      console.error(prefix, message, payload ?? "");
      break;
    case "warn":
      console.warn(prefix, message, payload ?? "");
      break;
    case "debug":
      console.debug(prefix, message, payload ?? "");
      break;
    default:
      console.info(prefix, message, payload ?? "");
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};

/**
 * Turns an unknown thrown value into something safe to log.
 *
 * Error messages from Firebase carry codes and paths, which are useful; they
 * do not carry document contents. Anything else is reduced to its type.
 */
export function describeError(error: unknown): LogContext {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; name?: unknown; message?: unknown };
    return {
      ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
      ...(typeof candidate.name === "string" ? { name: candidate.name } : {}),
      ...(typeof candidate.message === "string"
        ? { message: candidate.message.slice(0, MAX_STRING) }
        : {}),
    };
  }
  return { type: typeof error };
}
