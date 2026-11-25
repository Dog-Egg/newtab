import { useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RangeSlider } from "../../components/RangeSlider";
import { CustomWallpaperUrl } from "./CustomWallpaperUrl";
import { hasWallpaperGallery } from "./gallery/api";
import { WallpaperGallery } from "./gallery/WallpaperGallery";
import {
  DEFAULT_OVERLAY_OPACITY,
  MAX_OVERLAY_OPACITY,
  MIN_OVERLAY_OPACITY,
} from "./schema";
import {
  canNavigateHistory,
  isWallpaperChangePending,
  useWallpapersStore,
} from "./store";
import styles from "./WallpaperSettings.module.css";

const iconButtonClass =
  "grid size-8 place-items-center rounded-md text-glass-content outline-none transition enabled:hover:bg-glass-hover enabled:hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-40 motion-reduce:transition-none";

export function WallpaperSettings() {
  const { t } = useTranslation();
  const { url, overlayOpacity } = useWallpapersStore(
    (state) => state.wallpaper,
  );
  const updateWallpaper = useWallpapersStore((state) => state.updateWallpaper);
  const application = useWallpapersStore((state) => state.imageApplication);
  const applyImage = useWallpapersStore((state) => state.applyImage);
  const canGoBack = useWallpapersStore((state) =>
    canNavigateHistory(state, -1),
  );
  const canGoForward = useWallpapersStore((state) =>
    canNavigateHistory(state, 1),
  );
  const navigateHistory = useWallpapersStore((state) => state.navigateHistory);
  const restoreDefaultWallpaper = useWallpapersStore(
    (state) => state.restoreDefaultWallpaper,
  );
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  const isDefault =
    url === undefined && overlayOpacity === DEFAULT_OVERLAY_OPACITY;
  const customApplication =
    application?.input === "custom" ? application : null;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-labelledby="wallpaper-title"
    >
      <div className="shrink-0 space-y-5 px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <h3
            id="wallpaper-title"
            className="text-sm font-medium text-glass-strong"
          >
            {t("settings.wallpaper")}
          </h3>
          <div className="flex items-center gap-1">
            <button
              className={iconButtonClass}
              type="button"
              aria-label={t("settings.wallpaperBack")}
              title={t("settings.wallpaperBack")}
              disabled={!canGoBack}
              onClick={() => navigateHistory(-1)}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              className={iconButtonClass}
              type="button"
              aria-label={t("settings.wallpaperForward")}
              title={t("settings.wallpaperForward")}
              disabled={!canGoForward}
              onClick={() => navigateHistory(1)}
            >
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <button
              className={iconButtonClass}
              type="button"
              aria-label={t("settings.restoreDefault")}
              title={t("settings.restoreDefault")}
              disabled={isDefault && !isWallpaperChangePending(application)}
              onClick={restoreDefaultWallpaper}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {application?.input === "history" && application.status === "error" && (
          <p role="alert" className="text-xs font-semibold text-rose-300">
            {t("settings.imageLoadFailed")}
          </p>
        )}

        <CustomWallpaperUrl
          initialUrl={customApplication?.url}
          onApply={(nextUrl) => applyImage(nextUrl, "custom")}
          pendingUrl={
            customApplication?.status === "loading"
              ? customApplication.url
              : undefined
          }
          failedUrl={
            customApplication?.status === "error"
              ? customApplication.url
              : undefined
          }
        />

        <div className="space-y-2.5">
          <label
            className="block text-xs font-semibold text-glass-content"
            htmlFor="wallpaper-overlay"
          >
            {t("settings.imageOverlay")}
          </label>
          <RangeSlider
            id="wallpaper-overlay"
            min={MIN_OVERLAY_OPACITY}
            max={MAX_OVERLAY_OPACITY}
            step={0.01}
            value={overlayOpacity}
            ariaLabel={t("settings.imageOverlayIntensity")}
            minLabel={t("settings.light")}
            maxLabel={t("settings.dark")}
            defaultValue={DEFAULT_OVERLAY_OPACITY}
            onChange={(value) => updateWallpaper({ overlayOpacity: value })}
          />
        </div>
      </div>

      {hasWallpaperGallery && (
        <div
          ref={setScrollRoot}
          className={clsx(
            "min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6",
            styles.galleryScrollArea,
          )}
        >
          {scrollRoot && (
            <WallpaperGallery
              scrollRoot={scrollRoot}
              selectedUrl={url}
              pendingUrl={
                application?.status === "loading" ? application.url : undefined
              }
              imageFailed={
                application?.input === "gallery" &&
                application.status === "error"
              }
              onSelect={(nextUrl) => applyImage(nextUrl, "gallery")}
            />
          )}
        </div>
      )}
    </section>
  );
}
