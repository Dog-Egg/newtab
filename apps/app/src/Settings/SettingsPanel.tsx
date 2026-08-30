import { lazy, Suspense } from "react";

const Settings = lazy(() =>
  import("./index").then(({ Settings }) => ({
    default: Settings,
  })),
);

function SettingsSkeleton() {
  return (
    <div className="flex h-full animate-pulse" aria-hidden="true">
      <div className="w-16 shrink-0 space-y-3 border-r border-white/10 px-2 py-5">
        <div className="h-10 rounded-xl bg-white/10" />
        <div className="h-10 rounded-xl bg-white/10" />
      </div>
      <div className="min-w-0 flex-1 space-y-4 px-4 py-6 sm:px-6">
        {["h-24", "h-28", "h-48"].map((height) => (
          <div
            key={height}
            className={`${height} w-full rounded-2xl bg-white/10`}
          />
        ))}
      </div>
    </div>
  );
}

export function SettingsPanel() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Settings />
    </Suspense>
  );
}
