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
import { MainDialogPortal } from "../components/Dialog";
import type { StoredSearchEngineSettings } from "./schema";

const { search, storage, errorToast } = vi.hoisted(() => ({
  search: {
    defaultEngineId: "_default_",
    browserSearch: vi.fn<() => Promise<void>>() as
      (() => Promise<void>) | undefined,
  },
  storage: {
    read: vi.fn<() => Promise<StoredSearchEngineSettings>>(),
    save: vi.fn<() => Promise<void>>(),
  },
  errorToast: vi.fn(),
}));
vi.mock("@platform", () => ({
  platform: { search, searchEngineSettings: storage },
}));
vi.mock("sonner", () => ({ toast: { error: errorToast } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
function translate(key: string, values?: { name?: string }) {
  return values?.name ? `${key} ${values.name}` : key;
}
vi.mock("../Launcher/BookmarkProvider", () => ({
  useBookmarks: () => ({ bookmarks: [] }),
}));
vi.mock("../Launcher/BookmarkNavigationProvider", () => ({
  useBookmarkNavigation: () => ({ revealBookmark: vi.fn() }),
}));
vi.mock("../components/SiteIcon", () => ({ SiteIcon: () => <span /> }));

beforeEach(() => {
  vi.clearAllMocks();
  search.defaultEngineId = "_default_";
  search.browserSearch = vi.fn().mockResolvedValue(undefined);
  storage.read.mockResolvedValue({});
  storage.save.mockResolvedValue(undefined);
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
    expect((screen.getByRole("combobox") as HTMLInputElement).disabled).toBe(
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
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
}

describe("search engine interaction", () => {
  it("waits for preferences and restores an existing selection", async () => {
    let resolve!: (value: StoredSearchEngineSettings) => void;
    storage.read.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    mount();
    expect((screen.getByRole("combobox") as HTMLInputElement).disabled).toBe(
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
      expect(storage.save).toHaveBeenCalledWith({ selectedEngineId: "bing" }),
    );
  });

  it("keeps web presets and custom engines without browser default", async () => {
    search.defaultEngineId = "google";
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
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "bing" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    submitSearch("temporary");
    expect(window.open).toHaveBeenCalledWith(
      "https://www.bing.com/search?q=temporary",
      "_parent",
      "noreferrer",
    );
    expect(storage.save).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Backspace" });
    submitSearch();
    expect(search.browserSearch).toHaveBeenCalledWith("hello");
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
    expect(storage.save).toHaveBeenCalledWith({
      selectedEngineId: "legacy",
      customEngines: [{ ...legacy, urlFormat: "https://example.com/?q=%s" }],
    });
  });

  it("adds a custom engine, keeps the draft after failure and prevents duplicate saves", async () => {
    let resolve!: () => void;
    storage.save.mockRejectedValueOnce(new Error("write failed"));
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
    storage.save.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const button = within(dialog).getByRole("button", { name: "common.save" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(storage.save).toHaveBeenCalledTimes(2);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const saved = storage.save.mock.calls[1] as unknown as [
      StoredSearchEngineSettings,
    ];
    expect(saved[0].customEngines).toHaveLength(1);
    expect(saved[0].customEngines?.[0]).not.toHaveProperty("kind");
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
    expect(storage.save).toHaveBeenLastCalledWith({
      selectedEngineId: "_default_",
      hiddenDefaultEngineIds: ["google"],
      customEngines: [],
    });
  });
  it("keeps legacy entries when saving another selection and reports a failed selection save", async () => {
    const legacy = { id: "legacy", name: "Legacy", urlFormat: "invalid" };
    storage.read.mockResolvedValue({ customEngines: [legacy] });
    storage.save.mockRejectedValue(new Error("write failed"));
    mount();
    await ready();
    await openSelector();
    fireEvent.click(screen.getByRole("button", { name: "Bing" }));
    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith("search.saveFailed"),
    );
    expect(storage.save).toHaveBeenCalledWith({
      selectedEngineId: "bing",
      customEngines: [legacy],
    });
    expect(
      screen.getByRole("button", { name: "search.selectEngine Bing" }),
    ).toBeTruthy();
  });

  it("deletes a selected custom engine and keeps at least one engine on the web", async () => {
    search.defaultEngineId = "google";
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
    search.defaultEngineId = "google";
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
    expect(storage.save).toHaveBeenLastCalledWith({
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
    search.defaultEngineId = "google";
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
    expect(storage.save).toHaveBeenLastCalledWith({
      selectedEngineId: "google",
      customEngines: [],
      hiddenDefaultEngineIds: undefined,
    });
  });
});
