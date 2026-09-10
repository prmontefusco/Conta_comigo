"use client";

import { useEffect, useState, useCallback } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISSED_STORAGE_KEY = "conta_comigo_pwa_dismissed_at";
const DISMISS_DURATION_DAYS = 14;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detecta se já está rodando em modo standalone (app instalado)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detecta se é iOS Safari
    const ua = window.navigator.userAgent;
    const isIosDevice =
      /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIosDevice);

    // Verifica se o usuário dispensou o aviso recentemente
    try {
      const dismissedAt = localStorage.getItem(DISMISSED_STORAGE_KEY);
      if (dismissedAt) {
        const diffDays = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
        setIsDismissed(diffDays < DISMISS_DURATION_DAYS);
      } else {
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }

    // Captura o evento nativo de instalação do navegador (Chrome, Edge, Samsung Internet, Android)
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    // Atualiza quando o usuário conclui a instalação com sucesso
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (isInstalled) return { outcome: "already_installed" as const };

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
      return { outcome: choice.outcome };
    }

    if (isIOS) {
      setShowIOSGuide(true);
      return { outcome: "ios_guide" as const };
    }

    return { outcome: "unsupported" as const };
  }, [deferredPrompt, isInstalled, isIOS]);

  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, Date.now().toString());
    } catch {
      // Ignora erro de acesso ao storage
    }
  }, []);

  const closeIOSGuide = useCallback(() => {
    setShowIOSGuide(false);
  }, []);

  // Pode instalar se não estiver instalado e (temos o prompt nativo OU é dispositivo iOS)
  const canInstall = !isInstalled && (!!deferredPrompt || isIOS);

  return {
    canInstall,
    isInstalled,
    isIOS,
    isDismissed,
    showIOSGuide,
    promptInstall,
    dismissPrompt,
    closeIOSGuide,
  };
}
