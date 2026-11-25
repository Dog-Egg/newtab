import { platform } from "@platform";
import * as z from "zod/mini";
import {
  WALLHAVEN_ORIGIN,
  WALLHAVEN_PROXY_PATH,
  WALLHAVEN_SEARCH_PATH,
} from "./config";

const pageCount = z.int().check(z.nonnegative());
const storedPageCount = z.object({
  lastPage: pageCount,
  updatedAt: z.number(),
});
const pageCountMaxAge = 30 * 24 * 60 * 60 * 1000;
const topRange = "1w";
const pageCountStorageKey = `wallhaven.toplist.${topRange}.page-count`;

const searchResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      path: z
        .string()
        .check(z.regex(/^https:\/\/w\.wallhaven\.cc\/full\/[\w/.-]+$/)),
      resolution: z.string(),
      thumbs: z.object({
        large: z
          .string()
          .check(z.regex(/^https:\/\/th\.wallhaven\.cc\/[\w/.-]+$/)),
      }),
    }),
  ),
  meta: z.object({ last_page: pageCount }),
});

const searchEndpoint =
  import.meta.env.MODE === "extension"
    ? `${WALLHAVEN_ORIGIN}${WALLHAVEN_SEARCH_PATH}`
    : WALLHAVEN_PROXY_PATH;

export const hasWallpaperGallery =
  import.meta.env.DEV || import.meta.env.MODE === "extension";

export type GalleryWallpaper = {
  id: string;
  url: string;
  resolution: string;
  thumbnailUrl: string;
};

class WallpaperRequestError extends Error {
  constructor(readonly status: number) {
    super(`Wallpaper request failed (HTTP ${status})`);
  }
}

async function readPopularWallpaperPageCount() {
  const stored = await platform.localStorage
    .read(pageCountStorageKey)
    .catch(() => undefined);
  const result = storedPageCount.safeParse(stored);
  if (!result.success) return undefined;

  const age = Date.now() - result.data.updatedAt;
  if (age >= 0 && age < pageCountMaxAge) return result.data.lastPage;
}

function cachePageCount(lastPage: number) {
  void platform.localStorage
    .write(pageCountStorageKey, { lastPage, updatedAt: Date.now() })
    .catch(() => undefined);
}

async function requestWallpaperPage(page: number, signal: AbortSignal) {
  signal.throwIfAborted();
  const params = new URLSearchParams({
    purity: "100",
    categories: "111",
    ratios: "landscape",
    sorting: "toplist",
    topRange,
    page: String(page),
  });
  const response = await fetch(`${searchEndpoint}?${params}`, {
    signal,
    credentials: "omit",
  });

  if (!response.ok) {
    throw new WallpaperRequestError(response.status);
  }

  const body: unknown = await response.json();
  signal.throwIfAborted();
  const { data, meta } = searchResponse.parse(body);
  const wallpapers: GalleryWallpaper[] = data.map(
    ({ id, path, resolution, thumbs }) => ({
      id,
      url: path,
      resolution,
      thumbnailUrl: thumbs.large,
    }),
  );
  return { wallpapers, lastPage: meta.last_page };
}

export async function fetchWallpapers(page: number, signal: AbortSignal) {
  const result = await requestWallpaperPage(page, signal);
  signal.throwIfAborted();
  cachePageCount(result.lastPage);
  return result;
}

function pickWallpaperUrl(wallpapers: GalleryWallpaper[], currentUrl: string) {
  const candidates = wallpapers.filter(({ url }) => url !== currentUrl);
  return candidates[Math.floor(Math.random() * candidates.length)]?.url;
}

export async function pickPopularWallpaper(
  currentUrl: string,
  signal: AbortSignal,
) {
  let firstPage: Awaited<ReturnType<typeof requestWallpaperPage>> | undefined;
  let lastPageFromResponse: number | undefined;

  async function getPage(page: number) {
    if (page === 1 && firstPage) return firstPage;

    try {
      const result = await requestWallpaperPage(page, signal);
      lastPageFromResponse = result.lastPage;
      if (page === 1) firstPage = result;
      if (page === 1 || page <= result.lastPage) return result;
    } catch (error) {
      if (
        page > 1 &&
        error instanceof WallpaperRequestError &&
        error.status === 404
      ) {
        return undefined;
      }
      throw error;
    }
  }

  try {
    const cachedLastPage = await readPopularWallpaperPageCount();
    const lastPage = cachedLastPage ?? (await getPage(1))?.lastPage ?? 1;
    const page = 1 + Math.floor(Math.random() * Math.max(1, lastPage));
    const selected = await getPage(page);
    const url = selected && pickWallpaperUrl(selected.wallpapers, currentUrl);
    if (url) return url;
    if (page === 1 && (!selected || selected.lastPage <= 1)) return;

    const fallback = await getPage(page === 1 ? 2 : 1);
    if (fallback) return pickWallpaperUrl(fallback.wallpapers, currentUrl);
  } finally {
    if (!signal.aborted && lastPageFromResponse !== undefined) {
      cachePageCount(lastPageFromResponse);
    }
  }
}
