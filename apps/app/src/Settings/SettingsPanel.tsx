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
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6">
        <div className="divide-y divide-white/10">
          <div className="pb-5 sm:pb-6">
            <div className="h-4 w-20 rounded bg-white/10" />
            <div className="mt-3 h-10 w-full rounded-xl bg-white/10" />
          </div>
          <div className="py-5 sm:py-6">
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="mt-5 h-2 w-full rounded bg-white/10" />
          </div>
          <div className="py-5 sm:py-6">
            <div className="h-4 w-28 rounded bg-white/10" />
            <div className="mt-4 h-9 w-full rounded-lg bg-white/10" />
            <div className="mt-5 h-2 w-full rounded bg-white/10" />
          </div>
        </div>
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
