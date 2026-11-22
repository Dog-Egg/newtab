// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Settings } from "../settings/Settings";
import { DEFAULT_OVERLAY_OPACITY, type StoredWallpaper } from "./schema";
import { useWallpapersStore } from "./store";
import { WallpaperBackground } from "./WallpaperBackground";

const storage = vi.hoisted((): { wallpaper?: StoredWallpaper } => ({}));
const images: HTMLImageElement[] = [];
const firstUrl = "https://example.com/first.jpg";
const secondUrl = "https://example.com/second.jpg";

vi.mock("@platform", () => ({
  platform: {
    localStorage: {
      read: async () => storage.wallpaper,
      write: async (_key: string, value: StoredWallpaper) => {
        storage.wallpaper = value;
      },
      subscribe: () => {},
    },
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../settings/sections", () => ({
  GeneralSettings: () => null,
  AboutSettings: () => null,
}));
vi.mock("./gallery/WallpaperGallery", () => ({
  WallpaperGallery: ({ onSelect }: { onSelect: (url: string) => void }) => (
    <button type="button" onClick={() => onSelect(secondUrl)}>
      Select gallery image
    </button>
  ),
}));

beforeEach(() => {
  images.length = 0;
  vi.stubGlobal("Image", function () {
    const image = document.createElement("img");
    images.push(image);
    return image;
  });
});

afterEach(async () => {
  cleanup();
  useWallpapersStore.getState().restoreDefaultWallpaper();
  await waitFor(() => expect(storage.wallpaper?.url).toBeUndefined());
  vi.unstubAllGlobals();
});

function clickButton(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function submitUrl(url: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "settings.imageUrl" }), {
    target: { value: url },
  });
  clickButton("settings.apply");
}

it("keeps loading across section changes and applies the image while the section is closed", async () => {
  render(<Settings />);
  clickButton("settings.wallpaper");
  submitUrl(firstUrl);
  clickButton("settings.general");
  clickButton("settings.wallpaper");
  expect(screen.getByRole("button", { name: "common.loading" })).toBeDefined();

  clickButton("settings.general");
  await act(async () => {
    fireEvent.error(images[0]);
  });
  clickButton("settings.wallpaper");
  expect(screen.getByRole("alert").textContent).toBe(
    "settings.imageLoadFailed",
  );
  expect(storage.wallpaper?.url).toBeUndefined();

  clickButton("settings.apply");
  clickButton("settings.general");
  await act(async () => {
    fireEvent.load(images[1]);
  });
  expect(useWallpapersStore.getState().wallpaper.url).toBe(firstUrl);
  await waitFor(() => expect(storage.wallpaper?.url).toBe(firstUrl));
});

it("preloads the replacement URL once and fades it in even if the old image loads later", async () => {
  const slowUrl = "https://example.com/slow.jpg";
  const { container } = render(
    <>
      <WallpaperBackground />
      <Settings />
    </>,
  );
  const getLayers = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>("[style*='background-image']"),
    );
  const initialBackground = getLayers()[0].style.backgroundImage;
  expect(images).toHaveLength(0);

  clickButton("settings.wallpaper");
  submitUrl(slowUrl);

  const input = screen.getByRole("textbox", { name: "settings.imageUrl" });
  fireEvent.change(input, {
    target: { value: slowUrl.replace("example.com", "EXAMPLE.COM") },
  });
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "common.loading" })
      .disabled,
  ).toBe(true);
  expect(images).toHaveLength(1);

  submitUrl(secondUrl);
  expect(images).toHaveLength(2);
  expect(images[1].src).toBe(secondUrl);

  fireEvent.change(input, { target: { value: "not a URL" } });
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "settings.apply" })
      .disabled,
  ).toBe(true);

  await act(async () => {
    fireEvent.load(images[1]);
  });
  await waitFor(() => expect(storage.wallpaper?.url).toBe(secondUrl));

  const replacementBackground = `url("${secondUrl}")`;
  const [activeLayer, fadingLayer] = getLayers();
  expect(activeLayer.style.backgroundImage).toBe(initialBackground);
  expect(fadingLayer.style.backgroundImage).toBe(replacementBackground);
  expect(images).toHaveLength(2);
  // React uses the WebKit event in jsdom, where AnimationEvent is unavailable.
  fireEvent(fadingLayer, new Event("webkitAnimationEnd", { bubbles: true }));

  await act(async () => {
    fireEvent.load(images[0]);
  });
  expect(useWallpapersStore.getState().wallpaper.url).toBe(secondUrl);
  expect(storage.wallpaper?.url).toBe(secondUrl);
  expect(getLayers().map((layer) => layer.style.backgroundImage)).toEqual([
    replacementBackground,
  ]);
});

it("discards superseded images and allows restoring defaults while the first wallpaper is loading", async () => {
  render(<Settings />);
  clickButton("settings.wallpaper");
  submitUrl(firstUrl);
  clickButton("Select gallery image");
  await act(async () => {
    fireEvent.load(images[0]);
  });
  expect(useWallpapersStore.getState().imageApplication?.url).toBe(secondUrl);

  clickButton("settings.restoreDefault");
  await act(async () => {
    fireEvent.load(images[1]);
  });
  expect(useWallpapersStore.getState().imageApplication).toBeNull();
  expect(useWallpapersStore.getState().wallpaper).toEqual({
    overlayOpacity: DEFAULT_OVERLAY_OPACITY,
  });
});
