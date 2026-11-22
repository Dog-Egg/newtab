import { platform } from "@platform";
import { create } from "zustand";
import { wallpapersSchema, type StoredWallpaper } from "./schema";

type WallpapersStore = {
  wallpaper: StoredWallpaper;
  updateWallpaper: (update: Partial<StoredWallpaper>) => void;
};

async function createWallpapersStore() {
  const initialWallpaper = await platform.wallpapers
    .read()
    .catch((error: unknown) => {
      console.error("Failed to read wallpaper", error);
      return wallpapersSchema.parse(undefined);
    });
  let pendingSave: Promise<void> | undefined;
  let readRevision = 0;

  const store = create<WallpapersStore>()((set, get) => ({
    wallpaper: initialWallpaper,
    updateWallpaper: (update) => {
      const current = get().wallpaper;
      const { url, overlayOpacity } = { ...current, ...update };
      if (url === current.url && overlayOpacity === current.overlayOpacity)
        return;

      const wallpaper =
        url === undefined ? { overlayOpacity } : { url, overlayOpacity };
      // Keep rapid slider updates ordered and skip snapshots superseded before their write.
      const save = (pendingSave ?? Promise.resolve())
        .then(() => {
          if (pendingSave === save) return platform.wallpapers.save(wallpaper);
        })
        .catch((error: unknown) =>
          console.error("Failed to save wallpaper", error),
        );
      pendingSave = save;
      set({ wallpaper });

      void save.then(() => {
        if (pendingSave !== save) return;
        pendingSave = undefined;
        refreshFromStorage();
      });
    },
  }));

  function refreshFromStorage() {
    if (pendingSave) return;

    const revision = ++readRevision;
    void platform.wallpapers.read().then(
      (wallpaper) => {
        if (!pendingSave && revision === readRevision)
          store.setState({ wallpaper });
      },
      (error: unknown) => console.error("Failed to read wallpaper", error),
    );
  }

  platform.wallpapers.subscribe(refreshFromStorage);
  return store;
}

export const useWallpapersStore = await createWallpapersStore();
