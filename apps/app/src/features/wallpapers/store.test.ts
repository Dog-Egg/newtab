import { expect, it, vi } from "vitest";
import { DEFAULT_OVERLAY_OPACITY, type StoredWallpaper } from "./schema";

const storage = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("@platform", () => ({ platform: { localStorage: storage } }));

it("preserves the latest URL and overlay during overlapping storage writes", async () => {
  let stored: StoredWallpaper = { overlayOpacity: DEFAULT_OVERLAY_OPACITY };
  let notifyStorageChange: (() => void) | undefined;
  storage.read.mockImplementation(async () => stored);
  storage.subscribe.mockImplementation((_key: string, onChange: () => void) => {
    notifyStorageChange = onChange;
  });
  let finishFirstSave: (() => void) | undefined;
  storage.write.mockImplementationOnce(
    (_key: string, wallpaper: StoredWallpaper) =>
      new Promise<void>((resolve) => {
        finishFirstSave = () => {
          stored = wallpaper;
          notifyStorageChange?.();
          resolve();
        };
      }),
  );
  storage.write.mockImplementation(
    async (_key: string, wallpaper: StoredWallpaper) => {
      stored = wallpaper;
      notifyStorageChange?.();
    },
  );

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
  expect(storage.write).toHaveBeenCalledTimes(2);
  expect(storage.read).toHaveBeenCalledWith("wallpapers");
  expect(storage.write).toHaveBeenLastCalledWith("wallpapers", {
    url,
    overlayOpacity: 0.7,
  });
  expect(storage.subscribe).toHaveBeenCalledWith(
    "wallpapers",
    expect.any(Function),
  );

  updateWallpaper({ url: undefined, overlayOpacity: DEFAULT_OVERLAY_OPACITY });
  await vi.waitFor(() =>
    expect(stored).toEqual({ overlayOpacity: DEFAULT_OVERLAY_OPACITY }),
  );
});
