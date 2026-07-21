import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { platform } from "@platform";
import { normalizeSettings, type Settings } from "./settings";
import i18n from "../i18n";

type SettingsContextValue = {
  settings: Settings;
  previewSettings: (update: SettingsUpdate) => void;
  updateSettings: (update: SettingsUpdate) => void;
};

type SettingsUpdate =
  Partial<Settings> | ((currentSettings: Settings) => Partial<Settings>);

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyLocale(locale: Settings["locale"]) {
  document.documentElement.lang = locale;
  void i18n.changeLanguage(locale);
}

export function SettingsProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings: Settings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const settingsRef = useRef(settings);

  const applySettingsUpdate = useCallback((update: SettingsUpdate) => {
    const currentSettings = settingsRef.current;
    const patch =
      typeof update === "function" ? update(currentSettings) : update;
    const normalizedSettings = normalizeSettings({
      ...currentSettings,
      ...patch,
    });
    settingsRef.current = normalizedSettings;
    applyLocale(normalizedSettings.locale);
    setSettings(normalizedSettings);
    return normalizedSettings;
  }, []);

  useEffect(() => {
    const unsubscribe = platform.settings.subscribe((storedSettings) => {
      settingsRef.current = storedSettings;
      applyLocale(storedSettings.locale);
      setSettings(storedSettings);
    });
    return unsubscribe;
  }, []);

  const updateSettings = useCallback(
    (update: SettingsUpdate) => {
      const normalizedSettings = applySettingsUpdate(update);
      void platform.settings
        .save(normalizedSettings)
        .catch((error: unknown) => {
          console.error("Failed to save settings", error);
        });
    },
    [applySettingsUpdate],
  );

  return (
    <SettingsContext.Provider
      value={{ settings, previewSettings: applySettingsUpdate, updateSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
