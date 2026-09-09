import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { usePWAInstall } from "./use-pwa-install";

describe("usePWAInstall hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("inicia com canInstall falso se não houver evento e não for iOS", () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.canInstall).toBe(false);
  });

  it("captura beforeinstallprompt e ativa canInstall", () => {
    const { result } = renderHook(() => usePWAInstall());

    const promptEvent = new Event("beforeinstallprompt") as any;
    promptEvent.prompt = vi.fn().mockResolvedValue(undefined);
    promptEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

    act(() => {
      window.dispatchEvent(promptEvent);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it("executa promptInstall e atualiza status ao aceitar", async () => {
    const { result } = renderHook(() => usePWAInstall());

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const promptEvent = new Event("beforeinstallprompt") as any;
    promptEvent.prompt = promptMock;
    promptEvent.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

    act(() => {
      window.dispatchEvent(promptEvent);
    });

    let installResult;
    await act(async () => {
      installResult = await result.current.promptInstall();
    });

    expect(promptMock).toHaveBeenCalled();
    expect(installResult).toEqual({ outcome: "accepted" });
    expect(result.current.isInstalled).toBe(true);
  });

  it("permite dispensar o aviso e salva no localStorage", () => {
    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.isDismissed).toBe(true);
    expect(localStorage.getItem("conta_comigo_pwa_dismissed_at")).toBeTruthy();
  });
});
