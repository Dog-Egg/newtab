import { describe, expect, it } from "vitest";
import {
  customEngineDraftSchema,
  customEngineSchema,
  searchEngineSchema,
  searchEngineSettingsSchema,
} from "./schema";

describe("custom engine validation", () => {
  it.each([
    "https://example.com/search?q=%s",
    "http://localhost:8080/search/%s",
    "https://example.com/search",
  ])("accepts and trims a search template: %s", (urlFormat) => {
    expect(
      customEngineDraftSchema.parse({
        name: "  Custom  ",
        urlFormat: `  ${urlFormat}  `,
      }),
    ).toEqual({ name: "Custom", urlFormat });
  });

  it.each([
    "",
    "   ",
    "example.com",
    "/search?q=%s",
    "javascript:alert(1)",
    "ftp://example.com",
  ])("rejects an invalid search URL: %s", (urlFormat) => {
    expect(
      customEngineDraftSchema.safeParse({ name: "Custom", urlFormat }).success,
    ).toBe(false);
  });

  it("requires a name and a URL for custom engines, while allowing the browser default without a URL", () => {
    expect(
      customEngineDraftSchema.safeParse({
        name: " ",
        urlFormat: "https://example.com",
      }).success,
    ).toBe(false);
    const browserDefault = {
      kind: "browser",
      id: "_default_",
      name: "Browser default",
    };
    expect(searchEngineSchema.safeParse(browserDefault).success).toBe(true);
    expect(customEngineSchema.safeParse(browserDefault).success).toBe(false);
    expect(
      searchEngineSchema.safeParse({ id: "custom", name: "Custom" }).success,
    ).toBe(false);
    expect(
      customEngineSchema.safeParse({
        ...browserDefault,
        urlFormat: "https://example.com?q=%s",
      }).success,
    ).toBe(false);
    expect(
      searchEngineSchema.safeParse({
        kind: "url",
        id: "_default_",
        name: "Invalid",
        urlFormat: "https://example.com?q=%s",
      }).success,
    ).toBe(false);
  });

  it("retains legacy URLs for editing", () => {
    const valid = {
      id: "custom",
      name: "Custom",
      urlFormat: "https://example.com?q=%s",
    };
    expect(
      searchEngineSettingsSchema.parse({
        customEngines: [
          { ...valid, id: "invalid", urlFormat: "javascript:alert(1)" },
          valid,
        ],
      }).customEngines,
    ).toEqual([
      { ...valid, id: "invalid", urlFormat: "javascript:alert(1)" },
      valid,
    ]);
  });
});

describe("searchEngineSettingsSchema", () => {
  it("uses default settings when the stored value is not an object", () => {
    expect(searchEngineSettingsSchema.parse(undefined)).toEqual({
      selectedEngineId: undefined,
    });
    expect(searchEngineSettingsSchema.parse([])).toEqual({
      selectedEngineId: undefined,
    });
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
      selectedEngineId: undefined,
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
      selectedEngineId: undefined,
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

describe("search engine selection", () => {
  it("preserves existing selections, custom engines and hidden engines", () => {
    const customEngines = [
      { id: "custom", name: "Custom", urlFormat: "https://example.com/?q=%s" },
    ];
    expect(
      searchEngineSettingsSchema.parse({
        selectedEngineId: "bing",
        customEngines,
        hiddenDefaultEngineIds: ["google"],
      }),
    ).toEqual({
      selectedEngineId: "bing",
      customEngines,
      hiddenDefaultEngineIds: ["google"],
    });
  });
  it("leaves the platform to choose a default", () => {
    for (const settings of [undefined, {}, { selectedEngineId: null }]) {
      expect(searchEngineSettingsSchema.parse(settings).selectedEngineId).toBe(
        undefined,
      );
    }
  });
});
