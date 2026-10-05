import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useState, type ReactNode } from "react";
import clsx from "clsx";

const MAIN_DIALOG_PORTAL_ID = "main-dialog-portal";

export const DialogTitle = BaseDialog.Title;
export const DialogClose = BaseDialog.Close;

export function MainDialogPortal() {
  return (
    <div
      id={MAIN_DIALOG_PORTAL_ID}
      className="pointer-events-none absolute inset-0 z-[60]"
    />
  );
}

export function Dialog({
  children,
  className = "",
  onClose,
}: {
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
  onClose: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const close = () => setIsOpen(false);
  const content = typeof children === "function" ? children(close) : children;

  return (
    <BaseDialog.Root
      modal={false}
      open={isOpen}
      onOpenChange={(open, eventDetails) => {
        const target = eventDetails.event.target;
        if (
          !open &&
          target instanceof Element &&
          target.closest("[data-drawer]")
        ) {
          eventDetails.cancel();
          return;
        }

        setIsOpen(open);
      }}
      onOpenChangeComplete={(open) => {
        if (!open) onClose();
      }}
    >
      <BaseDialog.Portal
        container={document.getElementById(MAIN_DIALOG_PORTAL_ID)}
      >
        <BaseDialog.Backdrop
          className="pointer-events-auto absolute inset-0 animate-dialog-overlay-in bg-slate-950/40 backdrop-blur-md data-[ending-style]:animate-dialog-overlay-out motion-reduce:!animate-none"
          aria-hidden="true"
        />
        <BaseDialog.Popup
          className={clsx(
            "pointer-events-auto absolute left-1/2 top-1/2 z-10 max-h-[calc(100%-3rem)] w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 animate-dialog-content-in overflow-y-auto rounded-glass border border-glass-border bg-white/30 text-glass-strong shadow-glass outline-none backdrop-blur-2xl focus-visible:ring-2 focus-visible:ring-glass-focus data-[ending-style]:animate-dialog-content-out motion-reduce:!animate-none",
            className,
          )}
        >
          {content}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
