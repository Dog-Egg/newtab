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

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (update: SettingsUpdate) => void;
};

type SettingsUpdate =
  Partial<Settings> | ((currentSettings: Settings) => Partial<Settings>);

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() =>
    normalizeSettings(undefined),
  );
  const settingsRef = useRef(settings);
  const localUpdateVersionRef = useRef(0);

  useEffect(() => {
    let isCurrent = true;
    const initialUpdateVersion = localUpdateVersionRef.current;
    void platform.settings.read().then(
      (storedSettings) => {
        if (
          isCurrent &&
          localUpdateVersionRef.current === initialUpdateVersion
        ) {
          settingsRef.current = storedSettings;
          setSettings(storedSettings);
        }
      },
      (error: unknown) => {
        console.error("Failed to read settings", error);
      },
    );
    const unsubscribe = platform.settings.subscribe((storedSettings) => {
      settingsRef.current = storedSettings;
      setSettings(storedSettings);
    });
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  const updateSettings = useCallback((update: SettingsUpdate) => {
    const currentSettings = settingsRef.current;
    const patch =
      typeof update === "function" ? update(currentSettings) : update;
    const normalizedSettings = normalizeSettings({
      ...currentSettings,
      ...patch,
    });
    localUpdateVersionRef.current += 1;
    settingsRef.current = normalizedSettings;
    setSettings(normalizedSettings);
    void platform.settings.save(normalizedSettings).catch((error: unknown) => {
      console.error("Failed to save settings", error);
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
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
