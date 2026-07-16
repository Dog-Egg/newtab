import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ChevronDown, X } from "lucide-react";
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

function getRangePosition(value: number, min: number, max: number) {
  return `${((value - min) / (max - min)) * 100}%`;
}

function adjustRangeValue(
  value: number,
  direction: -1 | 1,
  step: number,
  min: number,
  max: number,
) {
  const adjustedValue =
    Math.round((value + direction * step * 10) / step) * step;
  return Math.min(max, Math.max(min, Number(adjustedValue.toFixed(12))));
}

function RangeLabels({
  minLabel,
  maxLabel,
  defaultValue,
  min,
  max,
  onDecrease,
  onIncrease,
  onReset,
}: {
  minLabel: string;
  maxLabel: string;
  defaultValue: number;
  min: number;
  max: number;
  onDecrease: () => void;
  onIncrease: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const labelButtonClass =
    "absolute rounded px-1 outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none";

  return (
    <div className="relative mt-0.5 h-5 text-xs font-medium text-white/[0.85]">
      <button
        className={`${labelButtonClass} left-0`}
        type="button"
        onClick={onDecrease}
        aria-label={t("settings.decrease", { label: minLabel })}
      >
        {minLabel}
      </button>
      <button
        className={`${labelButtonClass} -translate-x-1/2`}
        style={{ left: getRangePosition(defaultValue, min, max) }}
        type="button"
        onClick={onReset}
        aria-label={t("settings.resetDefault", { value: defaultValue })}
      >
        {t("common.default")}
      </button>
      <button
        className={`${labelButtonClass} right-0`}
        type="button"
        onClick={onIncrease}
        aria-label={t("settings.increase", { label: maxLabel })}
      >
        {maxLabel}
      </button>
    </div>
  );
}

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
  onChange,
}: {
  settings: Settings;
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
      <div>
        <input
          id="launcher-node-size"
          className="settings-range"
          type="range"
          min={MIN_LAUNCHER_NODE_SCALE}
          max={MAX_LAUNCHER_NODE_SCALE}
          step={LAUNCHER_NODE_SCALE_STEP}
          value={settings.nodeScale}
          aria-label={t("settings.shortcutSize")}
          onChange={(event) =>
            onChange({
              nodeScale: Number(event.currentTarget.value),
            })
          }
        />
        <RangeLabels
          minLabel={t("settings.small")}
          maxLabel={t("settings.large")}
          defaultValue={DEFAULT_LAUNCHER_NODE_SCALE}
          min={MIN_LAUNCHER_NODE_SCALE}
          max={MAX_LAUNCHER_NODE_SCALE}
          onDecrease={() =>
            onChange({
              nodeScale: adjustRangeValue(
                settings.nodeScale,
                -1,
                LAUNCHER_NODE_SCALE_STEP,
                MIN_LAUNCHER_NODE_SCALE,
                MAX_LAUNCHER_NODE_SCALE,
              ),
            })
          }
          onIncrease={() =>
            onChange({
              nodeScale: adjustRangeValue(
                settings.nodeScale,
                1,
                LAUNCHER_NODE_SCALE_STEP,
                MIN_LAUNCHER_NODE_SCALE,
                MAX_LAUNCHER_NODE_SCALE,
              ),
            })
          }
          onReset={() => onChange({ nodeScale: DEFAULT_LAUNCHER_NODE_SCALE })}
        />
      </div>
    </section>
  );
}

function WallpaperSettingsSection({
  selectedWallpaperUrl,
  settings,
  onSelectWallpaper,
  onClearWallpaper,
  onChangeSettings,
}: {
  selectedWallpaperUrl: string | null;
  settings: Settings;
  onSelectWallpaper: (wallpaperUrl: string) => void;
  onClearWallpaper: () => void;
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
          <div>
            <input
              id="wallpaper-overlay"
              className="settings-range"
              type="range"
              min={MIN_WALLPAPER_OVERLAY_OPACITY}
              max={MAX_WALLPAPER_OVERLAY_OPACITY}
              step={WALLPAPER_OVERLAY_OPACITY_STEP}
              value={settings.wallpaperOverlayOpacity}
              aria-label={t("settings.overlayIntensity")}
              onChange={(event) =>
                onChangeSettings({
                  wallpaperOverlayOpacity: Number(event.currentTarget.value),
                })
              }
            />
            <RangeLabels
              minLabel={t("settings.light")}
              maxLabel={t("settings.dark")}
              defaultValue={DEFAULT_WALLPAPER_OVERLAY_OPACITY}
              min={MIN_WALLPAPER_OVERLAY_OPACITY}
              max={MAX_WALLPAPER_OVERLAY_OPACITY}
              onDecrease={() =>
                onChangeSettings({
                  wallpaperOverlayOpacity: adjustRangeValue(
                    settings.wallpaperOverlayOpacity,
                    -1,
                    WALLPAPER_OVERLAY_OPACITY_STEP,
                    MIN_WALLPAPER_OVERLAY_OPACITY,
                    MAX_WALLPAPER_OVERLAY_OPACITY,
                  ),
                })
              }
              onIncrease={() =>
                onChangeSettings({
                  wallpaperOverlayOpacity: adjustRangeValue(
                    settings.wallpaperOverlayOpacity,
                    1,
                    WALLPAPER_OVERLAY_OPACITY_STEP,
                    MIN_WALLPAPER_OVERLAY_OPACITY,
                    MAX_WALLPAPER_OVERLAY_OPACITY,
                  ),
                })
              }
              onReset={() =>
                onChangeSettings({
                  wallpaperOverlayOpacity: DEFAULT_WALLPAPER_OVERLAY_OPACITY,
                })
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function SettingsPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className={`relative z-[110] shrink-0 transition-[width] duration-300 ease-out motion-reduce:transition-none`}
      style={{ width: isOpen ? "min(100vw, 26rem)" : 0 }}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <aside
        data-settings-drawer=""
        className={`glass-panel settings-panel absolute inset-y-0 right-0 flex w-[min(100vw,26rem)] flex-col overflow-hidden rounded-none transition-transform duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="settings-drawer-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-border px-5 py-4">
          <h2
            id="settings-drawer-title"
            className="text-base font-semibold text-glass-strong"
          >
            {t("settings.title")}
          </h2>
          <button
            ref={closeButtonRef}
            className="grid size-9 place-items-center rounded-full text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
            type="button"
            onClick={onClose}
            aria-label={t("settings.close")}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          <LauncherSizeSettings settings={settings} onChange={updateSettings} />
          <WallpaperSettingsSection
            selectedWallpaperUrl={settings.wallpaperUrl}
            settings={settings}
            onSelectWallpaper={(wallpaperUrl) =>
              updateSettings({ wallpaperUrl })
            }
            onClearWallpaper={() => updateSettings({ wallpaperUrl: null })}
            onChangeSettings={updateSettings}
          />
        </div>
      </aside>
    </div>
  );
}
