"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A dialog built on the native `<dialog>` element.
 *
 * Using the platform element rather than a div gives focus trapping, Escape to
 * close, inertness of the background and correct semantics for screen readers
 * without reimplementing any of it.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-card)] bg-[color:var(--card-bg)] p-0 text-[color:var(--page-fg)] backdrop:bg-black/40"
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="max-h-[85dvh] overflow-y-auto p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p
                id="modal-description"
                className="mt-1 text-sm"
                style={{ color: "var(--muted-fg)" }}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-2 shrink-0 rounded-lg p-2 text-xl leading-none"
            aria-label="Fechar"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
