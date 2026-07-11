import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import clsx from "clsx";

const DIALOG_ANIMATION_MS = 160;

export const DialogClose = RadixDialog.Close;
export const DialogTitle = RadixDialog.Title;

export function Dialog({
  children,
  className = "",
  contentRef,
  isClosing = false,
  onClose,
  onInteractOutside,
}: {
  children: ReactNode;
  className?: string;
  contentRef?: Ref<HTMLDivElement>;
  isClosing?: boolean;
  onClose: () => void;
  onInteractOutside?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const onCloseRef = useRef(onClose);
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );

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

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={
            "fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-md data-[state=closed]:animate-dialog-overlay-out data-[state=open]:animate-dialog-overlay-in"
          }
        />
        <RadixDialog.Content
          ref={contentRef}
          className={clsx(
            "fixed left-1/2 top-1/2 z-[60] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain border border-white/45 bg-white/30 text-white shadow-2xl outline-none backdrop-blur-xl data-[state=closed]:animate-dialog-content-out data-[state=open]:animate-dialog-content-in",
            className,
          )}
          onInteractOutside={onInteractOutside}
        >
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
