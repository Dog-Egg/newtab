import { createContext, useContext, type ReactNode } from "react";

const DEFAULT_LAUNCHER_NODE_SCALE = 1;
export const MIN_LAUNCHER_NODE_SCALE = 0.75;
export const MAX_LAUNCHER_NODE_SCALE = 1.5;
export const LAUNCHER_NODE_SCALE_STEP = 0.01;
export const LAUNCHER_SETTINGS_STORAGE_KEY = "launcherSettings";

export type LauncherSettings = {
  nodeScale: number;
};

export function normalizeLauncherSettings(value: unknown): LauncherSettings {
  const nodeScale =
    value && typeof value === "object" && "nodeScale" in value
      ? Number(value.nodeScale)
      : DEFAULT_LAUNCHER_NODE_SCALE;

  return {
    nodeScale: Number.isFinite(nodeScale)
      ? Math.min(
          MAX_LAUNCHER_NODE_SCALE,
          Math.max(MIN_LAUNCHER_NODE_SCALE, nodeScale),
        )
      : DEFAULT_LAUNCHER_NODE_SCALE,
  };
}

const LauncherSettingsContext = createContext<LauncherSettings>({
  nodeScale: DEFAULT_LAUNCHER_NODE_SCALE,
});

export function LauncherSettingsProvider({
  settings,
  children,
}: {
  settings: LauncherSettings;
  children: ReactNode;
}) {
  return (
    <LauncherSettingsContext.Provider value={settings}>
      {children}
    </LauncherSettingsContext.Provider>
  );
}

export function useLauncherSettings() {
  return useContext(LauncherSettingsContext);
}
