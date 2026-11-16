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
import { BookmarkProvider } from "./BookmarkProvider";
import { BookmarkDock } from "./BookmarkDock";
import { BookmarkLink } from "./BookmarkLink";
import {
  parseBookmarkUsage,
  recordBookmarkUsage,
  type BookmarkUsage,
} from "./bookmark-usage";
import type { BrowserBookmarkItem } from "./bookmark-tree";

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
let onTree: () => void;
beforeEach(() => {
  vi.clearAllMocks();
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
  vi.restoreAllMocks();
});
function mount(bookmarks = [bookmark]) {
  return render(
    <BookmarkProvider initialBookmarks={bookmarks}>
      <BookmarkLink bookmark={bookmark} />
      <BookmarkDock />
    </BookmarkProvider>,
  );
}

describe("bookmark dock integration", () => {
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
    render(
      <BookmarkProvider initialBookmarks={[bookmark]}>
        <BookmarkLink
          bookmark={bookmark}
          onClick={(event) => event.preventDefault()}
          onAuxClick={(event) => event.preventDefault()}
        />
      </BookmarkProvider>,
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
