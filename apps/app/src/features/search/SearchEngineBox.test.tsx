// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchEngineBox } from "./SearchEngineBox";
import { MainDialogPortal } from "../../components/Dialog";
import type { StoredSearchEngineSettings } from "./schema";
import { SEARCH_ENGINE_SETTINGS_KEY } from "./storage";
import type { BrowserBookmarkItem } from "../../bookmarks/bookmark-tree";

const { search, storage, errorToast, bookmarkState } = vi.hoisted(() => ({
  bookmarkState: {
    bookmarks: [] as BrowserBookmarkItem[],
    recordBookmarkClick: vi.fn(),
  },
  search: {
    browserSearch: vi.fn<() => Promise<void>>() as
      (() => Promise<void>) | undefined,
  },
  storage: {
    read: vi.fn<(key: string) => Promise<StoredSearchEngineSettings>>(),
    write:
      vi.fn<
        (key: string, settings: StoredSearchEngineSettings) => Promise<void>
      >(),
  },
  errorToast: vi.fn(),
}));
vi.mock("@platform", () => ({
  platform: { search, preferencesStorage: storage },
}));
vi.mock("sonner", () => ({ toast: { error: errorToast } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
function translate(key: string, values?: { name?: string }) {
  return values?.name ? `${key} ${values.name}` : key;
}
vi.mock("../../bookmarks/store", () => ({
  useBookmarksStore: (selector: (state: typeof bookmarkState) => unknown) =>
    selector(bookmarkState),
}));
vi.mock("../launcher/bookmark-navigation-store", () => ({
  useBookmarkNavigationStore: (
    selector: (state: { revealBookmark: ReturnType<typeof vi.fn> }) => unknown,
  ) => selector({ revealBookmark: vi.fn() }),
}));
vi.mock("../../components/SiteIcon", () => ({ SiteIcon: () => <span /> }));

beforeEach(() => {
  vi.clearAllMocks();
  bookmarkState.bookmarks = [];
  search.browserSearch = vi.fn().mockResolvedValue(undefined);
  storage.read.mockResolvedValue({});
  storage.write.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(window, "open").mockImplementation(() => null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount() {
  return render(
    <>
      <MainDialogPortal />
      <SearchEngineBox />
    </>,
  );
}
async function ready() {
  await waitFor(() =>
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      false,
    ),
  );
}
async function openSelector() {
  fireEvent.click(screen.getByRole("button", { name: /^search.selectEngine/ }));
  await screen.findByRole("group", { name: "search.engines" });
}
async function actions(name: string, action: "edit" | "delete") {
  await openSelector();
  fireEvent.click(
    screen.getByRole("button", { name: `search.moreActionsFor ${name}` }),
  );
  const item = await screen.findByRole("menuitem", {
    name: `common.${action}`,
  });
  fireEvent.click(item);
}
function submitSearch(text = "hello") {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("search engine interaction", () => {
  it("records search result clicks, middle clicks and keyboard opens, but not locate actions", async () => {
    bookmarkState.bookmarks = [
      {
        type: "item",
        id: "github",
        title: "GitHub",
        url: "https://github.com/",
      },
    ];
    mount();
    await ready();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "github" } });
    const link = await screen.findByRole("link", { name: /GitHub/ });
    // Keep the test document in place after the normal link event.
    document.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(link);
    fireEvent(link, new MouseEvent("auxclick", { button: 1, bubbles: true }));
    fireEvent(link, new MouseEvent("auxclick", { button: 2, bubbles: true }));
    expect(bookmarkState.recordBookmarkClick.mock.calls).toEqual([
      ["github"],
      ["github"],
    ]);
    fireEvent.keyDown(input, { key: "Tab" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(bookmarkState.recordBookmarkClick).toHaveBeenCalledTimes(3);
    expect(window.open).toHaveBeenCalledWith(
      "https://github.com/",
      "_parent",
      "noreferrer",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "search.locateBookmark GitHub" }),
    );
    expect(bookmarkState.recordBookmarkClick).toHaveBeenCalledTimes(3);
  });
  it("waits for preferences and restores an existing selection", async () => {
    let resolve!: (value: StoredSearchEngineSettings) => void;
    storage.read.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    mount();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      true,
    );
    await act(async () => resolve({ selectedEngineId: "bing" }));
    await ready();
    submitSearch();
    expect(window.open).toHaveBeenCalledWith(
      "https://www.bing.com/search?q=hello",
      "_parent",
      "noreferrer",
    );
  });

  it("uses browser default without preferences and persists a different selection", async () => {
    mount();
    await ready();
    submitSearch();
    expect(search.browserSearch).toHaveBeenCalledWith("hello");
    await openSelector();
    fireEvent.click(screen.getByRole("button", { name: "Bing" }));
    await waitFor(() =>
      expect(storage.write).toHaveBeenCalledWith(SEARCH_ENGINE_SETTINGS_KEY, {
        selectedEngineId: "bing",
      }),
    );
  });

  it("keeps web presets and custom engines without browser default", async () => {
    search.browserSearch = undefined;
    mount();
    await ready();
    submitSearch();
    expect(window.open).toHaveBeenCalledWith(
      "https://www.google.com/search?q=hello",
      "_parent",
      "noreferrer",
    );
    await openSelector();
    expect(screen.getByRole("button", { name: "Bing" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "search.browserDefaultName" }),
    ).toBeNull();
  });

  it("uses a temporary engine without saving the preference and clears it with Backspace", async () => {
    mount();
    await ready();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "bing" } });
    fireEvent.keyDown(input, { key: "Tab" });
    submitSearch("temporary");
    expect(window.open).toHaveBeenCalledWith(
      "https://www.bing.com/search?q=temporary",
      "_parent",
      "noreferrer",
    );
    expect(storage.write).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Backspace" });
    submitSearch();
    expect(search.browserSearch).toHaveBeenCalledWith("hello");
  });

  it("keeps editing keys native and suspends suggestions while the query has a newline", async () => {
    mount();
    await ready();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "bing" } });
    await screen.findByRole("option");

    expect(fireEvent.keyDown(input, { key: "ArrowDown" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "ArrowUp" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Enter", isComposing: true })).toBe(
      true,
    );
    expect(fireEvent.keyDown(input, { key: "Enter", shiftKey: true })).toBe(
      true,
    );
    expect(search.browserSearch).not.toHaveBeenCalled();

    // jsdom does not perform the textarea's default key insertion.
    fireEvent.change(input, { target: { value: "bing\n" } });
    expect(screen.queryByRole("option")).toBeNull();
    fireEvent.change(input, { target: { value: "bing" } });
    await screen.findByRole("option");

    submitSearch("bing\nsecond line");
    expect(search.browserSearch).toHaveBeenCalledWith("bing\nsecond line");
  });

  it("recovers from a preference read failure", async () => {
    storage.read.mockRejectedValue(new Error("storage failed"));
    mount();
    await ready();
    expect(errorToast).toHaveBeenCalledWith("search.loadFailed");
    submitSearch();
    expect(search.browserSearch).toHaveBeenCalledWith("hello");
  });

  it("preserves invalid legacy URLs, blocks searching, and repairs the engine in its editor", async () => {
    const legacy = {
      id: "legacy",
      name: "Legacy",
      urlFormat: "javascript:alert(1)",
    };
    storage.read.mockResolvedValue({
      selectedEngineId: "legacy",
      customEngines: [legacy],
    });
    mount();
    await ready();
    submitSearch();
    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith("search.invalidUrl"),
    );
    expect(window.open).not.toHaveBeenCalled();
    await actions("Legacy", "edit");
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByLabelText("search.name"),
      ),
    );
    expect(
      (within(dialog).getByLabelText("search.urlFormat") as HTMLInputElement)
        .value,
    ).toBe(legacy.urlFormat);
    fireEvent.change(within(dialog).getByLabelText("search.urlFormat"), {
      target: { value: "https://example.com/?q=%s" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.save" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(storage.write).toHaveBeenCalledWith(SEARCH_ENGINE_SETTINGS_KEY, {
      selectedEngineId: "legacy",
      customEngines: [{ ...legacy, urlFormat: "https://example.com/?q=%s" }],
    });
  });

  it("adds a custom engine, keeps the draft after failure and prevents duplicate saves", async () => {
    let resolve!: () => void;
    storage.write.mockRejectedValueOnce(new Error("write failed"));
    mount();
    await ready();
    await openSelector();
    fireEvent.click(screen.getByRole("button", { name: "search.addEngine" }));
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByLabelText("search.name");
    fireEvent.change(name, { target: { value: "Custom" } });
    fireEvent.change(within(dialog).getByLabelText("search.urlFormat"), {
      target: { value: "https://example.com/?q=%s" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.save" }),
    );
    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith("search.saveFailed"),
    );
    expect((name as HTMLInputElement).value).toBe("Custom");
    storage.write.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const button = within(dialog).getByRole("button", { name: "common.save" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(storage.write).toHaveBeenCalledTimes(2);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const [, saved] = storage.write.mock.calls[1];
    expect(saved.customEngines).toHaveLength(1);
    expect(saved.customEngines?.[0]).not.toHaveProperty("kind");
  });

  it("edits a preset and deletes the selected override with a fallback", async () => {
    storage.read.mockResolvedValue({ selectedEngineId: "google" });
    mount();
    await ready();
    await actions("Google", "edit");
    let dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("search.name"), {
      target: { value: "Images" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.save" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await actions("Images", "delete");
    dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.delete" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(storage.write).toHaveBeenLastCalledWith(SEARCH_ENGINE_SETTINGS_KEY, {
      selectedEngineId: "_default_",
      hiddenDefaultEngineIds: ["google"],
      customEngines: [],
    });
  });
  it("keeps legacy entries when saving another selection and reports a failed selection save", async () => {
    const legacy = { id: "legacy", name: "Legacy", urlFormat: "invalid" };
    storage.read.mockResolvedValue({ customEngines: [legacy] });
    storage.write.mockRejectedValue(new Error("write failed"));
    mount();
    await ready();
    await openSelector();
    fireEvent.click(screen.getByRole("button", { name: "Bing" }));
    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith("search.saveFailed"),
    );
    expect(storage.write).toHaveBeenCalledWith(SEARCH_ENGINE_SETTINGS_KEY, {
      selectedEngineId: "bing",
      customEngines: [legacy],
    });
    expect(
      screen.getByRole("button", { name: "search.selectEngine Bing" }),
    ).toBeTruthy();
  });

  it("deletes a selected custom engine and keeps at least one engine on the web", async () => {
    search.browserSearch = undefined;
    const custom = {
      id: "custom",
      name: "Custom",
      urlFormat: "https://example.com",
    };
    storage.read.mockResolvedValue({
      selectedEngineId: "custom",
      hiddenDefaultEngineIds: ["google", "bing"],
      customEngines: [custom],
    });
    mount();
    await ready();
    await openSelector();
    fireEvent.click(
      screen.getByRole("button", { name: "search.moreActionsFor Custom" }),
    );
    const item = await screen.findByRole("menuitem", { name: "common.delete" });
    expect(item.getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps edits to the web fallback when all presets were hidden", async () => {
    search.browserSearch = undefined;
    storage.read.mockResolvedValue({
      hiddenDefaultEngineIds: ["google", "bing"],
    });
    mount();
    await ready();
    await actions("Google", "edit");
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("search.name"), {
      target: { value: "Images" },
    });
    fireEvent.change(within(dialog).getByLabelText("search.urlFormat"), {
      target: { value: "https://example.com/images?q=%s" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.save" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(storage.write).toHaveBeenLastCalledWith(SEARCH_ENGINE_SETTINGS_KEY, {
      hiddenDefaultEngineIds: ["bing"],
      customEngines: [
        {
          id: "google",
          name: "Images",
          urlFormat: "https://example.com/images?q=%s",
        },
      ],
    });
    expect(
      screen.getByRole("button", { name: "search.selectEngine Images" }),
    ).toBeTruthy();
    submitSearch();
    expect(window.open).toHaveBeenCalledWith(
      "https://example.com/images?q=hello",
      "_parent",
      "noreferrer",
    );
  });

  it("deletes a custom engine with available presets and falls back to Google on the web", async () => {
    search.browserSearch = undefined;
    storage.read.mockResolvedValue({
      selectedEngineId: "custom",
      customEngines: [
        { id: "custom", name: "Custom", urlFormat: "https://example.com" },
      ],
    });
    mount();
    await ready();
    await actions("Custom", "delete");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.delete" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(storage.write).toHaveBeenLastCalledWith(SEARCH_ENGINE_SETTINGS_KEY, {
      selectedEngineId: "google",
      customEngines: [],
      hiddenDefaultEngineIds: undefined,
    });
  });
});
