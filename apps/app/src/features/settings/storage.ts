import { platform } from "@platform";
import { SETTINGS_STORAGE_KEY, settingsSchema, type Settings } from "./schema";

export const settingsStorage = {
  read: async () => {
    try {
      return settingsSchema.parse(
        await platform.preferencesStorage.read(SETTINGS_STORAGE_KEY),
      );
    } catch (error: unknown) {
      console.error("Failed to read settings", error);
      return settingsSchema.parse(undefined);
    }
  },
  save: (settings: Settings) =>
    platform.preferencesStorage.write(SETTINGS_STORAGE_KEY, settings),
  subscribe: (onChange: (settings: Settings) => void) =>
    platform.preferencesStorage.subscribe(SETTINGS_STORAGE_KEY, (value) =>
      onChange(settingsSchema.parse(value)),
    ),
};
