import { describe, expect, it } from "vitest";
import {
  buildSearchUrl,
  DEFAULT_SEARCH_ENGINES,
  getAvailableSearchEngines,
} from "./searchEngineUtils";

describe("buildSearchUrl", () => {
  it("encodes selected text before replacing the search placeholder", () => {
    expect(
      buildSearchUrl("https://example.com/search?q=%s", "hello 世界"),
    ).toBe("https://example.com/search?q=hello%20%E4%B8%96%E7%95%8C");
  });
});

describe("getAvailableSearchEngines", () => {
  it("returns the default engines when no settings are stored", () => {
    expect(getAvailableSearchEngines({})).toEqual(DEFAULT_SEARCH_ENGINES);
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
      DEFAULT_SEARCH_ENGINES[0],
      {
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
      {
        id: "google",
        name: "Google Images",
        urlFormat: "https://www.google.com/search?tbm=isch&q=%s",
      },
      DEFAULT_SEARCH_ENGINES[1],
    ]);
  });
});
