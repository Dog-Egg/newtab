export const WALLPAPER_STORAGE_KEY = "wallpaper";

type LegacyStoredWallpaper = {
  imageUrl?: unknown;
};

export function normalizeImageUrl(value: string) {
  const url = new URL(value.trim());

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("unsupported-image-url");
  }

  return url.toString();
}

export function normalizeStoredWallpaperUrl(value: unknown): string | null {
  if (typeof value === "string") {
    try {
      return normalizeImageUrl(value);
    } catch {
      return null;
    }
  }

  if (value && typeof value === "object") {
    const legacyWallpaper = value as LegacyStoredWallpaper;

    if (typeof legacyWallpaper.imageUrl === "string") {
      try {
        return normalizeImageUrl(legacyWallpaper.imageUrl);
      } catch {
        return null;
      }
    }
  }

  return null;
}
