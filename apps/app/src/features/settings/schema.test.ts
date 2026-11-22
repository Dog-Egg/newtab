import { describe, expect, it } from "vitest";
import { DEFAULT_LAUNCHER_NODE_SCALE } from "../launcher/node-scale";
import { settingsSchema } from "./schema";

describe("settingsSchema", () => {
  it("returns field defaults when the stored value is not an object", () => {
    const settings = settingsSchema.parse(undefined);

    expect(settings).toMatchObject({
      nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
    });
  });

  it("falls back invalid fields without discarding valid fields", () => {
    const settings = settingsSchema.parse({
      locale: "zh-CN",
      nodeScale: "invalid-scale",
    });

    expect(settings).toMatchObject({
      locale: "zh-CN",
      nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
    });
  });

  it("discards legacy wallpaper fields while keeping general settings", () => {
    expect(
      settingsSchema.parse({
        locale: "zh-CN",
        nodeScale: 1.2,
        wallpaperUrl: "https://example.com/wallpaper",
        wallpaperColor: "#0f766e",
        wallpaperOverlayOpacity: 0.6,
      }),
    ).toEqual({
      locale: "zh-CN",
      nodeScale: 1.2,
    });
  });
});
