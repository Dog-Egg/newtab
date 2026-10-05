import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import clsx from "clsx";
import { menuItemClassName, menuPopupClassName } from "./menuStyles";

export const Menu = BaseMenu;

type MenuPopupProps = ComponentPropsWithoutRef<typeof BaseMenu.Popup> & {
  positionerZIndex?: number;
};

export const MenuPopup = forwardRef<HTMLDivElement, MenuPopupProps>(
  function MenuPopup({ className, positionerZIndex = 80, ...props }, ref) {
    return (
      <BaseMenu.Positioner
        align="start"
        sideOffset={6}
        style={{ zIndex: positionerZIndex }}
      >
        <BaseMenu.Popup
          ref={ref}
          finalFocus={false}
          className={clsx(
            menuPopupClassName,
            "origin-[var(--transform-origin)]",
            className,
          )}
          {...props}
        />
      </BaseMenu.Positioner>
    );
  },
);

type MenuItemProps = ComponentPropsWithoutRef<typeof BaseMenu.Item> & {
  variant?: "default" | "danger";
};

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  function MenuItem({ className, variant = "default", ...props }, ref) {
    return (
      <BaseMenu.Item
        ref={ref}
        className={clsx(menuItemClassName(variant), className)}
        {...props}
      />
    );
  },
);
