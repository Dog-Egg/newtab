import { normalizeStoredWallpaperUrl } from "./wallpaper";
import { normalizeLocale, type AppLocale } from "../i18n/locale";

export const DEFAULT_LAUNCHER_NODE_SCALE = 1;
export const DEFAULT_WALLPAPER_OVERLAY_OPACITY = 0.35;
export const MIN_LAUNCHER_NODE_SCALE = 0.75;
export const MAX_LAUNCHER_NODE_SCALE = 1.5;
export const LAUNCHER_NODE_SCALE_STEP = 0.01;
export const MIN_WALLPAPER_OVERLAY_OPACITY = 0;
export const MAX_WALLPAPER_OVERLAY_OPACITY = 0.8;
export const WALLPAPER_OVERLAY_OPACITY_STEP = 0.01;
export const SETTINGS_STORAGE_KEY = "settings";

export type Settings = {
  locale: AppLocale;
  wallpaperUrl: string | null;
  nodeScale: number;
  wallpaperOverlayOpacity: number;
};

export function normalizeSettings(
  value: unknown,
  defaultLocale: AppLocale = "en",
): Settings {
  const wallpaperUrl =
    value && typeof value === "object" && "wallpaperUrl" in value
      ? normalizeStoredWallpaperUrl(value.wallpaperUrl)
      : null;
  const nodeScale =
    value && typeof value === "object" && "nodeScale" in value
      ? Number(value.nodeScale)
      : DEFAULT_LAUNCHER_NODE_SCALE;
  const wallpaperOverlayOpacity =
    value && typeof value === "object" && "wallpaperOverlayOpacity" in value
      ? Number(value.wallpaperOverlayOpacity)
      : DEFAULT_WALLPAPER_OVERLAY_OPACITY;
  return {
    locale:
      value && typeof value === "object" && "locale" in value
        ? normalizeLocale(value.locale)
        : defaultLocale,
    wallpaperUrl,
    nodeScale: Number.isFinite(nodeScale)
      ? Math.min(
          MAX_LAUNCHER_NODE_SCALE,
          Math.max(MIN_LAUNCHER_NODE_SCALE, nodeScale),
        )
      : DEFAULT_LAUNCHER_NODE_SCALE,
    wallpaperOverlayOpacity: Number.isFinite(wallpaperOverlayOpacity)
      ? Math.min(
          MAX_WALLPAPER_OVERLAY_OPACITY,
          Math.max(MIN_WALLPAPER_OVERLAY_OPACITY, wallpaperOverlayOpacity),
        )
      : DEFAULT_WALLPAPER_OVERLAY_OPACITY,
  };
}
