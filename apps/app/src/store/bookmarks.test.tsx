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
import {
  parseBookmarkUsage,
  recordBookmarkUsage,
} from "../launcher/bookmark-usage";

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
  await act(async () => {});
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
  await act(async () => {});
  expect(useBookmarkNavigationStore.getState().openFolderId).toBeNull();
  api.read.mockResolvedValue([]);
  onChange();
  await act(async () => {});
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
  await act(async () => {});
  resolveFirst(tree);
  await act(async () => {});
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
  await act(async () => {});
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

it("waits for delayed usage so the dock ranking exists when startup finishes", async () => {
  let resolveUsage!: (value: ReturnType<typeof parseBookmarkUsage>) => void;
  api.readUsage.mockReturnValue(
    new Promise<ReturnType<typeof parseBookmarkUsage>>((resolve) => {
      resolveUsage = resolve;
    }),
  );
  const readyRankings: string[][] = [];
  const unsubscribeReady = useBookmarksStore.subscribe((state) => {
    if (state.isLoaded)
      readyRankings.push(state.topBookmarks.map((item) => item.id));
  });
  try {
    const view = render(<Startup />);
    await act(async () => {});
    expect(useBookmarksStore.getState().bookmarkTree).toEqual([]);
    expect(view.container.textContent).toBe("loading");
    expect(readyRankings).toEqual([]);

    await act(async () => {
      resolveUsage(
        recordBookmarkUsage(parseBookmarkUsage(undefined), { id: "link" }, 0),
      );
    });
    expect(view.container.textContent).toBe("ready");
    expect(readyRankings).toEqual([["link"]]);
  } finally {
    unsubscribeReady();
  }
});

it("finishes startup without a dock if the usage read fails", async () => {
  const error = new Error("Usage unavailable");
  const reportError = vi.spyOn(console, "error").mockImplementation(() => {});
  api.readUsage.mockRejectedValue(error);
  try {
    const view = render(<Startup />);
    await act(async () => {});
    expect(view.container.textContent).toBe("ready");
    expect(useBookmarksStore.getState().bookmarkTree).toEqual(tree);
    expect(useBookmarksStore.getState().topBookmarks).toEqual([]);
    expect(reportError).toHaveBeenCalledWith(
      "Failed to read bookmark usage",
      error,
    );
  } finally {
    reportError.mockRestore();
  }
});

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("publishes one complete startup snapshot after catching up with bookmark changes", async () => {
  const usage = deferred<ReturnType<typeof parseBookmarkUsage>>();
  const catchUp = deferred<BrowserBookmarkNode[]>();
  const latestTree = [{ ...tree[0], title: "Latest root" }];
  api.readUsage.mockReturnValue(usage.promise);
  const view = render(<Startup />);
  await act(async () => {});
  const snapshots: ReturnType<typeof useBookmarksStore.getState>[] = [];
  const stopObserving = useBookmarksStore.subscribe((state) =>
    snapshots.push(state),
  );
  try {
    api.read.mockReturnValueOnce(catchUp.promise).mockResolvedValue(latestTree);
    await act(async () => {
      onChange();
      onChange();
      usage.resolve(
        recordBookmarkUsage(parseBookmarkUsage(undefined), { id: "link" }, 0),
      );
    });
    expect(api.read).toHaveBeenCalledTimes(2);
    expect(view.container.textContent).toBe("loading");
    expect(snapshots).toEqual([]);
    await act(async () => {
      onChange();
      catchUp.resolve([]);
    });
    expect(api.read).toHaveBeenCalledTimes(3);
    expect(view.container.textContent).toBe("ready");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      isLoaded: true,
      bookmarkTree: latestTree,
      topBookmarks: [{ id: "link" }],
    });
    expect(useBookmarkNavigationStore.getState().activeRootId).toBe("root");
    expect(api.readUsage).toHaveBeenCalledOnce();
  } finally {
    stopObserving();
  }
});

it("preserves the ready snapshot when a later refresh fails", async () => {
  await initialize();
  const snapshot = useBookmarksStore.getState();
  const error = new Error("Refresh unavailable");
  const reportError = vi.spyOn(console, "error").mockImplementation(() => {});
  api.read.mockRejectedValue(error);
  try {
    await act(async () => onChange());
    expect(useBookmarksStore.getState()).toBe(snapshot);
    expect(snapshot.isLoaded).toBe(true);
    expect(reportError).toHaveBeenCalledWith(
      "Failed to refresh browser bookmarks",
      error,
    );
  } finally {
    reportError.mockRestore();
  }
});

it("ignores a disposed startup when its usage read finishes after a new startup", async () => {
  const oldUsage = deferred<ReturnType<typeof parseBookmarkUsage>>();
  api.readUsage.mockReturnValueOnce(oldUsage.promise);
  const oldView = render(<Startup />);
  await act(async () => {});
  oldView.unmount();
  const newView = render(<Startup />);
  await act(async () => {});
  const snapshot = useBookmarksStore.getState();
  expect(newView.container.textContent).toBe("ready");
  await act(async () => {
    oldUsage.resolve(
      recordBookmarkUsage(parseBookmarkUsage(undefined), { id: "link" }, 0),
    );
  });
  expect(useBookmarksStore.getState()).toBe(snapshot);
  expect(api.read).toHaveBeenCalledTimes(2);
});
