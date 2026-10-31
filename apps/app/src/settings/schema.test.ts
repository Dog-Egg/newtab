import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAUNCHER_NODE_SCALE,
  DEFAULT_WALLPAPER_OVERLAY_OPACITY,
  settingsSchema,
  wallpaperColorSchema,
  wallpaperUrlSchema,
} from "./schema";

describe("settingsSchema", () => {
  it("returns field defaults when the stored value is not an object", () => {
    const settings = settingsSchema.parse(undefined);

    expect(settings).toMatchObject({
      nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
      wallpaperOverlayOpacity: DEFAULT_WALLPAPER_OVERLAY_OPACITY,
    });
    expect(settings.wallpaperUrl).toBeUndefined();
    expect(settings.wallpaperColor).toBeUndefined();
  });

  it("falls back invalid fields without discarding valid fields", () => {
    const settings = settingsSchema.parse({
      locale: "zh-CN",
      wallpaperUrl: "invalid-url",
      wallpaperColor: "not-a-color",
      nodeScale: "invalid-scale",
      wallpaperOverlayOpacity: 0.6,
    });

    expect(settings).toMatchObject({
      locale: "zh-CN",
      nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
      wallpaperOverlayOpacity: 0.6,
    });
    expect(settings.wallpaperUrl).toBeUndefined();
    expect(settings.wallpaperColor).toBeUndefined();
  });

  it("migrates legacy null wallpaper values to undefined", () => {
    const settings = settingsSchema.parse({
      wallpaperUrl: null,
      wallpaperColor: null,
    });

    expect(settings.wallpaperUrl).toBeUndefined();
    expect(settings.wallpaperColor).toBeUndefined();
  });

  it("fills missing fields and normalizes stored wallpaper URLs", () => {
    expect(
      settingsSchema.parse({
        wallpaperUrl: " https://example.com/wallpaper ",
        wallpaperColor: " #0f766e ",
      }),
    ).toEqual({
      wallpaperUrl: "https://example.com/wallpaper",
      wallpaperColor: "#0F766E",
      nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
      wallpaperOverlayOpacity: DEFAULT_WALLPAPER_OVERLAY_OPACITY,
    });
  });

  it("validates wallpaper values through the shared schemas", () => {
    expect(wallpaperUrlSchema.parse(" https://example.com/wallpaper ")).toBe(
      "https://example.com/wallpaper",
    );
    expect(() =>
      wallpaperUrlSchema.parse("ftp://example.com/wallpaper"),
    ).toThrow();
    expect(wallpaperColorSchema.parse(" #0f766e ")).toBe("#0F766E");
    expect(() => wallpaperColorSchema.parse("not-a-color")).toThrow();
  });
});
