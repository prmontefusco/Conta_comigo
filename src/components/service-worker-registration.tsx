"use client";

import { useEffect } from "react";

/**
 * Registra o service worker, e só em produção.
 *
 * Em desenvolvimento um service worker serve assets antigos e confunde
 * qualquer depuração de UI — o bug que você acabou de corrigir continua na
 * tela. O ganho dele (instalar na tela inicial, abrir rápido em rede ruim)
 * só existe para quem usa o aplicativo de verdade.
 *
 * Falhar aqui não pode quebrar nada: navegador sem suporte, contexto não
 * seguro ou usuário com armazenamento bloqueado apenas não ganham o cache.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    // Depois do load: registrar durante o carregamento disputa banda com o
    // conteúdo, justamente nas conexões em que ele deveria ajudar.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
