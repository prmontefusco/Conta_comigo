"use client";

import Image from "next/image";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Badge, Button, Card, CardTitle } from "@/components/ui/primitives";

/**
 * Modal explicativo com o passo a passo para instalação no iOS Safari.
 * Como a Apple não expõe o evento nativo de instalação, o usuário precisa
 * ser guiado a usar o menu "Compartilhar > Adicionar à Tela de Início".
 */
export function IOSInstallGuideModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-guide-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-xs sm:items-center"
    >
      <div className="animate-in fade-in zoom-in-95 w-full max-w-md rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl shadow-xs">
              <Image src="/icon-192.png" alt="Conta comigo" fill className="object-cover" />
            </div>
            <div>
              <h3 id="ios-guide-title" className="font-semibold text-[color:var(--page-fg)]">
                Instalar no iPhone ou iPad
              </h3>
              <p className="text-xs text-[color:var(--muted-fg)]">
                Passo a passo rápido pelo Safari
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 items-center justify-center rounded-lg text-lg text-[color:var(--muted-fg)] hover:bg-[color:var(--color-ink-100)]"
          >
            ✕
          </button>
        </div>

        <ol className="mt-5 space-y-4 text-sm text-[color:var(--page-fg)]">
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-xs font-bold text-[color:var(--color-brand-700)]">
              1
            </span>
            <span>
              Toque no botão de <strong>Compartilhar</strong> na barra inferior do Safari (ícone de
              um quadrado com uma seta para cima{" "}
              <span className="inline-block font-mono text-base font-bold" aria-hidden="true">
                ⬆
              </span>
              ).
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-xs font-bold text-[color:var(--color-brand-700)]">
              2
            </span>
            <span>
              Role o menu para baixo e toque em{" "}
              <strong>&quot;Adicionar à Tela de Início&quot;</strong> (ícone com um sinal de mais{" "}
              <span className="inline-block font-mono text-base font-bold" aria-hidden="true">
                +
              </span>
              ).
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-xs font-bold text-[color:var(--color-brand-700)]">
              3
            </span>
            <span>
              No canto superior direito, toque em <strong>&quot;Adicionar&quot;</strong>. Pronto! O
              ícone do Conta Comigo estará na sua tela inicial.
            </span>
          </li>
        </ol>

        <div className="mt-6">
          <Button variant="primary" className="w-full" onClick={onClose}>
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Banner discreto exibido no rodapé para convidar o usuário a instalar o app.
 */
export function PWAInstallPrompt() {
  const { canInstall, isDismissed, showIOSGuide, promptInstall, dismissPrompt, closeIOSGuide } =
    usePWAInstall();

  return (
    <>
      <IOSInstallGuideModal isOpen={showIOSGuide} onClose={closeIOSGuide} />

      {canInstall && !isDismissed ? (
        <aside
          aria-label="Instalação do aplicativo"
          className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-lg rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)]/98 p-4 shadow-xl backdrop-blur-md transition-all duration-300 md:right-6 md:bottom-6 md:left-auto md:w-96"
        >
          <div className="flex items-start gap-3">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-xl shadow-xs">
              <Image src="/icon-192.png" alt="Conta comigo" fill className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-[color:var(--page-fg)]">
                  Instalar Conta Comigo
                </p>
                <Badge tone="brand">App</Badge>
              </div>
              <p className="mt-0.5 text-xs text-[color:var(--muted-fg)]">
                Acesse mais rápido direto da sua tela inicial, com abertura instantânea e tela
                cheia.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="primary"
                  className="h-9 min-h-9 px-3 text-xs"
                  onClick={() => void promptInstall()}
                >
                  Instalar agora
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 min-h-9 px-3 text-xs text-[color:var(--muted-fg)]"
                  onClick={dismissPrompt}
                >
                  Agora não
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPrompt}
              aria-label="Dispensar aviso de instalação"
              className="text-[color:var(--muted-fg)] hover:text-[color:var(--page-fg)]"
            >
              ✕
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
}

/**
 * Card de controle do aplicativo instalado, adequado para a página de Configurações e Mais.
 */
export function PWAInstallCard() {
  const { isInstalled, canInstall, showIOSGuide, promptInstall, closeIOSGuide } = usePWAInstall();

  return (
    <>
      <IOSInstallGuideModal isOpen={showIOSGuide} onClose={closeIOSGuide} />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Aplicativo Conta Comigo</CardTitle>
          </div>
          {isInstalled ? (
            <Badge tone="positive">✓ Instalado</Badge>
          ) : (
            <Badge tone="brand">Disponível para instalar</Badge>
          )}
        </div>

        {isInstalled ? (
          <p className="text-sm text-[color:var(--muted-fg)]">
            O aplicativo já está instalado no seu dispositivo e rodando em modo dedicado (tela
            cheia). Atualizações são sincronizadas automaticamente a cada abertura.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[color:var(--muted-fg)]">
              Instale o Conta Comigo no seu celular, tablet ou computador para abrir direto da tela
              de início, sem barras do navegador e com inicialização imediata.
            </p>
            <div>
              <Button
                variant="primary"
                onClick={() => void promptInstall()}
                disabled={!canInstall}
                className="gap-2"
              >
                <span>📲</span>
                <span>Instalar aplicativo neste aparelho</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
