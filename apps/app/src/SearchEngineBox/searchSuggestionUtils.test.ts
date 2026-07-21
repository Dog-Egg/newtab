import { describe, expect, it } from "vitest";
import type { ShortcutCategory } from "../Launcher/launcher";
import { findSearchSuggestions } from "./searchSuggestionUtils";

const categories: ShortcutCategory[] = [
  {
    id: "default",
    name: "Default",
    shortcuts: [
      {
        type: "item",
        id: "design-docs",
        title: "Product Design Documents",
        url: "https://docs.example.com/design",
        createdAt: 1,
      },
      {
        type: "item",
        id: "dashboard",
        title: "Dashboard",
        url: "https://portal.example.com/dashboard",
        createdAt: 2,
      },
      {
        type: "item",
        id: "design-system",
        title: "Design System",
        url: "https://ui.example.com",
        createdAt: 3,
      },
      {
        type: "item",
        id: "cloudflare-access",
        title: "Internal Gateway",
        url: "https://myteam.cloudflareaccess.com/",
        createdAt: 4,
      },
      {
        type: "item",
        id: "cloudflare",
        title: "Public Website",
        url: "https://cloudflare.com/",
        createdAt: 5,
      },
    ],
  },
];

function findShortcuts(input: string) {
  return findSearchSuggestions({
    engines: [],
    categories,
    input,
    selectedEngineId: "",
    temporaryEngineId: null,
  }).map((suggestion) => {
    if (suggestion.type !== "shortcut") {
      throw new Error("Expected a shortcut suggestion");
    }
    return suggestion.shortcut;
  });
}

function findShortcutSuggestions(input: string) {
  return findSearchSuggestions({
    engines: [],
    categories,
    input,
    selectedEngineId: "",
    temporaryEngineId: null,
  }).map((suggestion) => {
    if (suggestion.type !== "shortcut") {
      throw new Error("Expected a shortcut suggestion");
    }
    return suggestion;
  });
}

describe("findSearchSuggestions shortcut matching", () => {
  it("matches text contained anywhere in a shortcut title", () => {
    expect(findShortcuts("documents").map((shortcut) => shortcut.id)).toEqual([
      "design-docs",
    ]);
  });

  it("matches titles case-insensitively after trimming the input", () => {
    expect(
      findShortcuts("  DOCUMENTS  ").map((shortcut) => shortcut.id),
    ).toEqual(["design-docs"]);
  });

  it("prioritizes title matches that occur earlier", () => {
    expect(findShortcuts("design").map((shortcut) => shortcut.id)).toEqual([
      "design-system",
      "design-docs",
    ]);
  });

  it("matches prefixes at the start of any non-TLD hostname segment", () => {
    expect(
      findShortcuts("portal.example").map((shortcut) => shortcut.id),
    ).toEqual(["dashboard"]);
    expect(findShortcuts("cloud").map((shortcut) => shortcut.id)).toEqual([
      "cloudflare-access",
      "cloudflare",
    ]);
    expect(findShortcuts("example.com/dashboard")).toEqual([]);
  });

  it("does not match a URL by its top-level domain", () => {
    expect(findShortcuts("com")).toEqual([]);
  });

  it("returns the exact title match range used by the renderer", () => {
    expect(findShortcutSuggestions("documents")[0].matches).toEqual({
      title: [{ start: 15, length: 9 }],
      domain: [],
    });
  });

  it("returns domain ranges for matches in different hostname segments", () => {
    expect(
      findShortcutSuggestions("cloud").map((suggestion) => ({
        id: suggestion.shortcut.id,
        matches: suggestion.matches,
      })),
    ).toEqual([
      {
        id: "cloudflare-access",
        matches: {
          title: [],
          domain: [{ start: 7, length: 5 }],
        },
      },
      {
        id: "cloudflare",
        matches: {
          title: [],
          domain: [{ start: 0, length: 5 }],
        },
      },
    ]);
  });
});
