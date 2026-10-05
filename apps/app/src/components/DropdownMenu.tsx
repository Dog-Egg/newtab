import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { menuContentClassName, menuItemClassName } from "./menuStyles";

export const DropdownMenu = DropdownMenuPrimitive;

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Content
      ref={ref}
      align="start"
      sideOffset={6}
      onCloseAutoFocus={(event) => event.preventDefault()}
      className={clsx(
        menuContentClassName,
        "origin-[var(--radix-dropdown-menu-content-transform-origin)]",
        className,
      )}
      {...props}
    />
  );
});

type DropdownMenuItemProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
> & {
  variant?: "default" | "danger";
};

export const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  DropdownMenuItemProps
>(function DropdownMenuItem({ className, variant = "default", ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={clsx(menuItemClassName(variant), className)}
      {...props}
    />
  );
});
