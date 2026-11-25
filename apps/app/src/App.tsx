import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import clsx from "clsx";
import { Settings as SettingsIcon } from "lucide-react";
import { Launcher } from "./features/launcher/Launcher";
import { SearchEngineBox } from "./features/search";
import { hasWallpaperGallery } from "./features/wallpapers/gallery/api";
import { RandomWallpaperButton } from "./features/wallpapers/RandomWallpaperButton";
import { WallpaperBackground } from "./features/wallpapers/WallpaperBackground";
import { MainDialogPortal } from "./components/Dialog";
import { Drawer } from "./components/Drawer";
import { IconButton } from "./components/IconButton";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { useTranslation } from "react-i18next";
import { useBookmarkLifecycle } from "./features/launcher/use-bookmark-lifecycle";
import { BookmarkDock } from "./features/dock/BookmarkDock";
import { useBookmarkNodeScale } from "./features/launcher/use-bookmark-node-scale";

const toastOffset = hasWallpaperGallery
  ? { bottom: "calc(var(--corner-inset) + 3.5rem)" }
  : undefined;

export function App() {
  const isLoaded = useBookmarkLifecycle();
  const { t, i18n } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useBookmarkNodeScale(isLoaded);

  useEffect(() => {
    document.title = t("app.title");
  }, [i18n.resolvedLanguage, t]);

  const closeSettings = useCallback(() => {
    settingsButtonRef.current?.focus();
    setIsSettingsOpen(false);
  }, []);

  if (!isLoaded) return null;

  return (
    <div className="relative flex min-h-dvh min-w-80 overflow-hidden font-sans text-white">
      <WallpaperBackground />

      <main className="relative min-h-dvh min-w-0 flex-1 overflow-hidden [--corner-inset:1rem] sm:[--corner-inset:1.5rem]">
        <Toaster
          position="bottom-right"
          offset={toastOffset}
          mobileOffset={toastOffset}
          toastOptions={{
            classNames: {
              toast:
                "border-white/15 bg-slate-950/90 text-white shadow-2xl backdrop-blur",
              title: "font-bold",
              description: "text-white/70",
            },
          }}
        />

        <IconButton
          ref={settingsButtonRef}
          className={clsx(
            "absolute right-[var(--corner-inset)] top-[var(--corner-inset)] z-50",
            isSettingsOpen && "opacity-0",
          )}
          onClick={() => {
            setHasOpenedSettings(true);
            setIsSettingsOpen((isOpen) => !isOpen);
          }}
          label={t("app.openSettings")}
          aria-expanded={isSettingsOpen}
        >
          <SettingsIcon />
        </IconButton>

        <div
          ref={contentRef}
          className="flex h-dvh min-h-0 flex-col pt-16 sm:pt-[clamp(4rem,14vh,12rem)] 2xl:pt-[clamp(4rem,18vh,12rem)]"
        >
          <div className="relative z-20 shrink-0 px-6 sm:px-10">
            <SearchEngineBox />
          </div>
          <Launcher />
          <div
            className={clsx(
              "shrink-0",
              hasWallpaperGallery &&
                "grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-end px-[var(--corner-inset)]",
            )}
          >
            <div className="col-start-2 row-start-1">
              <BookmarkDock />
            </div>
            {hasWallpaperGallery && (
              <RandomWallpaperButton className="col-start-3 row-start-1 mb-[var(--corner-inset)]" />
            )}
          </div>
        </div>

        <MainDialogPortal />
      </main>

      <Drawer
        isOpen={isSettingsOpen}
        title={t("settings.title")}
        titleId="settings-drawer-title"
        closeLabel={t("settings.close")}
        onClose={closeSettings}
      >
        {hasOpenedSettings ? <SettingsPanel /> : null}
      </Drawer>
    </div>
  );
}
