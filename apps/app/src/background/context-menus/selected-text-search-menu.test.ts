import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSelectedTextSearchMenu,
  handleSelectedTextSearchMenuClick,
} from "./selected-text-search-menu";
const { createMenu, getStorage } = vi.hoisted(() => ({
  createMenu: vi.fn().mockResolvedValue(undefined),
  getStorage: vi.fn().mockResolvedValue({}),
}));
vi.mock("./chrome", () => ({
  createContextMenuItem: createMenu,
  getLocalStorage: getStorage,
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
const click = (engineId: string, selectionText = "  中文 & test  ") =>
  handleSelectedTextSearchMenuClick({
    menuItemId: `search-selected-text:engine:${engineId}`,
    selectionText,
    editable: false,
  });
describe("selected text search", () => {
  it.each(["en", "zh-CN"] as const)(
    "lists browser default before the restored engines (%s)",
    async (locale) => {
      await createSelectedTextSearchMenu({}, locale);
      expect(createMenu).toHaveBeenCalledTimes(4);
      expect(createMenu.mock.calls[1][0]).toMatchObject({
        id: "search-selected-text:engine:_default_",
        parentId: "search-selected-text",
        title:
          locale === "zh-CN"
            ? "浏览器默认搜索引擎"
            : "Browser default search engine",
      });
    },
  );
  it("routes browser default to Chrome and explicit engines to their URL", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", { search: { query }, tabs: { create } });
    expect(click("_default_")).toBe(true);
    await vi.waitFor(() =>
      expect(query).toHaveBeenCalledExactlyOnceWith({
        text: "中文 & test",
        disposition: "NEW_TAB",
      }),
    );
    expect(create).not.toHaveBeenCalled();
    expect(click("bing")).toBe(true);
    await vi.waitFor(() =>
      expect(create).toHaveBeenCalledExactlyOnceWith({
        url: `https://www.bing.com/search?q=${encodeURIComponent("中文 & test")}`,
      }),
    );
    expect(query).toHaveBeenCalledOnce();
  });
  it("keeps an invalid legacy engine in the menu but never opens its URL", async () => {
    const entry = {
      id: "legacy",
      name: "Legacy",
      urlFormat: "javascript:alert(1)",
    };
    const stored = { "search-engine-settings": { customEngines: [entry] } };
    await createSelectedTextSearchMenu(stored, "en");
    expect(createMenu).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Legacy" }),
    );
    getStorage.mockResolvedValueOnce(stored);
    const create = vi.fn();
    const query = vi.fn();
    vi.stubGlobal("chrome", { tabs: { create }, search: { query } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    click("legacy");
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
    expect(create).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("ignores unrelated menus, missing engines and blank selections", async () => {
    const query = vi.fn();
    const create = vi.fn();
    vi.stubGlobal("chrome", { search: { query }, tabs: { create } });
    expect(
      handleSelectedTextSearchMenuClick({
        menuItemId: "other",
        selectionText: "test",
        editable: false,
      }),
    ).toBe(false);
    click("missing");
    click("_default_", "  ");
    await vi.waitFor(() => expect(getStorage).toHaveBeenCalledTimes(2));
    expect(query).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
