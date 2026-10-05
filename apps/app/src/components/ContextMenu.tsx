import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import clsx from "clsx";
import { menuItemClassName, menuPopupClassName } from "./menuStyles";

export const ContextMenu = BaseContextMenu;

export const ContextMenuPopup = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Popup>
>(function ContextMenuPopup({ className, ...props }, ref) {
  return (
    <BaseContextMenu.Positioner style={{ zIndex: 80 }}>
      <BaseContextMenu.Popup
        ref={ref}
        finalFocus={false}
        className={clsx(
          menuPopupClassName,
          "origin-[var(--transform-origin)]",
          className,
        )}
        {...props}
      />
    </BaseContextMenu.Positioner>
  );
});

type ContextMenuItemProps = ComponentPropsWithoutRef<
  typeof BaseContextMenu.Item
> & {
  variant?: "default" | "danger";
};

export const ContextMenuItem = forwardRef<HTMLDivElement, ContextMenuItemProps>(
  function ContextMenuItem({ className, variant = "default", ...props }, ref) {
    return (
      <BaseContextMenu.Item
        ref={ref}
        className={clsx(menuItemClassName(variant), className)}
        {...props}
      />
    );
  },
);
