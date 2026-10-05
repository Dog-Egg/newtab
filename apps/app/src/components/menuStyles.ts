import clsx from "clsx";

export const menuContentClassName =
  "glass-panel z-[80] min-w-36 p-1.5 text-control transition-[opacity,transform] duration-200 data-[state=closed]:scale-95 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-reduce:transition-none";

export function menuItemClassName(variant: "default" | "danger") {
  return clsx(
    "flex h-9 cursor-default select-none items-center rounded-xl px-3 outline-none transition-colors duration-200 data-[disabled]:opacity-40 motion-reduce:transition-none",
    variant === "danger"
      ? "text-red-300 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-200"
      : "data-[highlighted]:bg-glass-hover data-[highlighted]:text-glass-strong",
  );
}
