// @vitest-environment jsdom
import { platform } from "@platform";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Settings } from "../settings/Settings";
import { RandomWallpaperButton } from "./RandomWallpaperButton";
import { DEFAULT_OVERLAY_OPACITY, type StoredWallpaper } from "./schema";
import { useWallpapersStore } from "./store";
import { WallpaperBackground } from "./WallpaperBackground";

const storage = vi.hoisted((): { wallpaper?: StoredWallpaper } => ({}));
const pageCountCache = vi.hoisted(() => new Map<string, unknown>());
const images: HTMLImageElement[] = [];
const firstUrl = "https://example.com/first.jpg";
const secondUrl = "https://example.com/second.jpg";
const pageCountKey = "wallhaven.toplist.1w.page-count";

vi.mock("@platform", () => ({
  platform: {
    localStorage: {
      read: async (key: string) =>
        key === "wallpapers" ? storage.wallpaper : pageCountCache.get(key),
      write: async (key: string, value: unknown) => {
        if (key === "wallpapers") storage.wallpaper = value as StoredWallpaper;
        else pageCountCache.set(key, value);
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
  pageCountCache.clear();
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
  useWallpapersStore.setState({
    history: useWallpapersStore.getInitialState().history,
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

function wallpaper(id: string) {
  return {
    id,
    path: `https://w.wallhaven.cc/full/${id.slice(0, 2)}/wallhaven-${id}.jpg`,
    resolution: "1920x1080",
    thumbs: { large: `https://th.wallhaven.cc/lg/${id}.jpg` },
  };
}

it("picks from a later popular page and reuses the total after a remount", async () => {
  const current = wallpaper("aa1111");
  const next = wallpaper("bb2222");
  const currentUrl = current.path;
  const nextUrl = next.path;
  const fetchMock = vi.fn(async (url: string) => {
    const page = new URL(url, window.location.href).searchParams.get("page");
    return Response.json({
      data: page === "3" ? [next, current] : [current],
      meta: { last_page: 3 },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(Math, "random").mockReturnValue(0.9);

  useWallpapersStore.getState().applyImage(currentUrl, "gallery");
  await act(async () => fireEvent.load(images[0]));
  const writeStorage = vi.spyOn(platform.localStorage, "write");

  const { unmount } = render(<RandomWallpaperButton />);
  const button = screen.getByRole<HTMLButtonElement>("button", {
    name: "app.randomWallpaper",
  });
  fireEvent.click(button);
  await waitFor(() => expect(images[1]?.src).toBe(nextUrl));
  expect(requestedPages(fetchMock.mock.calls)).toEqual(["1", "3"]);
  expect(
    writeStorage.mock.calls.filter(([key]) => key === pageCountKey),
  ).toHaveLength(1);
  expect(button.disabled).toBe(true);
  expect(storage.wallpaper?.url).toBe(currentUrl);

  await act(async () => fireEvent.load(images[1]));
  await waitFor(() => expect(storage.wallpaper?.url).toBe(nextUrl));
  expect(useWallpapersStore.getState().history.urls).toEqual([
    undefined,
    currentUrl,
    nextUrl,
  ]);
  expect(button.disabled).toBe(false);

  unmount();
  render(<RandomWallpaperButton />);
  fetchMock.mockClear();
  clickButton("app.randomWallpaper");
  await waitFor(() => expect(images[2]?.src).toBe(currentUrl));
  expect(requestedPages(fetchMock.mock.calls)).toEqual(["3"]);
});

function requestedPages(calls: [string][]) {
  return calls.map(([url]) =>
    new URL(url, window.location.href).searchParams.get("page"),
  );
}

it.each([
  { ageInDays: 29, pages: ["3", "1"] },
  { ageInDays: 30, pages: ["1"] },
])(
  "refreshes an outdated page count after $ageInDays days",
  async ({ ageInDays, pages }) => {
    const now = Date.now();
    pageCountCache.set(pageCountKey, {
      lastPage: 3,
      updatedAt: now - ageInDays * 24 * 60 * 60 * 1000,
    });
    const next = wallpaper(ageInDays === 29 ? "dd4444" : "ee5555");
    const fetchMock = vi.fn(async (url: string) => {
      const [page] = requestedPages([[url]]);
      if (page === "3") return new Response(null, { status: 404 });
      return Response.json({
        data: [next],
        meta: { last_page: 1 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0.9);

    render(<RandomWallpaperButton />);
    clickButton("app.randomWallpaper");
    await waitFor(() => expect(images[0]?.src).toBe(next.path));
    expect(requestedPages(fetchMock.mock.calls)).toEqual(pages);
    expect(pageCountCache.get(pageCountKey)).toEqual({
      lastPage: 1,
      updatedAt: expect.any(Number),
    });
    expect(
      (pageCountCache.get(pageCountKey) as { updatedAt: number }).updatedAt,
    ).toBeGreaterThanOrEqual(now);
  },
);

it.each([404, 200])(
  "reports no alternative when the fallback page disappears (HTTP %i)",
  async (status) => {
    const current = wallpaper(status === 404 ? "cc3333" : "gg7777");
    const fallback = wallpaper("ff6666");
    const fetchMock = vi.fn(async (url: string) => {
      const [page] = requestedPages([[url]]);
      if (page === "2") {
        return status === 404
          ? new Response(null, { status })
          : Response.json({ data: [fallback], meta: { last_page: 1 } });
      }
      return Response.json({ data: [current], meta: { last_page: 2 } });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const showError = vi.spyOn(toast, "error");

    useWallpapersStore.getState().applyImage(current.path, "gallery");
    await act(async () => fireEvent.load(images[0]));
    render(<RandomWallpaperButton />);
    clickButton("app.randomWallpaper");

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        "app.randomWallpaperEmpty",
        expect.anything(),
      ),
    );
    expect(requestedPages(fetchMock.mock.calls)).toEqual(["1", "2"]);
  },
);

it("keeps a random request across button remounts and cancels it on manual selection", async () => {
  const manualUrl = "https://example.com/manual.jpg";
  let finishRequest!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    finishRequest = resolve;
  });
  const fetchMock = vi.fn((_url: string, _options: RequestInit) => response);
  vi.stubGlobal("fetch", fetchMock);
  const showError = vi.spyOn(toast, "error");

  const { unmount } = render(<RandomWallpaperButton />);
  clickButton("app.randomWallpaper");
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const signal = fetchMock.mock.calls[0][1].signal;

  unmount();
  render(<RandomWallpaperButton />);
  const button = screen.getByRole("button", { name: "app.randomWallpaper" });
  expect(button).toHaveProperty("disabled", true);
  act(() =>
    useWallpapersStore.getState().updateWallpaper({ overlayOpacity: 0.6 }),
  );
  expect(signal?.aborted).toBe(false);

  act(() => useWallpapersStore.getState().applyImage(manualUrl, "custom"));
  expect(signal?.aborted).toBe(true);
  await act(async () => fireEvent.load(images[0]));
  await act(async () => finishRequest(new Response(null, { status: 500 })));

  expect(showError).not.toHaveBeenCalled();
  expect(useWallpapersStore.getState().wallpaper.url).toBe(manualUrl);
  expect(button).toHaveProperty("disabled", false);
});

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
  expect(useWallpapersStore.getState().imageApplication).toMatchObject({
    input: "gallery",
    status: "loading",
    url: secondUrl,
  });

  clickButton("settings.restoreDefault");
  await act(async () => {
    fireEvent.load(images[1]);
  });
  expect(useWallpapersStore.getState().imageApplication).toBeNull();
  expect(useWallpapersStore.getState().wallpaper).toEqual({
    overlayOpacity: DEFAULT_OVERLAY_OPACITY,
  });
});

it("navigates wallpaper history and replaces the forward entries after a new selection", async () => {
  const first = "https://example.com/history-first.jpg";
  const second = "https://example.com/history-second.jpg";
  const replacement = "https://example.com/history-replacement.jpg";
  const currentWallpaper = () => useWallpapersStore.getState().wallpaper;
  const latestImage = () => images[images.length - 1];
  const loadLatestImage = () => act(async () => fireEvent.load(latestImage()));
  render(<Settings />);
  clickButton("settings.wallpaper");
  const back = screen.getByRole<HTMLButtonElement>("button", {
    name: "settings.wallpaperBack",
  });
  const forward = screen.getByRole<HTMLButtonElement>("button", {
    name: "settings.wallpaperForward",
  });
  const restore = screen.getByRole<HTMLButtonElement>("button", {
    name: "settings.restoreDefault",
  });
  expect(back.disabled).toBe(true);
  expect(forward.disabled).toBe(true);
  expect(restore.disabled).toBe(true);

  submitUrl(first);
  await loadLatestImage();
  expect(restore.disabled).toBe(false);
  submitUrl(second);
  await loadLatestImage();
  fireEvent.change(
    screen.getByRole("slider", { name: "settings.imageOverlayIntensity" }),
    {
      target: { value: "0.6" },
    },
  );

  fireEvent.click(back);
  expect(currentWallpaper().url).toBe(second);
  await act(async () => fireEvent.error(latestImage()));
  expect(screen.getByRole("alert").textContent).toBe(
    "settings.imageLoadFailed",
  );
  expect(currentWallpaper().url).toBe(second);
  expect(forward.disabled).toBe(true);
  await waitFor(() => expect(storage.wallpaper?.url).toBe(second));

  fireEvent.click(back);
  await loadLatestImage();
  expect(currentWallpaper()).toEqual({ url: first, overlayOpacity: 0.6 });
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(back);
  await loadLatestImage();
  expect(currentWallpaper().url).toBeUndefined();
  expect(back.disabled).toBe(true);
  fireEvent.click(forward);
  const supersededNavigation = latestImage();
  fireEvent.click(forward);
  await act(async () => fireEvent.load(supersededNavigation));
  expect(currentWallpaper().url).toBeUndefined();
  await loadLatestImage();
  expect(currentWallpaper().url).toBe(second);
  expect(forward.disabled).toBe(true);

  submitUrl(replacement);
  const supersededSelection = latestImage();
  fireEvent.click(back);
  await act(async () => fireEvent.load(supersededSelection));
  await loadLatestImage();
  expect(currentWallpaper().url).toBe(first);
  expect(forward.disabled).toBe(false);

  submitUrl(replacement);
  await loadLatestImage();
  expect(currentWallpaper().url).toBe(replacement);
  expect(forward.disabled).toBe(true);
  await waitFor(() =>
    expect(storage.wallpaper).toEqual({
      url: replacement,
      overlayOpacity: 0.6,
    }),
  );
});
