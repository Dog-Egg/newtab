// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { Profiler, StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BrowserBookmarkNode } from "../launcher/bookmark-tree";
import { initializeBookmarks, useBookmarksStore } from "./bookmarks";
import {
  initializeBookmarkNavigation,
  useBookmarkNavigationStore,
} from "./bookmark-navigation";
import { useBookmarkLifecycle } from "./use-bookmark-lifecycle";

const api = vi.hoisted(() => ({
  read: vi.fn(),
  subscribe: vi.fn(),
  readUsage: vi.fn(),
  record: vi.fn(),
}));
vi.mock("@platform", () => ({
  platform: {
    bookmarks: { read: api.read, subscribe: api.subscribe },
    bookmarkUsage: { read: api.readUsage, record: api.record },
  },
}));

const tree: BrowserBookmarkNode[] = [
  {
    type: "folder",
    id: "root",
    title: "Root",
    children: [
      {
        type: "folder",
        id: "folder",
        title: "Folder",
        children: [
          {
            type: "item",
            id: "link",
            title: "Link",
            url: "https://example.com",
          },
        ],
      },
    ],
  },
];
let onChange: () => void;
let unsubscribe: ReturnType<typeof vi.fn>;
let disposers: (() => void)[];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  disposers = [];
  unsubscribe = vi.fn();
  api.subscribe.mockImplementation((callback) => {
    onChange = callback;
    return unsubscribe;
  });
  api.readUsage.mockResolvedValue({ entries: {} });
  api.read.mockResolvedValue(tree);
});
afterEach(() => {
  cleanup();
  disposers.reverse().forEach((dispose) => dispose());
  vi.useRealTimers();
});
async function initialize() {
  disposers.push(initializeBookmarks(), initializeBookmarkNavigation());
  await Promise.resolve();
}

it("navigates to a search result and restarts its highlight timeout", async () => {
  await initialize();
  const { revealBookmark } = useBookmarkNavigationStore.getState();
  revealBookmark("link");
  expect(useBookmarkNavigationStore.getState()).toMatchObject({
    activeRootId: "root",
    openFolderId: "folder",
    navigationVersion: 1,
  });
  vi.advanceTimersByTime(600);
  revealBookmark("link");
  vi.advanceTimersByTime(300);
  expect(
    useBookmarkNavigationStore.getState().revealedBookmark?.bookmarkId,
  ).toBe("link");
  vi.advanceTimersByTime(600);
  expect(useBookmarkNavigationStore.getState().revealedBookmark).toBeNull();
});

it("falls back when the current folder or root is deleted", async () => {
  await initialize();
  useBookmarkNavigationStore.getState().navigateToFolder("folder");
  api.read.mockResolvedValue([{ ...tree[0], children: [] }]);
  onChange();
  await Promise.resolve();
  expect(useBookmarkNavigationStore.getState().openFolderId).toBeNull();
  api.read.mockResolvedValue([]);
  onChange();
  await Promise.resolve();
  expect(useBookmarkNavigationStore.getState().activeRootId).toBe("");
});

it("ignores out-of-order refreshes and pending reads after disposal", async () => {
  await initialize();
  let resolveFirst!: (value: BrowserBookmarkNode[]) => void;
  api.read
    .mockReturnValueOnce(
      new Promise<BrowserBookmarkNode[]>((resolve) => {
        resolveFirst = resolve;
      }),
    )
    .mockResolvedValueOnce([]);
  onChange();
  onChange();
  await Promise.resolve();
  resolveFirst(tree);
  await Promise.resolve();
  expect(useBookmarksStore.getState().bookmarkTree).toEqual([]);
  let resolveLast!: (value: BrowserBookmarkNode[]) => void;
  api.read.mockReturnValueOnce(
    new Promise<BrowserBookmarkNode[]>((resolve) => {
      resolveLast = resolve;
    }),
  );
  onChange();
  disposers.forEach((dispose) => dispose());
  disposers = [];
  resolveLast(tree);
  await Promise.resolve();
  expect(useBookmarksStore.getState().bookmarkTree).toEqual([]);
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("keeps action-only consumers from rendering on data or navigation changes", async () => {
  await initialize();
  const onRender = vi.fn();
  function Actions() {
    useBookmarksStore((state) => state.recordBookmarkClick);
    useBookmarkNavigationStore((state) => state.revealBookmark);
    return null;
  }
  render(
    <Profiler id="actions" onRender={onRender}>
      <Actions />
    </Profiler>,
  );
  await act(async () => {
    useBookmarkNavigationStore.getState().revealBookmark("link");
    api.read.mockResolvedValue([]);
    onChange();
  });
  expect(onRender).toHaveBeenCalledOnce();
});

function Startup() {
  const isLoaded = useBookmarkLifecycle();
  return <span>{isLoaded ? "ready" : "loading"}</span>;
}

it("loads initial bookmarks inside the store and cleans up StrictMode subscriptions", async () => {
  const listeners = new Set<() => void>();
  api.subscribe.mockImplementation((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  let resolveTree!: (value: BrowserBookmarkNode[]) => void;
  api.read.mockReturnValue(
    new Promise<BrowserBookmarkNode[]>((resolve) => {
      resolveTree = resolve;
    }),
  );
  const view = render(
    <StrictMode>
      <Startup />
    </StrictMode>,
  );
  expect(view.container.textContent).toBe("loading");
  expect(listeners.size).toBe(1);
  await act(async () => resolveTree(tree));
  expect(view.container.textContent).toBe("ready");
  expect(useBookmarksStore.getState().bookmarkTree).toEqual(tree);
  expect(useBookmarkNavigationStore.getState().activeRootId).toBe("root");
  view.unmount();
  expect(listeners.size).toBe(0);
});

it("finishes startup with an empty tree when the initial read fails", async () => {
  const error = new Error("Unavailable");
  const reportError = vi.spyOn(console, "error").mockImplementation(() => {});
  api.read.mockRejectedValue(error);
  try {
    const view = render(<Startup />);
    await act(async () => {});
    expect(view.container.textContent).toBe("ready");
    expect(useBookmarksStore.getState().bookmarkTree).toEqual([]);
    expect(reportError).toHaveBeenCalledWith(
      "Failed to refresh browser bookmarks",
      error,
    );
  } finally {
    reportError.mockRestore();
  }
});
