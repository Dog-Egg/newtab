import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAUNCHER_NODE_SCALE,
  DEFAULT_WALLPAPER_OVERLAY_OPACITY,
  settingsSchema,
} from "./schema";

describe("settingsSchema", () => {
  it("returns field defaults when the stored value is not an object", () => {
    expect(settingsSchema.parse(undefined)).toEqual({
      wallpaperUrl: null,
      nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
      wallpaperOverlayOpacity: DEFAULT_WALLPAPER_OVERLAY_OPACITY,
    });
  });

  it("falls back invalid fields without discarding valid fields", () => {
    expect(
      settingsSchema.parse({
        locale: "zh-CN",
        wallpaperUrl: "invalid-url",
        nodeScale: "invalid-scale",
        wallpaperOverlayOpacity: 0.6,
      }),
    ).toEqual({
      locale: "zh-CN",
      wallpaperUrl: null,
      nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
      wallpaperOverlayOpacity: 0.6,
    });
  });

  it("fills missing fields and normalizes stored wallpaper URLs", () => {
    expect(
      settingsSchema.parse({
        wallpaperUrl: " https://example.com/wallpaper ",
      }),
    ).toEqual({
      wallpaperUrl: "https://example.com/wallpaper",
      nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
      wallpaperOverlayOpacity: DEFAULT_WALLPAPER_OVERLAY_OPACITY,
    });
  });
});
