import { describe, expect, it } from "vitest";
import { searchEngineSettingsSchema } from "./schema";

describe("searchEngineSettingsSchema", () => {
  it("returns empty settings when the stored value is not an object", () => {
    expect(searchEngineSettingsSchema.parse(undefined)).toEqual({});
    expect(searchEngineSettingsSchema.parse([])).toEqual({});
  });

  it("falls back invalid fields without discarding valid fields", () => {
    expect(
      searchEngineSettingsSchema.parse({
        selectedEngineId: 123,
        hiddenDefaultEngineIds: "google",
        customEngines: [
          {
            id: "duckduckgo",
            name: "DuckDuckGo",
            urlFormat: "https://duckduckgo.com/?q=%s",
          },
        ],
      }),
    ).toEqual({
      selectedEngineId: undefined,
      hiddenDefaultEngineIds: undefined,
      customEngines: [
        {
          id: "duckduckgo",
          name: "DuckDuckGo",
          urlFormat: "https://duckduckgo.com/?q=%s",
        },
      ],
    });
  });

  it("discards invalid array members without discarding valid members", () => {
    expect(
      searchEngineSettingsSchema.parse({
        hiddenDefaultEngineIds: ["google", null, "bing"],
        customEngines: [
          null,
          {
            id: "duckduckgo",
            name: "DuckDuckGo",
            urlFormat: "https://duckduckgo.com/?q=%s",
          },
          { id: "invalid", name: 123, urlFormat: null },
        ],
      }),
    ).toEqual({
      hiddenDefaultEngineIds: ["google", "bing"],
      customEngines: [
        {
          id: "duckduckgo",
          name: "DuckDuckGo",
          urlFormat: "https://duckduckgo.com/?q=%s",
        },
      ],
    });
  });

  it("normalizes custom engines and discards blank ones", () => {
    expect(
      searchEngineSettingsSchema.parse({
        customEngines: [
          {
            id: "duckduckgo",
            name: "  DuckDuckGo  ",
            urlFormat: "  https://duckduckgo.com/?q=%s  ",
          },
          { id: "", name: "Invalid", urlFormat: "https://example.com" },
          { id: "blank", name: "   ", urlFormat: "https://example.com" },
        ],
      }),
    ).toEqual({
      customEngines: [
        {
          id: "duckduckgo",
          name: "DuckDuckGo",
          urlFormat: "https://duckduckgo.com/?q=%s",
        },
      ],
    });
  });
});
