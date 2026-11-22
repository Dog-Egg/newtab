import { expect, it, vi } from "vitest";
import { DEFAULT_OVERLAY_OPACITY, type StoredWallpaper } from "./schema";

const storage = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("@platform", () => ({ platform: { wallpapers: storage } }));

it("preserves the latest URL and overlay during overlapping storage writes", async () => {
  let stored: StoredWallpaper = { overlayOpacity: DEFAULT_OVERLAY_OPACITY };
  let notifyStorageChange: (() => void) | undefined;
  storage.read.mockImplementation(async () => stored);
  storage.subscribe.mockImplementation((onChange: () => void) => {
    notifyStorageChange = onChange;
  });
  let finishFirstSave: (() => void) | undefined;
  storage.save.mockImplementationOnce(
    (wallpaper: StoredWallpaper) =>
      new Promise<void>((resolve) => {
        finishFirstSave = () => {
          stored = wallpaper;
          notifyStorageChange?.();
          resolve();
        };
      }),
  );
  storage.save.mockImplementation(async (wallpaper: StoredWallpaper) => {
    stored = wallpaper;
    notifyStorageChange?.();
  });

  const { useWallpapersStore } = await import("./store");
  const { updateWallpaper } = useWallpapersStore.getState();
  const url = "https://example.com/image";
  updateWallpaper({ url });
  await vi.waitFor(() => expect(finishFirstSave).toBeDefined());

  updateWallpaper({ overlayOpacity: 0.6 });
  updateWallpaper({ overlayOpacity: 0.7 });
  finishFirstSave?.();
  expect(useWallpapersStore.getState().wallpaper).toEqual({
    url,
    overlayOpacity: 0.7,
  });

  await vi.waitFor(() => expect(stored).toEqual({ url, overlayOpacity: 0.7 }));
  expect(storage.save).toHaveBeenCalledTimes(2);

  updateWallpaper({ url: undefined, overlayOpacity: DEFAULT_OVERLAY_OPACITY });
  await vi.waitFor(() =>
    expect(stored).toEqual({ overlayOpacity: DEFAULT_OVERLAY_OPACITY }),
  );
});
