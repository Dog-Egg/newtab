import * as z from "zod/mini";

export const WALLPAPERS_STORAGE_KEY = "wallpapers";
export const DEFAULT_OVERLAY_OPACITY = 0.35;
export const MIN_OVERLAY_OPACITY = 0;
export const MAX_OVERLAY_OPACITY = 0.8;

export const wallpaperUrlSchema = z.pipe(
  z.string().check(z.trim(), z.httpUrl()),
  z.transform((value) => new URL(value).toString()),
);

export const wallpapersSchema = z.pipe(
  z.transform((value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {},
  ),
  z.object({
    url: z.catch(z.optional(wallpaperUrlSchema), undefined),
    overlayOpacity: z.catch(
      z
        .number()
        .check(z.minimum(MIN_OVERLAY_OPACITY), z.maximum(MAX_OVERLAY_OPACITY)),
      DEFAULT_OVERLAY_OPACITY,
    ),
  }),
);

export type StoredWallpaper = z.infer<typeof wallpapersSchema>;
