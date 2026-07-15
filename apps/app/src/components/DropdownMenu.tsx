import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";

export const DropdownMenu = DropdownMenuPrimitive;

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Content
      ref={ref}
      align="end"
      sideOffset={6}
      onCloseAutoFocus={(event) => event.preventDefault()}
      className={clsx(
        "glass-panel z-[80] min-w-36 p-1.5 text-control transition-[opacity,transform] duration-200 data-[state=closed]:scale-95 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuSubContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      sideOffset={6}
      alignOffset={-6}
      className={clsx(
        "glass-panel z-[90] min-w-36 p-1.5 text-control transition-[opacity,transform] duration-200 data-[state=closed]:scale-95 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-reduce:transition-none",
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
      className={clsx(
        "flex h-9 cursor-default select-none items-center rounded-xl px-3 outline-none transition-colors duration-200 data-[disabled]:opacity-40 motion-reduce:transition-none",
        variant === "danger"
          ? "text-red-300 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-200"
          : "data-[highlighted]:bg-glass-hover data-[highlighted]:text-glass-strong",
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuSubTrigger = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>
>(function DropdownMenuSubTrigger({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={clsx(
        "flex h-9 cursor-default select-none items-center rounded-xl px-3 outline-none transition-colors duration-200 data-[highlighted]:bg-glass-hover data-[state=open]:bg-glass-hover data-[highlighted]:text-glass-strong data-[state=open]:text-glass-strong motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
});
