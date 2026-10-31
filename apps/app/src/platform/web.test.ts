import { afterEach, expect, it, vi } from "vitest";
import {
  getAvailableSearchEngines,
  submitSearch,
} from "../search-engine-box/search-engine-utils";

vi.mock("../i18n", () => ({
  default: { on: vi.fn(), addResourceBundle: vi.fn(), language: "en" },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("provides Google as the web fallback search provider", async () => {
  const open = vi.fn();
  const getItem = vi.fn();
  vi.stubGlobal("window", {
    location: { search: "" },
    open,
    sessionStorage: { getItem },
  });
  const { platform } = await import("./web");
  expect(platform.search.defaultEngineId).toBe("google");
  await submitSearch(
    getAvailableSearchEngines({}, false)[0],
    "中文 & test?#",
    platform.search,
  );
  expect(open).toHaveBeenCalledExactlyOnceWith(
    `https://www.google.com/search?q=${encodeURIComponent("中文 & test?#")}`,
    "_parent",
    "noreferrer",
  );
  expect(getItem).not.toHaveBeenCalled();
});

it("restores engine preferences, searches with the selected engine and saves edits", async () => {
  const custom = {
    id: "custom",
    name: "Custom",
    urlFormat: "https://example.com/?q=%s",
  };
  const settings = {
    selectedEngineId: "custom",
    hiddenDefaultEngineIds: ["bing"],
    customEngines: [custom],
  };
  const values = new Map([
    ["search-engine-settings", JSON.stringify(settings)],
  ]);
  const open = vi.fn();
  vi.stubGlobal("window", {
    location: { search: "" },
    open,
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  const { platform } = await import("./web");
  const restored = await platform.searchEngineSettings.read();
  expect(restored).toEqual(settings);
  const engines = getAvailableSearchEngines(restored, false);
  expect(engines.map((engine) => engine.id)).toEqual(["google", "custom"]);
  await submitSearch(
    engines.find((engine) => engine.id === restored.selectedEngineId)!,
    "中文 & test",
    platform.search,
  );
  expect(open).toHaveBeenCalledExactlyOnceWith(
    `https://example.com/?q=${encodeURIComponent("中文 & test")}`,
    "_parent",
    "noreferrer",
  );
  await platform.searchEngineSettings.save({
    ...restored,
    selectedEngineId: "google",
  });
  expect((await platform.searchEngineSettings.read()).selectedEngineId).toBe(
    "google",
  );
});
