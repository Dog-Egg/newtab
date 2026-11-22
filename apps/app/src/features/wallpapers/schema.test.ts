import { describe, expect, it } from "vitest";
import { DEFAULT_OVERLAY_OPACITY, wallpapersSchema } from "./schema";

describe("wallpapersSchema", () => {
  it("defaults to the built-in image and overlay when storage is empty", () => {
    expect(wallpapersSchema.parse(undefined)).toEqual({
      overlayOpacity: DEFAULT_OVERLAY_OPACITY,
    });
  });

  it("normalizes image URLs and keeps only wallpaper settings", () => {
    expect(
      wallpapersSchema.parse({
        url: " https://example.com/image ",
        overlayOpacity: 0.6,
        source: "gallery",
      }),
    ).toEqual({ url: "https://example.com/image", overlayOpacity: 0.6 });
  });

  it("defaults invalid values independently", () => {
    expect(
      wallpapersSchema.parse({
        url: "ftp://example.com/image",
        overlayOpacity: 0.6,
      }),
    ).toMatchObject({ url: undefined, overlayOpacity: 0.6 });
    expect(
      wallpapersSchema.parse({
        url: "https://example.com/image",
        overlayOpacity: 1,
      }),
    ).toEqual({
      url: "https://example.com/image",
      overlayOpacity: DEFAULT_OVERLAY_OPACITY,
    });
  });
});
