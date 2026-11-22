import { create } from "zustand";
import { preloadWallpaper } from "./preload-wallpaper";
import {
  DEFAULT_OVERLAY_OPACITY,
  wallpapersSchema,
  type StoredWallpaper,
} from "./schema";
import { wallpaperStorage } from "./storage";

type ImageApplication = {
  url: string;
  input: "gallery" | "custom";
  status: "loading" | "error";
};

type WallpapersStore = {
  wallpaper: StoredWallpaper;
  imageApplication: ImageApplication | null;
  applyImage: (url: string, input: ImageApplication["input"]) => void;
  restoreDefaultWallpaper: () => void;
  updateWallpaper: (update: Partial<StoredWallpaper>) => void;
};

async function createWallpapersStore() {
  const initialWallpaper = await wallpaperStorage
    .read()
    .catch((error: unknown) => {
      console.error("Failed to read wallpaper", error);
      return wallpapersSchema.parse(undefined);
    });
  let pendingSave: Promise<void> | undefined;
  let readRevision = 0;

  const store = create<WallpapersStore>()((set, get) => ({
    wallpaper: initialWallpaper,
    imageApplication: null,
    applyImage: (url, input) => {
      const { imageApplication, wallpaper } = get();
      if (
        imageApplication?.status === "loading" &&
        imageApplication.url === url
      )
        return;

      if (wallpaper.url === url) {
        set({ imageApplication: null });
        return;
      }

      const application: ImageApplication = { url, input, status: "loading" };
      set({ imageApplication: application });
      void preloadWallpaper(url).then((loaded) => {
        if (get().imageApplication !== application) return;
        if (!loaded) {
          set({ imageApplication: { ...application, status: "error" } });
          return;
        }

        set({ imageApplication: null });
        get().updateWallpaper({ url });
      });
    },
    restoreDefaultWallpaper: () => {
      set({ imageApplication: null });
      get().updateWallpaper({
        url: undefined,
        overlayOpacity: DEFAULT_OVERLAY_OPACITY,
      });
    },
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
          if (pendingSave === save) return wallpaperStorage.save(wallpaper);
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
    void wallpaperStorage.read().then(
      (wallpaper) => {
        if (!pendingSave && revision === readRevision)
          store.setState({ wallpaper });
      },
      (error: unknown) => console.error("Failed to read wallpaper", error),
    );
  }

  wallpaperStorage.subscribe(refreshFromStorage);
  return store;
}

export const useWallpapersStore = await createWallpapersStore();
