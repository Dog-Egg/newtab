import { useTranslation } from "react-i18next";
import { SettingsScrollArea } from "../SettingsScrollArea";

export function AboutSettings() {
  const { t } = useTranslation();

  return (
    <SettingsScrollArea>
      <section>
        <dl>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-glass-content">
              {t("settings.currentVersion")}
            </dt>
            <dd className="text-sm font-medium text-glass-strong">
              {__APP_VERSION__}
            </dd>
          </div>
        </dl>
      </section>
    </SettingsScrollArea>
  );
}
