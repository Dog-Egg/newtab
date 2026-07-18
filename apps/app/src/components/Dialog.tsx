import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import clsx from "clsx";

const DIALOG_ANIMATION_MS = 160;
const MAIN_DIALOG_PORTAL_ID = "main-dialog-portal";

export const DialogClose = RadixDialog.Close;
export const DialogTitle = RadixDialog.Title;

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
  contentRef,
  isClosing = false,
  onClose,
  onInteractOutside,
}: {
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
  contentRef?: Ref<HTMLDivElement>;
  isClosing?: boolean;
  onClose: () => void;
  onInteractOutside?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const onCloseRef = useRef(onClose);
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setPortalContainer(document.getElementById(MAIN_DIALOG_PORTAL_ID));
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isClosing) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      setIsOpen(true);
      return;
    }

    setIsOpen(false);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(
      () => onCloseRef.current(),
      DIALOG_ANIMATION_MS,
    );

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isClosing]);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);

    if (!open) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }

      closeTimerRef.current = window.setTimeout(
        () => onCloseRef.current(),
        DIALOG_ANIMATION_MS,
      );
    }
  }

  const content =
    typeof children === "function"
      ? children(() => handleOpenChange(false))
      : children;

  return (
    <RadixDialog.Root
      modal={false}
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      {portalContainer ? (
        <RadixDialog.Portal container={portalContainer}>
          <div
            className={clsx(
              "pointer-events-auto absolute inset-0 bg-slate-950/40 backdrop-blur-md motion-reduce:animate-none",
              isOpen
                ? "animate-dialog-overlay-in"
                : "animate-dialog-overlay-out",
            )}
            aria-hidden="true"
          />
          <RadixDialog.Content
            ref={contentRef}
            className={clsx(
              "pointer-events-auto absolute left-1/2 top-1/2 z-10 max-h-[calc(100%-3rem)] w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-glass border border-glass-border bg-white/30 text-glass-strong shadow-glass outline-none backdrop-blur-2xl focus-visible:ring-2 focus-visible:ring-glass-focus data-[state=closed]:animate-dialog-content-out data-[state=open]:animate-dialog-content-in motion-reduce:animate-none",
              className,
            )}
            onInteractOutside={(event) => {
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest("[data-drawer]")
              ) {
                event.preventDefault();
                return;
              }

              onInteractOutside?.();
            }}
          >
            {content}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      ) : null}
    </RadixDialog.Root>
  );
}
