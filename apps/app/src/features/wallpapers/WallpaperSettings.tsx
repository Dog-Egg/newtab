import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRange } from "../../settings/settings-range/SettingsRange";
import { SettingsScrollArea } from "../../settings/SettingsScrollArea";
import { CustomWallpaperUrl } from "./CustomWallpaperUrl";
import { WallpaperGallery } from "./gallery/WallpaperGallery";
import {
  DEFAULT_OVERLAY_OPACITY,
  MAX_OVERLAY_OPACITY,
  MIN_OVERLAY_OPACITY,
} from "./schema";
import { useWallpapersStore } from "./store";

const showWallpaperGallery =
  import.meta.env.DEV || import.meta.env.MODE === "extension";

type ImageApplication = {
  url: string;
  input: "gallery" | "custom";
  status: "loading" | "error";
};

export function WallpaperSettings() {
  const { t } = useTranslation();
  const { url, overlayOpacity } = useWallpapersStore(
    (state) => state.wallpaper,
  );
  const updateWallpaper = useWallpapersStore((state) => state.updateWallpaper);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [application, setApplication] = useState<ImageApplication | null>(null);
  const pendingImage = useRef<HTMLImageElement | null>(null);

  const cancelImageRequest = useCallback(() => {
    const image = pendingImage.current;
    if (!image) return;

    image.onload = null;
    image.onerror = null;
    pendingImage.current = null;
  }, []);

  useEffect(() => cancelImageRequest, [cancelImageRequest]);

  function applyImage(nextUrl: string, input: ImageApplication["input"]) {
    if (application?.status === "loading" && application.url === nextUrl)
      return;
    cancelImageRequest();

    if (url === nextUrl) {
      setApplication(null);
      return;
    }

    const image = new Image();
    pendingImage.current = image;
    setApplication({ url: nextUrl, input, status: "loading" });

    image.onload = () => {
      if (pendingImage.current !== image) return;
      cancelImageRequest();
      setApplication(null);
      updateWallpaper({ url: nextUrl });
    };
    image.onerror = () => {
      if (pendingImage.current !== image) return;
      cancelImageRequest();
      setApplication({ url: nextUrl, input, status: "error" });
    };
    image.src = nextUrl;
  }

  const isDefault =
    url === undefined && overlayOpacity === DEFAULT_OVERLAY_OPACITY;

  return (
    <SettingsScrollArea ref={showWallpaperGallery ? setScrollRoot : undefined}>
      <section className="space-y-5" aria-labelledby="wallpaper-title">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <h3
            id="wallpaper-title"
            className="text-sm font-medium text-glass-strong"
          >
            {t("settings.wallpaper")}
          </h3>
          {!isDefault && (
            <button
              className="rounded px-1 text-xs font-medium text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none"
              type="button"
              onClick={() => {
                cancelImageRequest();
                setApplication(null);
                updateWallpaper({
                  url: undefined,
                  overlayOpacity: DEFAULT_OVERLAY_OPACITY,
                });
              }}
            >
              {t("settings.restoreDefault")}
            </button>
          )}
        </div>

        <CustomWallpaperUrl
          onApply={(nextUrl) => applyImage(nextUrl, "custom")}
          pending={
            application?.input === "custom" && application.status === "loading"
          }
          failedUrl={
            application?.input === "custom" && application.status === "error"
              ? application.url
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
          <SettingsRange
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

        {showWallpaperGallery && scrollRoot && (
          <WallpaperGallery
            scrollRoot={scrollRoot}
            selectedUrl={url}
            pendingUrl={
              application?.status === "loading" ? application.url : undefined
            }
            imageFailed={
              application?.input === "gallery" && application.status === "error"
            }
            onSelect={(nextUrl) => applyImage(nextUrl, "gallery")}
          />
        )}
      </section>
    </SettingsScrollArea>
  );
}
