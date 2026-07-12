import { createContext, useContext, type ReactNode } from "react";

const DEFAULT_LAUNCHER_NODE_SCALE = 1;
const DEFAULT_WALLPAPER_OVERLAY_OPACITY = 0.35;
export const MIN_LAUNCHER_NODE_SCALE = 0.75;
export const MAX_LAUNCHER_NODE_SCALE = 1.5;
export const LAUNCHER_NODE_SCALE_STEP = 0.01;
export const MIN_WALLPAPER_OVERLAY_OPACITY = 0;
export const MAX_WALLPAPER_OVERLAY_OPACITY = 0.8;
export const WALLPAPER_OVERLAY_OPACITY_STEP = 0.01;
export const LAUNCHER_SETTINGS_STORAGE_KEY = "launcherSettings";

export type LauncherSettings = {
  nodeScale: number;
  wallpaperOverlayOpacity: number;
};

export function normalizeLauncherSettings(value: unknown): LauncherSettings {
  const nodeScale =
    value && typeof value === "object" && "nodeScale" in value
      ? Number(value.nodeScale)
      : DEFAULT_LAUNCHER_NODE_SCALE;
  const wallpaperOverlayOpacity =
    value && typeof value === "object" && "wallpaperOverlayOpacity" in value
      ? Number(value.wallpaperOverlayOpacity)
      : DEFAULT_WALLPAPER_OVERLAY_OPACITY;

  return {
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

const LauncherSettingsContext = createContext<LauncherSettings>({
  nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
  wallpaperOverlayOpacity: DEFAULT_WALLPAPER_OVERLAY_OPACITY,
});

export function LauncherSettingsProvider({
  settings,
  children,
}: {
  settings: LauncherSettings;
  children: ReactNode;
}) {
  return (
    <LauncherSettingsContext.Provider value={settings}>
      {children}
    </LauncherSettingsContext.Provider>
  );
}

export function useLauncherSettings() {
  return useContext(LauncherSettingsContext);
}
