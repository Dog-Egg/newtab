import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../settings/store";
import { SettingsRange } from "../settings/settings-range/SettingsRange";
import {
  DEFAULT_LAUNCHER_NODE_SCALE,
  MAX_LAUNCHER_NODE_SCALE,
  MIN_LAUNCHER_NODE_SCALE,
} from "./node-scale";

export function LauncherSizeSettings() {
  const { t } = useTranslation();
  const nodeScale = useSettingsStore((state) => state.nodeScale);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  return (
    <section className="space-y-3 py-5 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <label
          className="text-sm font-medium text-glass-strong"
          htmlFor="launcher-node-size"
        >
          {t("settings.iconSize")}
        </label>
      </div>
      <SettingsRange
        id="launcher-node-size"
        min={MIN_LAUNCHER_NODE_SCALE}
        max={MAX_LAUNCHER_NODE_SCALE}
        step={0.01}
        value={nodeScale}
        ariaLabel={t("settings.iconSize")}
        minLabel={t("settings.small")}
        maxLabel={t("settings.large")}
        defaultValue={DEFAULT_LAUNCHER_NODE_SCALE}
        onChange={(nodeScale) => updateSettings({ nodeScale })}
      />
    </section>
  );
}
