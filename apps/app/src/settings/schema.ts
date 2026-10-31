import * as z from "zod/mini";

export const DEFAULT_LAUNCHER_NODE_SCALE = 1;
export const DEFAULT_WALLPAPER_OVERLAY_OPACITY = 0.35;
export const MIN_LAUNCHER_NODE_SCALE = 0.75;
export const MAX_LAUNCHER_NODE_SCALE = 1.5;
export const MIN_WALLPAPER_OVERLAY_OPACITY = 0;
export const MAX_WALLPAPER_OVERLAY_OPACITY = 0.8;
export const SETTINGS_STORAGE_KEY = "settings";

export const wallpaperUrlSchema = z.pipe(
  z.string().check(z.trim(), z.httpUrl()),
  z.transform((value) => new URL(value).toString()),
);

export const wallpaperColorSchema = z.pipe(
  z.string().check(z.trim(), z.regex(/^#[\da-f]{6}$/i)),
  z.transform((value) => value.toUpperCase()),
);

export const settingsSchema = z.pipe(
  z.transform((value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {},
  ),
  z.object({
    locale: z.catch(z.optional(z.enum(["en", "zh-CN"])), undefined),
    wallpaperUrl: z.catch(z.optional(wallpaperUrlSchema), undefined),
    wallpaperColor: z.catch(z.optional(wallpaperColorSchema), undefined),
    nodeScale: z.catch(
      z
        .number()
        .check(
          z.minimum(MIN_LAUNCHER_NODE_SCALE),
          z.maximum(MAX_LAUNCHER_NODE_SCALE),
        ),
      DEFAULT_LAUNCHER_NODE_SCALE,
    ),
    wallpaperOverlayOpacity: z.catch(
      z
        .number()
        .check(
          z.minimum(MIN_WALLPAPER_OVERLAY_OPACITY),
          z.maximum(MAX_WALLPAPER_OVERLAY_OPACITY),
        ),
      DEFAULT_WALLPAPER_OVERLAY_OPACITY,
    ),
  }),
);

export type Settings = z.infer<typeof settingsSchema>;
