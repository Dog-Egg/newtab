import { create } from "zustand";
import {
  getHistoryEntry,
  recordWallpaper,
  type WallpaperHistory,
} from "./history";
import { DEFAULT_WALLPAPER_URL, preloadWallpaper } from "./preload-wallpaper";
import { DEFAULT_OVERLAY_OPACITY, type StoredWallpaper } from "./schema";
import { readInitialWallpaper, syncWallpaperStorage } from "./storage";

type ImageInput = "gallery" | "custom";
type HistoryStep = -1 | 1;

type WallpaperSelection =
  | { input: ImageInput; url: string }
  | { input: "history"; url: StoredWallpaper["url"]; index: number };

type ImageApplication = WallpaperSelection & { status: "loading" | "error" };

type WallpapersStore = {
  wallpaper: StoredWallpaper;
  history: WallpaperHistory;
  imageApplication: ImageApplication | null;
  applyImage: (url: string, input: ImageInput) => void;
  navigateHistory: (step: HistoryStep) => void;
  restoreDefaultWallpaper: () => void;
  updateWallpaper: (update: Partial<StoredWallpaper>) => void;
};

function getNavigationTarget(
  { history, imageApplication }: WallpapersStore,
  step: HistoryStep,
) {
  const index =
    imageApplication?.input === "history" &&
    imageApplication.status === "loading"
      ? imageApplication.index
      : history.index;

  return getHistoryEntry(history, index + step);
}

export function canNavigateHistory(state: WallpapersStore, step: HistoryStep) {
  return getNavigationTarget(state, step) !== null;
}

async function createWallpapersStore() {
  const initialWallpaper = await readInitialWallpaper();
  const store = create<WallpapersStore>()((_set, get) => ({
    wallpaper: initialWallpaper,
    history: { urls: [initialWallpaper.url], index: 0 },
    imageApplication: null,
    applyImage: (url, input) => {
      const { imageApplication } = get();
      if (
        imageApplication?.status === "loading" &&
        imageApplication.input !== "history" &&
        imageApplication.url === url
      ) {
        return;
      }

      selectWallpaper({ url, input });
    },
    navigateHistory: (step) => {
      const target = getNavigationTarget(get(), step);
      if (target) selectWallpaper({ ...target, input: "history" });
    },
    restoreDefaultWallpaper: () =>
      updateWallpaper(
        { url: undefined, overlayOpacity: DEFAULT_OVERLAY_OPACITY },
        null,
      ),
    updateWallpaper: (update) =>
      updateWallpaper(update, get().imageApplication),
  }));

  const saveWallpaper = syncWallpaperStorage((wallpaper) => {
    const { history, imageApplication } = store.getState();
    const nextHistory = recordWallpaper(history, wallpaper.url);

    store.setState({
      wallpaper,
      history: nextHistory,
      imageApplication:
        nextHistory !== history && imageApplication?.input === "history"
          ? null
          : imageApplication,
    });
  });

  function selectWallpaper(selection: WallpaperSelection) {
    if (selection.url === store.getState().wallpaper.url) {
      applySelection(selection);
      return;
    }

    const application: ImageApplication = { ...selection, status: "loading" };
    store.setState({ imageApplication: application });
    void preloadWallpaper(selection.url ?? DEFAULT_WALLPAPER_URL).then(
      (loaded) => {
        if (store.getState().imageApplication !== application) return;

        if (loaded) applySelection(selection);
        else
          store.setState({
            imageApplication: { ...application, status: "error" },
          });
      },
    );
  }

  function applySelection(selection: WallpaperSelection) {
    const { wallpaper, history } = store.getState();
    const { url } = selection;
    const nextHistory =
      selection.input === "history"
        ? { ...history, index: selection.index }
        : recordWallpaper(history, url);

    commitWallpaper({ ...wallpaper, url }, nextHistory, null);
  }

  function updateWallpaper(
    update: Partial<StoredWallpaper>,
    imageApplication: ImageApplication | null,
  ) {
    const { wallpaper, history } = store.getState();
    const nextWallpaper = { ...wallpaper, ...update };
    commitWallpaper(
      nextWallpaper,
      recordWallpaper(history, nextWallpaper.url),
      imageApplication,
    );
  }

  function commitWallpaper(
    { url, overlayOpacity }: StoredWallpaper,
    history: WallpaperHistory,
    imageApplication: ImageApplication | null,
  ) {
    const { wallpaper: current } = store.getState();
    let wallpaper = current;
    if (url !== current.url || overlayOpacity !== current.overlayOpacity) {
      wallpaper =
        url === undefined ? { overlayOpacity } : { url, overlayOpacity };
      saveWallpaper(wallpaper);
    }
    store.setState({ wallpaper, history, imageApplication });
  }

  return store;
}

export const useWallpapersStore = await createWallpapersStore();
