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

describe("findSearchSuggestions shortcut matching", () => {
  it("matches text contained anywhere in a shortcut title", () => {
    expect(findShortcuts("design").map((shortcut) => shortcut.id)).toEqual([
      "design-docs",
    ]);
  });

  it("matches titles case-insensitively after trimming the input", () => {
    expect(
      findShortcuts("  DOCUMENTS  ").map((shortcut) => shortcut.id),
    ).toEqual(["design-docs"]);
  });

  it("continues to use prefix matching for shortcut URLs", () => {
    expect(
      findShortcuts("portal.example").map((shortcut) => shortcut.id),
    ).toEqual(["dashboard"]);
    expect(findShortcuts("example.com/dashboard")).toEqual([]);
  });
});
