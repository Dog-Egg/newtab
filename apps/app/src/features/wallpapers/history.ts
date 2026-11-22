import type { StoredWallpaper } from "./schema";

export type WallpaperHistory = {
  urls: StoredWallpaper["url"][];
  index: number;
};

export function recordWallpaper(
  history: WallpaperHistory,
  url: StoredWallpaper["url"],
): WallpaperHistory {
  if (history.urls[history.index] === url) return history;

  return {
    urls: [...history.urls.slice(0, history.index + 1), url],
    index: history.index + 1,
  };
}

export function getHistoryEntry(history: WallpaperHistory, index: number) {
  if (index < 0 || index >= history.urls.length) return null;
  return { index, url: history.urls[index] };
}
