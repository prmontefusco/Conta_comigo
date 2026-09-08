/**
 * Identificação anônima e controle de frequência de cadastros por dispositivo.
 *
 * Previne que o mesmo usuário crie múltiplas contas em sequência ou gere
 * uma nova conta todo mês para usufruir de períodos de teste gratuitos.
 */

export const DEVICE_REGISTRATION_KEY = "conta_comigo_device_reg";
export const REGISTRATION_COOKIE_NAME = "cc_dev_id";

/** Cooldown padrão de 30 dias entre cadastros no mesmo dispositivo (em milissegundos). */
export const SIGNUP_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface DeviceRegistrationRecord {
  readonly deviceHash: string;
  readonly lastSignupAt: number;
  readonly signupCount: number;
}

export interface DeviceCooldownCheck {
  readonly isAllowed: boolean;
  readonly daysRemaining: number;
  readonly lastSignupDate: Date | null;
  readonly message?: string;
}

/**
 * Verifica se um timestamp anterior ainda está dentro do período de bloqueio.
 */
export function isDeviceInCooldown(
  lastSignupAt: number | undefined | null,
  cooldownMs: number = SIGNUP_COOLDOWN_MS,
  now: number = Date.now(),
): boolean {
  if (!lastSignupAt || !Number.isFinite(lastSignupAt)) return false;
  return now - lastSignupAt < cooldownMs;
}

/**
 * Calcula os dias restantes do período de espera.
 */
export function calculateCooldownDaysRemaining(
  lastSignupAt: number | undefined | null,
  cooldownMs: number = SIGNUP_COOLDOWN_MS,
  now: number = Date.now(),
): number {
  if (!lastSignupAt || !Number.isFinite(lastSignupAt)) return 0;
  const elapsed = now - lastSignupAt;
  if (elapsed >= cooldownMs) return 0;
  return Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
}

/**
 * Avalia o status de cadastro do dispositivo.
 */
export function evaluateDeviceCooldown(
  record: DeviceRegistrationRecord | null,
  now: number = Date.now(),
): DeviceCooldownCheck {
  if (!record || !record.lastSignupAt) {
    return {
      isAllowed: true,
      daysRemaining: 0,
      lastSignupDate: null,
    };
  }

  const inCooldown = isDeviceInCooldown(record.lastSignupAt, SIGNUP_COOLDOWN_MS, now);
  const daysRemaining = calculateCooldownDaysRemaining(record.lastSignupAt, SIGNUP_COOLDOWN_MS, now);

  if (inCooldown) {
    return {
      isAllowed: false,
      daysRemaining,
      lastSignupDate: new Date(record.lastSignupAt),
      message: `Já existe uma conta cadastrada neste dispositivo recentemente. Para acessar seus dados, entre com sua conta existente ou recupere sua senha.`,
    };
  }

  return {
    isAllowed: true,
    daysRemaining: 0,
    lastSignupDate: new Date(record.lastSignupAt),
  };
}

export interface ClientFingerprintSignals {
  screen?: string;
  timezone?: string;
  languages?: string;
  platform?: string;
  cores?: number;
}

/**
 * Gera um hash determinístico simples e anônimo a partir de características públicas do navegador.
 * Seguro e sem rastrear dados pessoais (LGPD).
 */
export function generateClientFingerprint(signals?: ClientFingerprintSignals): string {
  if (signals) {
    const rawString = `${signals.screen ?? "noscreen"}|${signals.timezone ?? "unknown_tz"}|${signals.languages ?? "unknown_lang"}|${signals.platform ?? "unknown_plat"}|${signals.cores ?? 0}`;
    return hashString(rawString);
  }

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "server_env";
  }

  const screenData = typeof window.screen !== "undefined"
    ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
    : "noscreen";

  const timezone = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone ?? "unknown_tz";
  const languages = navigator.languages?.join(",") ?? navigator.language ?? "unknown_lang";
  const platform = navigator.platform ?? "unknown_plat";
  const cores = navigator.hardwareConcurrency ?? 0;

  const rawString = `${screenData}|${timezone}|${languages}|${platform}|${cores}`;
  return hashString(rawString);
}

/**
 * Função de hash determinística (djb2).
 */
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Lê o registro do dispositivo gravado no navegador (localStorage e fallback de cookie).
 */
export function getStoredDeviceRegistration(): DeviceRegistrationRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(DEVICE_REGISTRATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeviceRegistrationRecord;
      if (parsed && typeof parsed.lastSignupAt === "number") {
        return parsed;
      }
    }
  } catch {
    // Fallback silencioso
  }

  // Fallback para cookie
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${REGISTRATION_COOKIE_NAME}=`));
    if (match) {
      const cookieVal = match.split("=")[1];
      if (cookieVal) {
        const decoded = JSON.parse(decodeURIComponent(cookieVal)) as DeviceRegistrationRecord;
        if (decoded && typeof decoded.lastSignupAt === "number") {
          return decoded;
        }
      }
    }
  } catch {
    // Fallback silencioso
  }

  return null;
}

/**
 * Grava o registro de cadastro do dispositivo no navegador com persistência estendida.
 */
export function persistDeviceRegistration(deviceHash: string, now: number = Date.now()): void {
  if (typeof window === "undefined") return;

  const existing = getStoredDeviceRegistration();
  const nextRecord: DeviceRegistrationRecord = {
    deviceHash,
    lastSignupAt: now,
    signupCount: (existing?.signupCount ?? 0) + 1,
  };

  try {
    window.localStorage.setItem(DEVICE_REGISTRATION_KEY, JSON.stringify(nextRecord));
  } catch {
    // LocalStorage indisponível
  }

  try {
    // Grava cookie seguro com validade de 90 dias
    const maxAge = 90 * 24 * 60 * 60;
    document.cookie = `${REGISTRATION_COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify(nextRecord),
    )}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch {
    // Cookie indisponível
  }
}
