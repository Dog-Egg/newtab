import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BROWSER_DEFAULT_ENGINE,
  buildSearchUrl,
  PRESET_SEARCH_ENGINES,
  getAvailableSearchEngines,
  submitSearch,
} from "./search-engine-utils";

describe("buildSearchUrl", () => {
  it.each([
    [
      "https://example.com/search#results",
      "https://example.com/search?q=hello+%E4%B8%96%E7%95%8C#results",
    ],
    [
      "https://example.com/search?lang=zh&q=old#results",
      "https://example.com/search?lang=zh&q=hello+%E4%B8%96%E7%95%8C#results",
    ],
    [
      "https://example.com/search?lang=zh",
      "https://example.com/search?lang=zh&q=hello+%E4%B8%96%E7%95%8C",
    ],
  ])(
    "adds the query before fragments and replaces an existing q: %s",
    (template, expected) => {
      expect(buildSearchUrl(template, "hello 世界")).toBe(expected);
    },
  );
  it("encodes selected text before replacing the search placeholder", () => {
    expect(
      buildSearchUrl("https://example.com/search?q=%s", "hello 世界"),
    ).toBe("https://example.com/search?q=hello%20%E4%B8%96%E7%95%8C");
  });
});

describe("getAvailableSearchEngines", () => {
  it("keeps preset engines on the web without a browser-default option", () => {
    expect(getAvailableSearchEngines({}, false)).toEqual(PRESET_SEARCH_ENGINES);
    expect(
      getAvailableSearchEngines(
        { hiddenDefaultEngineIds: ["google", "bing"] },
        false,
      ),
    ).toEqual([PRESET_SEARCH_ENGINES[0]]);
  });
  it("returns the default engines when no settings are stored", () => {
    expect(getAvailableSearchEngines({})).toEqual([
      BROWSER_DEFAULT_ENGINE,
      ...PRESET_SEARCH_ENGINES,
    ]);
  });

  it("excludes hidden defaults and includes custom engines", () => {
    expect(
      getAvailableSearchEngines({
        hiddenDefaultEngineIds: ["bing"],
        customEngines: [
          {
            id: "duckduckgo",
            name: "DuckDuckGo",
            urlFormat: "https://duckduckgo.com/?q=%s",
          },
        ],
      }),
    ).toEqual([
      BROWSER_DEFAULT_ENGINE,
      PRESET_SEARCH_ENGINES[0],
      {
        kind: "url",
        id: "duckduckgo",
        name: "DuckDuckGo",
        urlFormat: "https://duckduckgo.com/?q=%s",
      },
    ]);
  });

  it("uses a customized default engine in its original position", () => {
    expect(
      getAvailableSearchEngines({
        customEngines: [
          {
            id: "google",
            name: "Google Images",
            urlFormat: "https://www.google.com/search?tbm=isch&q=%s",
          },
        ],
      }),
    ).toEqual([
      BROWSER_DEFAULT_ENGINE,
      {
        kind: "url",
        id: "google",
        name: "Google Images",
        urlFormat: "https://www.google.com/search?tbm=isch&q=%s",
      },
      PRESET_SEARCH_ENGINES[1],
    ]);
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("browser-default search", () => {
  it("does not silently use browser default when an explicit engine has no URL", async () => {
    const query = vi.fn();
    // Exercise the runtime guard for malformed data that bypasses the schema.
    const result = submitSearch(
      // @ts-expect-error Explicit engines must have a URL.
      { kind: "url", id: "broken", name: "Broken" },
      "test",
      {
        browserSearch: query,
      },
    );
    await expect(result).rejects.toThrow("Invalid search engine URL");
    expect(query).not.toHaveBeenCalled();
  });
  it("always keeps browser default first despite hidden or customized legacy entries", () => {
    expect(
      getAvailableSearchEngines({
        hiddenDefaultEngineIds: ["_default_", "google", "bing"],
        customEngines: [
          {
            id: "_default_",
            name: "Fake",
            urlFormat: "https://example.com",
          },
        ],
      }),
    ).toEqual([BROWSER_DEFAULT_ENGINE]);
  });
  it("routes browser default through the platform API and explicit engines to their URL", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    await submitSearch(BROWSER_DEFAULT_ENGINE, "  hello 世界  ", {
      browserSearch: query,
    });
    expect(query).toHaveBeenCalledExactlyOnceWith("hello 世界");
    expect(open).not.toHaveBeenCalled();
    await submitSearch(PRESET_SEARCH_ENGINES[1], "hello 世界", {
      browserSearch: query,
    });
    expect(open).toHaveBeenCalledExactlyOnceWith(
      "https://www.bing.com/search?q=hello%20%E4%B8%96%E7%95%8C",
      "_parent",
      "noreferrer",
    );
    await submitSearch(BROWSER_DEFAULT_ENGINE, "  ", { browserSearch: query });
    expect(query).toHaveBeenCalledOnce();
  });
});
