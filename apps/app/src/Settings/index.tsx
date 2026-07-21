import { useCallback, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { importBrowserBookmarksWithToast } from "../browserBookmarks";
import { normalizeImageUrl } from "./wallpaper";
import {
  DEFAULT_LAUNCHER_NODE_SCALE,
  DEFAULT_WALLPAPER_OVERLAY_OPACITY,
  LAUNCHER_NODE_SCALE_STEP,
  MAX_WALLPAPER_OVERLAY_OPACITY,
  MAX_LAUNCHER_NODE_SCALE,
  MIN_WALLPAPER_OVERLAY_OPACITY,
  MIN_LAUNCHER_NODE_SCALE,
  WALLPAPER_OVERLAY_OPACITY_STEP,
  type Settings,
} from "./settings";
import { useSettings } from "./SettingsProvider";
import { SettingsRange } from "./SettingsRange";

function preloadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = url;
  });
}

function BrowserBookmarksImportSettings() {
  const { t } = useTranslation();
  const [isImportingBookmarks, setIsImportingBookmarks] = useState(false);

  const handleImportBrowserBookmarks = useCallback(async () => {
    setIsImportingBookmarks(true);
    try {
      await importBrowserBookmarksWithToast();
    } finally {
      setIsImportingBookmarks(false);
    }
  }, []);

  return (
    <section className="border-b border-glass-border px-2 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-glass-strong">
          {t("settings.importBookmarks")}
        </h3>
        <button
          className="h-8 shrink-0 rounded-lg bg-glass-selected px-3 text-sm font-medium text-glass-selected-content outline-none transition hover:bg-glass-strong/90 focus-visible:ring-2 focus-visible:ring-glass-focus disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          type="button"
          onClick={handleImportBrowserBookmarks}
          disabled={isImportingBookmarks}
        >
          {t(isImportingBookmarks ? "settings.importing" : "settings.import")}
        </button>
      </div>
    </section>
  );
}

function LauncherSizeSettings({
  settings,
  onPreview,
  onChange,
}: {
  settings: Settings;
  onPreview: (settings: Partial<Settings>) => void;
  onChange: (settings: Partial<Settings>) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2.5 border-b border-glass-border px-2 py-4">
      <div className="flex items-center justify-between gap-3">
        <label
          className="text-sm font-medium text-glass-strong"
          htmlFor="launcher-node-size"
        >
          {t("settings.shortcutSize")}
        </label>
      </div>
      <SettingsRange
        id="launcher-node-size"
        min={MIN_LAUNCHER_NODE_SCALE}
        max={MAX_LAUNCHER_NODE_SCALE}
        step={LAUNCHER_NODE_SCALE_STEP}
        value={settings.nodeScale}
        ariaLabel={t("settings.shortcutSize")}
        minLabel={t("settings.small")}
        maxLabel={t("settings.large")}
        defaultValue={DEFAULT_LAUNCHER_NODE_SCALE}
        onPreview={(nodeScale) => onPreview({ nodeScale })}
        onCommit={(nodeScale) => onChange({ nodeScale })}
      />
    </section>
  );
}

