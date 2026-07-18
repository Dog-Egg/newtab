import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import clsx from "clsx";
import { Settings } from "lucide-react";
import { Launcher } from "./Launcher";
import { SearchEngineBox } from "./SearchEngineBox";
import { Wallpaper } from "./Wallpaper";
import { SettingsPanel } from "./Settings";
import { MainDialogPortal } from "./components/Dialog";
import { useSettings } from "./Settings/SettingsProvider";
import { useTranslation } from "react-i18next";

export function App() {
  const { t, i18n } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const { settings } = useSettings();

  useEffect(() => {
    document.title = t("app.title");
  }, [i18n.resolvedLanguage, t]);

  const closeSettings = useCallback(() => {
    settingsButtonRef.current?.focus();
    setIsSettingsOpen(false);
  }, []);

  return (
    <div className="relative flex min-h-screen min-w-80 overflow-hidden font-sans text-white">
      <Wallpaper
        wallpaperUrl={settings.wallpaperUrl}
        overlayOpacity={settings.wallpaperOverlayOpacity}
      />

      <main className="relative min-h-screen min-w-0 flex-1 overflow-hidden">
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
          ref={settingsButtonRef}
          className={clsx(
            "absolute right-4 top-4 z-50 grid size-11 place-items-center rounded-full text-white/80 outline-none transition-opacity hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 sm:right-8 sm:top-6",
            isSettingsOpen && "opacity-0",
          )}
          type="button"
          onClick={() => setIsSettingsOpen((isOpen) => !isOpen)}
          aria-label={t("app.openSettings")}
          aria-expanded={isSettingsOpen}
        >
          <Settings aria-hidden="true" className="size-5" />
        </button>

        <div className="flex h-screen min-h-0 flex-col pt-16 sm:pt-48">
          <div className="relative z-20 shrink-0 px-6 sm:px-10">
            <SearchEngineBox />
          </div>
          <Launcher />
        </div>

        <MainDialogPortal />
      </main>

      <SettingsPanel isOpen={isSettingsOpen} onClose={closeSettings} />
    </div>
  );
}
