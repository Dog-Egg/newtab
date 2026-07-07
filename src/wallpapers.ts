export const WALLPAPER_STORAGE_KEY = "browserTabWallpaper";

type LegacyStoredWallpaper = {
  imageUrl?: unknown;
};

function canUseChromeStorage() {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

export function normalizeImageUrl(value: string) {
  const url = new URL(value.trim());

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("unsupported-image-url");
  }

  return url.toString();
}

function normalizeStoredWallpaperUrl(value: unknown): string | null {
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

export async function readStoredWallpaperUrl() {
  if (canUseChromeStorage()) {
    return new Promise<string | null>((resolve) => {
      chrome.storage.local.get(WALLPAPER_STORAGE_KEY, (items) => {
        resolve(normalizeStoredWallpaperUrl(items[WALLPAPER_STORAGE_KEY]));
      });
    });
  }

  const saved = window.localStorage.getItem(WALLPAPER_STORAGE_KEY);
  if (!saved) {
    return null;
  }

  try {
    return normalizeStoredWallpaperUrl(JSON.parse(saved));
  } catch {
    return normalizeStoredWallpaperUrl(saved);
  }
}

export async function saveStoredWallpaperUrl(wallpaperUrl: string | null) {
  if (canUseChromeStorage()) {
    if (wallpaperUrl) {
      await chrome.storage.local.set({ [WALLPAPER_STORAGE_KEY]: wallpaperUrl });
      return;
    }

    await chrome.storage.local.remove(WALLPAPER_STORAGE_KEY);
    return;
  }

  if (wallpaperUrl) {
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, wallpaperUrl);
    return;
  }

  window.localStorage.removeItem(WALLPAPER_STORAGE_KEY);
}
