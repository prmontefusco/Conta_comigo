import { describe, expect, it } from "vitest";
import {
  calculateCooldownDaysRemaining,
  DEVICE_REGISTRATION_KEY,
  evaluateDeviceCooldown,
  generateClientFingerprint,
  getStoredDeviceRegistration,
  hashString,
  isDeviceInCooldown,
  persistDeviceRegistration,
  SIGNUP_COOLDOWN_MS,
  type DeviceRegistrationRecord,
} from "./device-fingerprint";

describe("device-fingerprint", () => {
  it("gera hashes determinísticos consistentes para o mesmo conteúdo", () => {
    const hash1 = hashString("1920x1080x24|America/Sao_Paulo|pt-BR|Win32|8");
    const hash2 = hashString("1920x1080x24|America/Sao_Paulo|pt-BR|Win32|8");
    const hash3 = hashString("1366x768x24|America/Sao_Paulo|pt-BR|Win32|4");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(typeof hash1).toBe("string");
    expect(hash1.length).toBeGreaterThanOrEqual(8);
  });

  it("identifica corretamente se o dispositivo está em período de bloqueio (cooldown)", () => {
    const now = 1700000000000;
    const recentSignup = now - 5 * 24 * 60 * 60 * 1000; // 5 dias atrás
    const oldSignup = now - 35 * 24 * 60 * 60 * 1000; // 35 dias atrás

    expect(isDeviceInCooldown(recentSignup, SIGNUP_COOLDOWN_MS, now)).toBe(true);
    expect(isDeviceInCooldown(oldSignup, SIGNUP_COOLDOWN_MS, now)).toBe(false);
    expect(isDeviceInCooldown(null, SIGNUP_COOLDOWN_MS, now)).toBe(false);
  });

  it("calcula dias restantes com arredondamento seguro para cima", () => {
    const now = 1700000000000;
    const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
    const fortyDaysAgo = now - 40 * 24 * 60 * 60 * 1000;

    expect(calculateCooldownDaysRemaining(tenDaysAgo, SIGNUP_COOLDOWN_MS, now)).toBe(20);
    expect(calculateCooldownDaysRemaining(fortyDaysAgo, SIGNUP_COOLDOWN_MS, now)).toBe(0);
  });

  it("avalia registro de dispositivo permitindo cadastro quando não há histórico", () => {
    const check = evaluateDeviceCooldown(null);
    expect(check.isAllowed).toBe(true);
    expect(check.daysRemaining).toBe(0);
  });

  it("avalia registro de dispositivo bloqueando quando cadastro é recente", () => {
    const now = Date.now();
    const record: DeviceRegistrationRecord = {
      deviceHash: "abc12345",
      lastSignupAt: now - 2 * 24 * 60 * 60 * 1000, // 2 dias atrás
      signupCount: 1,
    };

    const check = evaluateDeviceCooldown(record, now);
    expect(check.isAllowed).toBe(false);
    expect(check.daysRemaining).toBe(28);
    expect(check.message).toContain("Já existe uma conta cadastrada neste dispositivo");
  });

  it("retorna 'server_env' quando executado fora do navegador", () => {
    expect(generateClientFingerprint()).toBe("server_env");
    expect(getStoredDeviceRegistration()).toBeNull();
    expect(() => persistDeviceRegistration("any")).not.toThrow();
  });

  describe("browser environment", () => {
    it("gera fingerprint determinístico a partir de sinais públicos do dispositivo", () => {
      const fp1 = generateClientFingerprint({
        screen: "1920x1080x24",
        timezone: "America/Sao_Paulo",
        languages: "pt-BR,en-US",
        platform: "Win32",
        cores: 8,
      });

      const fp2 = generateClientFingerprint({
        screen: "1920x1080x24",
        timezone: "America/Sao_Paulo",
        languages: "pt-BR,en-US",
        platform: "Win32",
        cores: 8,
      });

      const fp3 = generateClientFingerprint({
        screen: "375x812x32",
        timezone: "America/Sao_Paulo",
        languages: "pt-BR",
        platform: "iPhone",
        cores: 6,
      });

      expect(typeof fp1).toBe("string");
      expect(fp1).toBe(fp2);
      expect(fp1).not.toBe(fp3);
    });

    it("armazena e recupera registro no localStorage e cookie", () => {
      const origWindow = globalThis.window;
      const origDoc = globalThis.document;

      const store: Record<string, string> = {};
      let cookieStore = "";

      globalThis.window = {
        localStorage: {
          getItem: (k: string) => store[k] ?? null,
          setItem: (k: string, v: string) => {
            store[k] = v;
          },
        },
      } as unknown as Window & typeof globalThis;
      globalThis.document = {
        get cookie() {
          return cookieStore;
        },
        set cookie(v: string) {
          cookieStore = v;
        },
      } as unknown as Document;

      persistDeviceRegistration("test_dev_hash", 1700000000000);
      const retrieved = getStoredDeviceRegistration();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.deviceHash).toBe("test_dev_hash");
      expect(retrieved?.lastSignupAt).toBe(1700000000000);
      expect(retrieved?.signupCount).toBe(1);

      // Fallback para cookie quando localStorage está vazio
      delete store[DEVICE_REGISTRATION_KEY];
      const fromCookie = getStoredDeviceRegistration();
      expect(fromCookie?.deviceHash).toBe("test_dev_hash");

      globalThis.window = origWindow;
      globalThis.document = origDoc;
    });
  });
});
