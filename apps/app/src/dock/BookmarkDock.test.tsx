// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeBookmarks } from "../store/bookmarks";
import { BookmarkDock } from "./BookmarkDock";
import { BookmarkLink } from "../components/BookmarkLink";
import {
  parseBookmarkUsage,
  recordBookmarkUsage,
  type BookmarkUsage,
} from "../launcher/bookmark-usage";
import type { BrowserBookmarkItem } from "../launcher/bookmark-tree";

const api = vi.hoisted(() => ({
  read: vi.fn(),
  record: vi.fn(),
  readTree: vi.fn(),
  subscribeTree: vi.fn(),
}));
vi.mock("@platform", () => ({
  platform: {
    bookmarkUsage: {
      read: api.read,
      record: api.record,
    },
    bookmarks: { read: api.readTree, subscribe: api.subscribeTree },
  },
}));
vi.mock("../components/SiteIcon", () => ({ SiteIcon: () => <span /> }));
const bookmark: BrowserBookmarkItem = {
  type: "item",
  id: "a",
  title: "Example",
  url: "https://example.com/",
};
let saved: BookmarkUsage;
let disposeBookmarks: (() => void) | undefined;
let onTree: () => void;
let availableWidth: number;
let itemWidth: number;
let gap: number;
let resizeDock: () => void;
const disconnectObserver = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  availableWidth = 1000;
  itemWidth = 60;
  gap = 20;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.tagName === "LI" ? itemWidth : availableWidth,
      } as DOMRect;
    },
  );
  const getStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = getStyle(element);
    if (element.tagName === "UL") {
      Object.defineProperty(style, "columnGap", { value: `${gap}px` });
    }
    return style;
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeDock = callback;
      }
      observe() {
        resizeDock();
      }
      disconnect = disconnectObserver;
    },
  );
  saved = parseBookmarkUsage(undefined);
  api.read.mockImplementation(async () => saved);
  api.subscribeTree.mockImplementation((listener) => {
    onTree = listener;
    return vi.fn();
  });
  api.record.mockImplementation(async (id: string) => {
    saved = recordBookmarkUsage(saved, { id }, Date.now());
    return saved;
  });
});
afterEach(() => {
  cleanup();
  disposeBookmarks?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount(bookmarks = [bookmark]) {
  disposeBookmarks?.();
  api.readTree.mockResolvedValue(bookmarks);
  disposeBookmarks = initializeBookmarks();
  return render(
    <>
      <BookmarkLink bookmark={bookmark} />
      <BookmarkDock />
    </>,
  );
}

describe("bookmark dock integration", () => {
  it("fits a single row to available space, respects scaling and caps at ten", async () => {
    const bookmarks = Array.from({ length: 12 }, (_, i) => ({
      ...bookmark,
      id: String(i).padStart(2, "0"),
      title: `Bookmark ${i}`,
    }));
    for (const item of bookmarks) {
      saved = recordBookmarkUsage(saved, item, 0);
    }
    const view = mount(bookmarks);
    const dock = await screen.findByRole("navigation");
    const titles = () =>
      [...dock.querySelectorAll("a")].map((link) => link.textContent);
    expect(titles()).toEqual(bookmarks.slice(0, 10).map((item) => item.title));

    for (const [width, expectedCount] of [
      [780, 10],
      [779, 9],
      [460, 6],
      [459, 5],
      [780, 10],
    ]) {
      availableWidth = width;
      act(() => resizeDock());
      expect(titles()).toEqual(
        bookmarks.slice(0, expectedCount).map((item) => item.title),
      );
    }

    gap = 12;
    availableWidth = 296; // A 320px viewport after horizontal padding.
    act(() => resizeDock());
    expect(titles()).toHaveLength(4);
    itemWidth = 90; // 1.5x icon scale.
    act(() => resizeDock());
    expect(titles()).toHaveLength(3);
    view.unmount();
    expect(disconnectObserver).toHaveBeenCalled();
  });

  it("starts hidden, records primary and middle clicks once, and restores persisted ranking", async () => {
    const view = mount();
    await waitFor(() => expect(api.read).toHaveBeenCalled());
    expect(screen.queryByRole("navigation")).toBeNull();
    document.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(screen.getByRole("link", { name: "Example" }));
    expect(screen.queryByRole("navigation")).toBeNull();
    view.unmount();
    const reopened = mount();
    const dock = await screen.findByRole("navigation");
    expect(dock.querySelectorAll("a")).toHaveLength(1);
    fireEvent(
      dock.querySelector("a")!,
      new MouseEvent("auxclick", { button: 1, bubbles: true }),
    );
    fireEvent(
      dock.querySelector("a")!,
      new MouseEvent("auxclick", { button: 2, bubbles: true }),
    );
    expect(api.record.mock.calls).toEqual([["a"], ["a"]]);
    expect(saved.entries.a.score).toBeCloseTo(2, 4);
    reopened.unmount();
    mount();
    expect(await screen.findByRole("navigation")).toBeTruthy();
  });

  it("keeps the current dock order until the app is reopened", async () => {
    const other = { ...bookmark, id: "b", title: "Other" };
    const now = Date.now();
    saved = recordBookmarkUsage(saved, bookmark, now);
    saved = recordBookmarkUsage(saved, bookmark, now);
    saved = recordBookmarkUsage(saved, other, now);
    const view = mount([bookmark, other]);
    const dock = await screen.findByRole("navigation");
    const titles = () =>
      [...dock.querySelectorAll("a")].map((link) => link.textContent);
    expect(titles()).toEqual(["Example", "Other"]);
    for (let i = 0; i < 2; i++) {
      fireEvent(
        dock.querySelectorAll("a")[1],
        new MouseEvent("auxclick", { button: 1, bubbles: true }),
      );
    }
    expect(saved.entries.b.score).toBeCloseTo(3, 4);
    expect(titles()).toEqual(["Example", "Other"]);
    expect(api.read).toHaveBeenCalledTimes(1);
    view.unmount();
    mount([bookmark, other]);
    const nextDock = await screen.findByRole("navigation");
    expect(
      [...nextDock.querySelectorAll("a")].map((link) => link.textContent),
    ).toEqual(["Other", "Example"]);
  });

  it("removes deleted bookmarks from the dock when the browser tree changes", async () => {
    saved = recordBookmarkUsage(saved, bookmark, Date.now());
    mount();
    await screen.findByRole("navigation");
    api.readTree.mockResolvedValue([]);
    await act(async () => onTree());
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeNull());
    expect(api.read).toHaveBeenCalledTimes(1);
  });

  it("does not count an activation cancelled by the caller", async () => {
    api.readTree.mockResolvedValue([bookmark]);
    disposeBookmarks = initializeBookmarks();
    render(
      <BookmarkLink
        bookmark={bookmark}
        onClick={(event) => event.preventDefault()}
        onAuxClick={(event) => event.preventDefault()}
      />,
    );
    const link = screen.getByRole("link", { name: "Example" });
    fireEvent.click(link);
    fireEvent(
      link,
      new MouseEvent("auxclick", {
        button: 1,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(api.record).not.toHaveBeenCalled();
  });
});
