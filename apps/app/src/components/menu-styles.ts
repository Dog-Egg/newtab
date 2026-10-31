import clsx from "clsx";

export const menuPopupClassName =
  "glass-panel min-w-36 p-1.5 text-control transition-[opacity,transform] duration-200 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 motion-reduce:transition-none";

export function menuItemClassName(variant: "default" | "danger") {
  return clsx(
    "flex h-9 cursor-default select-none items-center rounded-xl px-3 outline-none transition-colors duration-200 data-[disabled]:opacity-40 motion-reduce:transition-none",
    variant === "danger"
      ? "text-red-300 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-200"
      : "data-[highlighted]:bg-glass-hover data-[highlighted]:text-glass-strong",
  );
}
