import { platform } from "@platform";
import { wallpapersSchema, type StoredWallpaper } from "./schema";

const WALLPAPERS_STORAGE_KEY = "wallpapers";

export const wallpaperStorage = {
  read: async () =>
    wallpapersSchema.parse(
      await platform.localStorage.read(WALLPAPERS_STORAGE_KEY),
    ),
  save: (wallpaper: StoredWallpaper) =>
    platform.localStorage.write(WALLPAPERS_STORAGE_KEY, wallpaper),
  subscribe: (onChange: () => void) =>
    platform.localStorage.subscribe(WALLPAPERS_STORAGE_KEY, onChange),
};
