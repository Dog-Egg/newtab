import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_WALLPAPER_OVERLAY_OPACITY,
  MAX_WALLPAPER_OVERLAY_OPACITY,
  MIN_WALLPAPER_OVERLAY_OPACITY,
  wallpaperUrlSchema,
} from "../schema";
import { useSettingsStore } from "../store";
import { SettingsRange } from "../SettingsRange";

const DEFAULT_SOLID_COLOR = "#0F766E";
const WALLPAPER_COLORS = [
  "#0F172A",
  "#334155",
  "#1E3A8A",
  "#1D4ED8",
  "#4338CA",
  "#6D28D9",
  "#BE123C",
  "#C2410C",
  "#166534",
  "#0F766E",
  "#78350F",
] as const;

type WallpaperMode = "image" | "color";

function preloadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = url;
  });
}

export function WallpaperSettings() {
  const { t } = useTranslation();
  const wallpaperUrl = useSettingsStore((state) => state.wallpaperUrl);
  const wallpaperColor = useSettingsStore((state) => state.wallpaperColor);
  const wallpaperOverlayOpacity = useSettingsStore(
    (state) => state.wallpaperOverlayOpacity,
  );
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const pendingCustomColorRef = useRef<string | null>(null);
  const customColorFrameRef = useRef<number | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [customImageError, setCustomImageError] = useState("");
  const [isApplyingCustomImage, setIsApplyingCustomImage] = useState(false);
  const [mode, setMode] = useState<WallpaperMode>(() =>
    wallpaperColor ? "color" : "image",
  );
  const selectedColor = wallpaperColor ?? DEFAULT_SOLID_COLOR;
  const isDefaultWallpaper =
    wallpaperUrl === undefined &&
    wallpaperColor === undefined &&
    wallpaperOverlayOpacity === DEFAULT_WALLPAPER_OVERLAY_OPACITY;

  const flushCustomColorUpdate = useCallback(() => {
    if (customColorFrameRef.current !== null) {
      window.cancelAnimationFrame(customColorFrameRef.current);
      customColorFrameRef.current = null;
    }

    const nextColor = pendingCustomColorRef.current;
    pendingCustomColorRef.current = null;
    if (nextColor) updateSettings({ wallpaperColor: nextColor });
  }, [updateSettings]);

  const discardPendingCustomColor = useCallback(() => {
    if (customColorFrameRef.current !== null) {
      window.cancelAnimationFrame(customColorFrameRef.current);
      customColorFrameRef.current = null;
    }
    pendingCustomColorRef.current = null;
  }, []);

  const scheduleCustomColorUpdate = useCallback(() => {
    if (customColorFrameRef.current === null) {
      customColorFrameRef.current = window.requestAnimationFrame(() => {
        customColorFrameRef.current = null;
        const nextColor = pendingCustomColorRef.current;
        pendingCustomColorRef.current = null;
        if (nextColor) updateSettings({ wallpaperColor: nextColor });
      });
    }
  }, [updateSettings]);

  useEffect(() => flushCustomColorUpdate, [flushCustomColorUpdate]);

  const applyCustomWallpaper = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const parsedImageUrl = wallpaperUrlSchema.safeParse(customImageUrl);
      if (!parsedImageUrl.success) {
        setCustomImageError(t("settings.invalidImageUrl"));
        return;
      }

      const imageUrl = parsedImageUrl.data;

      setIsApplyingCustomImage(true);
      setCustomImageError("");

      try {
        await preloadImage(imageUrl);
        discardPendingCustomColor();
        updateSettings({ wallpaperUrl: imageUrl, wallpaperColor: undefined });
        setMode("image");
        setCustomImageUrl("");
      } catch {
        setCustomImageError(t("settings.imageLoadFailed"));
      } finally {
        setIsApplyingCustomImage(false);
      }
    },
    [customImageUrl, discardPendingCustomColor, t, updateSettings],
  );

  return (
    <section className="space-y-5 px-1 py-1" aria-labelledby="wallpaper-title">
      <h3
        id="wallpaper-title"
        className="text-sm font-medium text-glass-strong"
      >
        {t("settings.wallpaper")}
      </h3>

      <div
        className="flex gap-5 border-b border-white/10"
        role="tablist"
        aria-label={t("settings.wallpaper")}
      >
        {(
          [
            ["image", t("settings.image")],
            ["color", t("settings.solidColor")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={clsx(
              "relative -mb-px h-8 px-0.5 text-xs font-medium outline-none transition after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-cyan-300 after:transition-transform focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none",
              mode === id
                ? "text-glass-strong after:scale-x-100"
                : "text-glass-content after:scale-x-0 hover:text-glass-strong",
            )}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "image" ? (
        <div className="space-y-4">
          <form className="space-y-2" onSubmit={applyCustomWallpaper}>
            <div className="flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-xl border border-glass-border bg-white/10 px-3 text-sm font-medium text-glass-strong outline-none transition placeholder:text-glass-content focus:bg-glass-hover focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
                id="wallpaper-url"
                type="url"
                inputMode="url"
                placeholder={t("settings.imageUrl")}
                aria-label={t("settings.imageUrl")}
                value={customImageUrl}
                onChange={(event) => {
                  setCustomImageUrl(event.target.value);
                  setCustomImageError("");
                }}
              />
              <button
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-glass-selected text-glass-selected-content outline-none transition hover:bg-glass-strong/90 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-75 motion-reduce:transition-none"
                type="submit"
                disabled={
                  isApplyingCustomImage || customImageUrl.trim().length === 0
                }
                aria-label={t(
                  isApplyingCustomImage
                    ? "settings.applying"
                    : "settings.apply",
                )}
              >
                <Check aria-hidden="true" className="size-4" />
              </button>
            </div>
            {customImageError ? (
              <p className="text-xs font-semibold text-rose-300">
                {customImageError}
              </p>
            ) : null}
          </form>

          <div className="space-y-2.5">
            <label
              className="block text-xs font-semibold text-glass-content"
              htmlFor="wallpaper-overlay"
            >
              {t("settings.imageOverlay")}
            </label>
            <SettingsRange
              id="wallpaper-overlay"
              min={MIN_WALLPAPER_OVERLAY_OPACITY}
              max={MAX_WALLPAPER_OVERLAY_OPACITY}
              step={0.01}
              value={wallpaperOverlayOpacity}
              ariaLabel={t("settings.imageOverlayIntensity")}
              minLabel={t("settings.light")}
              maxLabel={t("settings.dark")}
              defaultValue={DEFAULT_WALLPAPER_OVERLAY_OPACITY}
              onChange={(nextOverlayOpacity) =>
                updateSettings({
                  wallpaperOverlayOpacity: nextOverlayOpacity,
                })
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="flex flex-wrap gap-2"
            aria-label={t("settings.colorOptions")}
          >
            {WALLPAPER_COLORS.map((color) => (
              <button
                key={color}
                className={clsx(
                  "size-7 rounded-full border border-white/20 outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/80 motion-reduce:transition-none",
                  wallpaperColor === color &&
                    "ring-2 ring-white ring-offset-2 ring-offset-slate-900",
                )}
                type="button"
                style={{ backgroundColor: color }}
                aria-label={color}
                aria-pressed={wallpaperColor === color}
                onClick={() => {
                  discardPendingCustomColor();
                  updateSettings({ wallpaperColor: color });
                  setMode("color");
                }}
              />
            ))}
          </div>

          <label
            className="flex h-10 cursor-pointer items-center gap-3 rounded-xl border border-glass-border bg-white/5 px-2 outline-none transition focus-within:ring-2 focus-within:ring-glass-focus hover:bg-glass-hover"
            title={t("settings.customColor")}
          >
            <span
              className="size-6 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: selectedColor }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-glass-strong">
              {selectedColor}
            </span>
            <input
              className="sr-only"
              type="color"
              value={selectedColor}
              aria-label={t("settings.customColor")}
              onInput={(event) => {
                pendingCustomColorRef.current =
                  event.currentTarget.value.toUpperCase();
                scheduleCustomColorUpdate();
                setMode("color");
              }}
              onBlur={flushCustomColorUpdate}
            />
          </label>
        </div>
      )}

      {!isDefaultWallpaper ? (
        <button
          className="rounded px-1 text-xs font-medium text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none"
          type="button"
          onClick={() => {
            discardPendingCustomColor();
            updateSettings({
              wallpaperUrl: undefined,
              wallpaperColor: undefined,
              wallpaperOverlayOpacity: DEFAULT_WALLPAPER_OVERLAY_OPACITY,
            });
          }}
        >
          {t("settings.restoreDefault")}
        </button>
      ) : null}
    </section>
  );
}
