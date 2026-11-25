import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";

type IconButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "aria-label" | "type"
> & { label: string };

export function IconButton({
  label,
  children,
  className,
  title = label,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      title={title}
      className={clsx(
        "grid size-11 place-items-center rounded-full text-white/80 outline-none transition-[color,opacity] focus-visible:ring-2 focus-visible:ring-white/70 enabled:hover:text-white disabled:opacity-60 motion-reduce:transition-none",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-5 place-items-center [&>svg]:size-full"
      >
        {children}
      </span>
    </button>
  );
}
