import type { ReactNode, Ref } from "react";

export function SettingsScrollArea({
  children,
  ref,
}: {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6"
    >
      {children}
    </div>
  );
}
