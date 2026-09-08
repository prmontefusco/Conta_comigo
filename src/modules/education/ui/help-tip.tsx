"use client";

import { useEffect, useId, useRef, useState } from "react";
import { glossaryTerm, type GlossaryTermId } from "@/modules/education/domain/glossary";

/**
 * O "?" ao lado de um número ou de um campo.
 *
 * ## Por que não é um tooltip
 *
 * Tooltip abre no `hover`, e `hover` não existe no celular — que é onde este
 * produto é mais usado. Um `title=""` teria o mesmo defeito e ainda seria
 * invisível para quem navega por teclado.
 *
 * Isto é um **disclosure**: um botão que mostra e esconde um trecho de texto.
 * O padrão custa o mesmo, funciona no toque, no teclado e no leitor de tela, e
 * não precisa de armadilha de foco — que é o que costuma quebrar quando se
 * tenta transformar um balãozinho em diálogo.
 *
 * ## O que o balão diz
 *
 * Duas coisas, sempre, porque a segunda é a que falta em quase toda ajuda de
 * aplicativo financeiro: **o que é** e **no que isso mexe**. Saber que CET
 * significa Custo Efetivo Total não destrava ninguém; saber que deixá-lo em
 * branco não atrapalha o cálculo, sim. O texto vem do glossário, para o mesmo
 * termo não ser explicado de dois jeitos em duas telas.
 */
export function HelpTip({
  term,
  label,
}: {
  readonly term: GlossaryTermId;
  /**
   * Sobrescreve o nome anunciado no botão.
   *
   * Serve para quando o rótulo da tela difere do verbete — "Saldo na data de"
   * num formulário, por exemplo. O que o leitor de tela anuncia deve ser o que
   * está escrito ao lado, não o nome interno do termo.
   */
  readonly label?: string;
}) {
  const entry = glossaryTerm(term);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const name = label ?? entry.term;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Devolve o foco a quem abriu. Sem isto, quem usa teclado é jogado para
      // o início do documento e perde o lugar no formulário.
      buttonRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span className="relative inline-flex align-middle" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`O que é ${name}`}
        className="flex size-6 items-center justify-center rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] text-xs font-bold text-[color:var(--color-brand-700)] transition hover:bg-[color:var(--color-brand-50)]"
      >
        <span aria-hidden="true">?</span>
      </button>

      {/*
        O balão fica sempre no documento e some quando fechado, em vez de ser
        montado só ao abrir: `aria-controls` precisa apontar para um id que
        exista, e um id ausente é violação de `aria-valid-attr-value` — regra
        que a auditoria roda contra trinta páginas a cada execução.
        
        O atributo `hidden` sozinho não bastaria. Ele vale por uma regra da
        folha do navegador, e qualquer classe de display do Tailwind tem
        precedência sobre ela: com `block` fixo aqui, o balão ficaria aberto
        para sempre. Por isso o display também é alternado por classe, e o
        atributo permanece pelo significado que ele carrega.
      */}
      <span
        hidden={!open}
        id={panelId}
        role="note"
        className={`absolute top-7 left-0 z-30 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3 text-left shadow-lg ${
          open ? "block" : "hidden"
        }`}
      >
        <span className="block text-sm font-semibold text-[color:var(--page-fg)]">
          {entry.term}
        </span>
        <span className="mt-1 block text-xs text-[color:var(--page-fg)]">{entry.what}</span>
        <span
          className="mt-2 block border-t border-[color:var(--card-border)] pt-2 text-xs"
          style={{ color: "var(--muted-fg)" }}
        >
          <span className="font-semibold">No que isso mexe: </span>
          {entry.impact}
        </span>
      </span>
    </span>
  );
}