function WallpaperSettingsSection({
  selectedWallpaperUrl,
  settings,
  onSelectWallpaper,
  onClearWallpaper,
  onPreviewSettings,
  onChangeSettings,
}: {
  selectedWallpaperUrl: string | null;
  settings: Settings;
  onSelectWallpaper: (wallpaperUrl: string) => void;
  onClearWallpaper: () => void;
  onPreviewSettings: (settings: Partial<Settings>) => void;
  onChangeSettings: (settings: Partial<Settings>) => void;
}) {
  const { t } = useTranslation();
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [customImageError, setCustomImageError] = useState("");
  const [isApplyingCustomImage, setIsApplyingCustomImage] = useState(false);

  const applyCustomWallpaper = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      let imageUrl: string;

      try {
        imageUrl = normalizeImageUrl(customImageUrl);
      } catch {
        setCustomImageError(t("settings.invalidImageUrl"));
        return;
      }

      setIsApplyingCustomImage(true);
      setCustomImageError("");

      try {
        await preloadImage(imageUrl);
        onSelectWallpaper(imageUrl);
        setCustomImageUrl("");
      } catch {
        setCustomImageError(t("settings.imageLoadFailed"));
      } finally {
        setIsApplyingCustomImage(false);
      }
    },
    [customImageUrl, onSelectWallpaper],
  );

  return (
    <section className="px-2 py-4" aria-labelledby="wallpaper-settings-title">
      <h3
        id="wallpaper-settings-title"
        className="text-sm font-medium text-glass-strong"
      >
        {t("settings.wallpaper")}
      </h3>

      <div className="mt-4 space-y-4">
        <form className="space-y-2" onSubmit={applyCustomWallpaper}>
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-xs font-semibold text-glass-content"
              htmlFor="wallpaper-url"
            >
              {t("settings.imageUrl")}
            </label>
            {selectedWallpaperUrl && (
              <button
                className={
                  "shrink-0 rounded px-1 text-xs font-medium text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none"
                }
                type="button"
                onClick={onClearWallpaper}
              >
                {t("settings.restoreDefault")}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="h-9 min-w-0 flex-1 rounded-lg border border-glass-border bg-white/60 px-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-500 focus:bg-white/80 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none"
              id="wallpaper-url"
              type="url"
              inputMode="url"
              value={customImageUrl}
              onChange={(event) => {
                setCustomImageUrl(event.target.value);
                setCustomImageError("");
              }}
            />
            <button
              className="h-9 shrink-0 rounded-lg bg-glass-selected px-3 text-sm font-semibold text-glass-selected-content outline-none transition hover:bg-glass-strong/90 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-75 motion-reduce:transition-none"
              type="submit"
              disabled={
                isApplyingCustomImage || customImageUrl.trim().length === 0
              }
            >
              {t(
                isApplyingCustomImage ? "settings.applying" : "settings.apply",
              )}
            </button>
          </div>
          {customImageError ? (
            <p className="text-xs font-semibold text-rose-700">
              {customImageError}
            </p>
          ) : null}
        </form>

        <div className="space-y-2.5">
          <label
            className="block text-xs font-semibold text-glass-content"
            htmlFor="wallpaper-overlay"
          >
            {t("settings.wallpaperOverlay")}
          </label>
          <SettingsRange
            id="wallpaper-overlay"
            min={MIN_WALLPAPER_OVERLAY_OPACITY}
            max={MAX_WALLPAPER_OVERLAY_OPACITY}
            step={WALLPAPER_OVERLAY_OPACITY_STEP}
            value={settings.wallpaperOverlayOpacity}
            ariaLabel={t("settings.overlayIntensity")}
            minLabel={t("settings.light")}
            maxLabel={t("settings.dark")}
            defaultValue={DEFAULT_WALLPAPER_OVERLAY_OPACITY}
            onPreview={(wallpaperOverlayOpacity) =>
              onPreviewSettings({ wallpaperOverlayOpacity })
            }
            onCommit={(wallpaperOverlayOpacity) =>
              onChangeSettings({
                wallpaperOverlayOpacity,
              })
            }
          />
        </div>
      </div>
    </section>
  );
}

export function SettingsContent() {
  const { t } = useTranslation();
  const { settings, previewSettings, updateSettings } = useSettings();

  return (
    <>
      <section
        className="border-b border-glass-border px-2 py-4"
        aria-labelledby="language-settings-title"
      >
        <h3
          id="language-settings-title"
          className="text-sm font-medium text-glass-strong"
        >
          {t("settings.language")}
        </h3>
        <div className="relative mt-3">
          <select
            id="settings-language"
            className="h-10 w-full appearance-none rounded-xl border border-glass-border bg-white/10 py-0 pl-3 pr-11 text-sm font-medium text-glass-strong outline-none transition hover:bg-glass-hover focus-visible:border-glass-focus focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
            value={settings.locale}
            aria-labelledby="language-settings-title"
            onChange={(event) =>
              updateSettings({
                locale: event.currentTarget.value as Settings["locale"],
              })
            }
          >
            <option value="en">{t("settings.english")}</option>
            <option value="zh-CN">{t("settings.chinese")}</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-glass-content"
            aria-hidden="true"
          />
        </div>
      </section>
      <BrowserBookmarksImportSettings />
      <LauncherSizeSettings
        settings={settings}
        onPreview={previewSettings}
        onChange={updateSettings}
      />
      <WallpaperSettingsSection
        selectedWallpaperUrl={settings.wallpaperUrl}
        settings={settings}
        onSelectWallpaper={(wallpaperUrl) => updateSettings({ wallpaperUrl })}
        onClearWallpaper={() => updateSettings({ wallpaperUrl: null })}
        onPreviewSettings={previewSettings}
        onChangeSettings={updateSettings}
      />
    </>
  );
}
