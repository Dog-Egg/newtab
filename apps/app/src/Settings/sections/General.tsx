import { platform } from "@platform";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_LAUNCHER_NODE_SCALE,
  MAX_LAUNCHER_NODE_SCALE,
  MIN_LAUNCHER_NODE_SCALE,
  type Settings,
} from "../schema";
import { useSettingsStore } from "../store";
import { SettingsRange } from "../SettingsRange";

function LauncherSizeSettings() {
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

export function GeneralSettings() {
  const { t } = useTranslation();
  const locale = useSettingsStore((state) => state.locale);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  return (
    <div className="divide-y divide-white/10">
      <section
        className="pb-5 sm:pb-6"
        aria-labelledby="language-settings-title"
      >
        <h3
          id="language-settings-title"
          className="text-sm font-medium text-glass-strong"
        >
          {t("settings.language")}
        </h3>
        <div className="relative mt-3">
          <select
            id="settings-language"
            className="h-10 w-full appearance-none rounded-xl border border-glass-border bg-white/10 py-0 pl-3 pr-11 text-sm font-medium text-glass-strong outline-none transition hover:bg-glass-hover focus-visible:border-glass-focus focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
            value={locale ?? platform.defaultLocale}
            aria-labelledby="language-settings-title"
            onChange={(event) =>
              updateSettings({
                locale: event.currentTarget.value as Settings["locale"],
              })
            }
          >
            <option value="en">{t("settings.english")}</option>
            <option value="zh-CN">{t("settings.chinese")}</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-glass-content"
            aria-hidden="true"
          />
        </div>
      </section>

      <LauncherSizeSettings />
    </div>
  );
}
