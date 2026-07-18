import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Drawer({
  isOpen,
  title,
  titleId,
  closeLabel,
  onClose,
  children,
}: {
  isOpen: boolean;
  title: ReactNode;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className="relative z-[110] shrink-0 transition-[width] duration-300 ease-out motion-reduce:transition-none"
      style={{ width: isOpen ? "min(100vw, 26rem)" : 0 }}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <aside
        data-drawer=""
        className={`glass-panel settings-panel absolute inset-y-0 right-0 flex w-[min(100vw,26rem)] flex-col overflow-hidden rounded-none transition-transform duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-border px-5 py-4">
          <h2
            id={titleId}
            className="text-base font-semibold text-glass-strong"
          >
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            className="grid size-9 place-items-center rounded-full text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </aside>
    </div>
  );
}
