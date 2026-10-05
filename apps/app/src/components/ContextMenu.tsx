import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import clsx from "clsx";
import { menuContentClassName, menuItemClassName } from "./menuStyles";

export const ContextMenu = ContextMenuPrimitive;

export const ContextMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(function ContextMenuContent({ className, ...props }, ref) {
  return (
    <ContextMenuPrimitive.Content
      ref={ref}
      onCloseAutoFocus={(event) => event.preventDefault()}
      className={clsx(
        menuContentClassName,
        "origin-[var(--radix-context-menu-content-transform-origin)]",
        className,
      )}
      {...props}
    />
  );
});

type ContextMenuItemProps = ComponentPropsWithoutRef<
  typeof ContextMenuPrimitive.Item
> & {
  variant?: "default" | "danger";
};

export const ContextMenuItem = forwardRef<HTMLDivElement, ContextMenuItemProps>(
  function ContextMenuItem({ className, variant = "default", ...props }, ref) {
    return (
      <ContextMenuPrimitive.Item
        ref={ref}
        className={clsx(menuItemClassName(variant), className)}
        {...props}
      />
    );
  },
);
