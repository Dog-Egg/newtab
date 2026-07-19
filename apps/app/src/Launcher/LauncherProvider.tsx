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
import { useSettings } from "../Settings/SettingsProvider";
import type { ShortcutCategory } from "./launcher";

type LauncherContextValue = {
  categories: ShortcutCategory[];
  saveCategories: (categories: ShortcutCategory[]) => void;
};

const LauncherContext = createContext<LauncherContextValue | null>(null);

export function LauncherProvider({
  children,
  initialCategories,
}: {
  children: ReactNode;
  initialCategories: ShortcutCategory[];
}) {
  const { settings } = useSettings();
  const [categories, setCategories] = useState(initialCategories);
  const loadedLocaleRef = useRef(settings.locale);

  useEffect(() => {
    let isCurrent = true;
    const applyCategories = (storedCategories: ShortcutCategory[]) => {
      if (isCurrent) setCategories(storedCategories);
    };

    if (loadedLocaleRef.current !== settings.locale) {
      loadedLocaleRef.current = settings.locale;
      void platform.launcher
        .read(settings.locale)
        .then(applyCategories, () => undefined);
    }

    const unsubscribe = platform.launcher.subscribe(
      settings.locale,
      applyCategories,
    );
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [settings.locale]);

  const saveCategories = useCallback((nextCategories: ShortcutCategory[]) => {
    setCategories(nextCategories);
    void platform.launcher.save(nextCategories);
  }, []);

  return (
    <LauncherContext.Provider value={{ categories, saveCategories }}>
      {children}
    </LauncherContext.Provider>
  );
}

export function useLauncher() {
  const context = useContext(LauncherContext);
  if (!context) {
    throw new Error("useLauncher must be used within LauncherProvider");
  }
  return context;
}
