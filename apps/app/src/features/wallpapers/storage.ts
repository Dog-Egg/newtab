import { platform } from "@platform";
import { wallpapersSchema, type StoredWallpaper } from "./schema";

const WALLPAPERS_STORAGE_KEY = "wallpapers";

async function readWallpaper() {
  return wallpapersSchema.parse(
    await platform.localStorage.read(WALLPAPERS_STORAGE_KEY),
  );
}

export async function readInitialWallpaper() {
  try {
    return await readWallpaper();
  } catch (error) {
    console.error("Failed to read wallpaper", error);
    return wallpapersSchema.parse(undefined);
  }
}

export function syncWallpaperStorage(
  onChange: (wallpaper: StoredWallpaper) => void,
) {
  let pendingSave: Promise<void> | undefined;
  let readRevision = 0;

  function refresh() {
    if (pendingSave) return;

    const revision = ++readRevision;
    void readWallpaper().then(
      (wallpaper) => {
        if (!pendingSave && revision === readRevision) onChange(wallpaper);
      },
      (error: unknown) => console.error("Failed to read wallpaper", error),
    );
  }

  platform.localStorage.subscribe(WALLPAPERS_STORAGE_KEY, refresh);

  return function saveWallpaper(wallpaper: StoredWallpaper) {
    // Serialize writes and skip snapshots superseded before their write starts.
    const save = (pendingSave ?? Promise.resolve())
      .then(() => {
        if (pendingSave === save) {
          return platform.localStorage.write(WALLPAPERS_STORAGE_KEY, wallpaper);
        }
      })
      .catch((error: unknown) =>
        console.error("Failed to save wallpaper", error),
      );
    pendingSave = save;

    void save.then(() => {
      if (pendingSave !== save) return;
      pendingSave = undefined;
      refresh();
    });
  };
}
