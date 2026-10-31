import { describe, expect, it } from "vitest";
import { getHighlightedTextParts } from "./SearchSuggestion";

describe("getHighlightedTextParts", () => {
  it("highlights the supplied match ranges while preserving the original text", () => {
    expect(
      getHighlightedTextParts("Cloudflare cloud", [
        { start: 0, length: 5 },
        { start: 11, length: 5 },
      ]),
    ).toEqual([
      { text: "Cloud", isMatch: true },
      { text: "flare ", isMatch: false },
      { text: "cloud", isMatch: true },
    ]);
  });

  it("returns the original text when there is no match", () => {
    expect(getHighlightedTextParts("cloudflare.com", [])).toEqual([
      { text: "cloudflare.com", isMatch: false },
    ]);
  });
});
