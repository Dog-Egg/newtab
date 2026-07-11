import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import clsx from "clsx";
import { Settings } from "lucide-react";
import { platform } from "@platform";
import { Launcher } from "./Launcher";
import { SearchEngineBox } from "./SearchEngineBox";
import { Wallpaper } from "./Wallpaper";
import { SettingsPanel } from "./Settings";
import { MainDialogPortal } from "./components/Dialog";
import {
  LauncherSettingsProvider,
  normalizeLauncherSettings,
  type LauncherSettings,
} from "./launcherSettings";

export function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [launcherSettings, setLauncherSettings] = useState<LauncherSettings>(
    () => normalizeLauncherSettings(undefined),
  );

  useEffect(() => {
    let isCurrent = true;
    void platform.wallpaper.read().then((value) => {
      if (isCurrent) setWallpaperUrl(value);
    });
    const unsubscribe = platform.wallpaper.subscribe(setWallpaperUrl);
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    void platform.launcherSettings.read().then((settings) => {
      if (isCurrent) setLauncherSettings(settings);
    });
    const unsubscribe =
      platform.launcherSettings.subscribe(setLauncherSettings);
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  const saveWallpaper = useCallback((value: string | null) => {
    setWallpaperUrl(value);
    void platform.wallpaper.save(value);
  }, []);

  const saveLauncherSettings = useCallback((settings: LauncherSettings) => {
    const normalizedSettings = normalizeLauncherSettings(settings);
    setLauncherSettings(normalizedSettings);
    void platform.launcherSettings.save(normalizedSettings);
  }, []);

  return (
    <div className="relative flex min-h-screen min-w-80 overflow-hidden font-sans text-white">
      <main className="relative min-h-screen min-w-0 flex-1 overflow-hidden">
        <Wallpaper wallpaperUrl={wallpaperUrl} />

        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "border-white/15 bg-slate-950/90 text-white shadow-2xl backdrop-blur",
              title: "font-bold",
              description: "text-white/70",
            },
          }}
        />

        {/* settings button */}
        <button
          className={clsx(
            "absolute right-4 top-4 z-50 grid size-11 place-items-center rounded-full border border-white/35 bg-slate-950/35 text-white shadow-xl outline-none backdrop-blur-md transition-opacity hover:bg-slate-950/45 focus-visible:ring-4 focus-visible:ring-white/70 sm:right-8 sm:top-6",
            isSettingsOpen && "opacity-0",
          )}
          type="button"
          onClick={() => setIsSettingsOpen((isOpen) => !isOpen)}
          aria-label="打开设置"
          aria-expanded={isSettingsOpen}
        >
          <Settings aria-hidden="true" className="size-5" />
        </button>

        <LauncherSettingsProvider settings={launcherSettings}>
          <div className="flex flex-col pt-16 sm:pt-48">
            <div className="relative z-20 px-6 sm:px-10">
              <SearchEngineBox />
            </div>
            <Launcher />
          </div>
        </LauncherSettingsProvider>

        <MainDialogPortal />
      </main>

      <SettingsPanel
        isOpen={isSettingsOpen}
        selectedWallpaperUrl={wallpaperUrl}
        launcherSettings={launcherSettings}
        onClose={() => setIsSettingsOpen(false)}
        onSelectWallpaper={saveWallpaper}
        onClearWallpaper={() => saveWallpaper(null)}
        onChangeLauncherSettings={saveLauncherSettings}
      />
    </div>
  );
}
