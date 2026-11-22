import * as z from "zod/mini";
import {
  WALLHAVEN_ORIGIN,
  WALLHAVEN_PROXY_PATH,
  WALLHAVEN_SEARCH_PATH,
} from "./config";

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
  meta: z.object({ last_page: z.number() }),
});

const searchEndpoint =
  import.meta.env.MODE === "extension"
    ? `${WALLHAVEN_ORIGIN}${WALLHAVEN_SEARCH_PATH}`
    : WALLHAVEN_PROXY_PATH;

export type GalleryWallpaper = {
  id: string;
  url: string;
  resolution: string;
  thumbnailUrl: string;
};

export async function fetchWallpapers(page: number, signal: AbortSignal) {
  const params = new URLSearchParams({
    purity: "100",
    categories: "111",
    ratios: "landscape",
    sorting: "toplist",
    topRange: "1M",
    page: String(page),
  });
  const response = await fetch(`${searchEndpoint}?${params}`, {
    signal,
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`Wallpaper request failed (HTTP ${response.status})`);
  }

  const { data, meta } = searchResponse.parse(await response.json());
  const wallpapers: GalleryWallpaper[] = data.map(
    ({ id, path, resolution, thumbs }) => ({
      id,
      url: path,
      resolution,
      thumbnailUrl: thumbs.large,
    }),
  );
  return { wallpapers, hasNextPage: page < meta.last_page };
}
