import * as z from "zod/mini";

import {
  DEFAULT_LAUNCHER_NODE_SCALE,
  MAX_LAUNCHER_NODE_SCALE,
  MIN_LAUNCHER_NODE_SCALE,
} from "../launcher/node-scale";

export const SETTINGS_STORAGE_KEY = "settings";

export const settingsSchema = z.pipe(
  z.transform((value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {},
  ),
  z.object({
    locale: z.catch(z.optional(z.enum(["en", "zh-CN"])), undefined),
    nodeScale: z.catch(
      z
        .number()
        .check(
          z.minimum(MIN_LAUNCHER_NODE_SCALE),
          z.maximum(MAX_LAUNCHER_NODE_SCALE),
        ),
      DEFAULT_LAUNCHER_NODE_SCALE,
    ),
  }),
);

export type Settings = z.infer<typeof settingsSchema>;
