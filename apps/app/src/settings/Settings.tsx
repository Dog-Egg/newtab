import { useState } from "react";
import clsx from "clsx";
import { Image, Info, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AboutSettings, GeneralSettings } from "./sections";
import { WallpaperSettings } from "../wallpapers/WallpaperSettings";

export function Settings() {
  const { t } = useTranslation();
  const sections = [
    {
      id: "general",
      label: t("settings.general"),
      icon: SlidersHorizontal,
      component: GeneralSettings,
    },
    {
      id: "wallpaper",
      label: t("settings.wallpaper"),
      icon: Image,
      component: WallpaperSettings,
    },
    {
      id: "about",
      label: t("settings.about"),
      icon: Info,
      component: AboutSettings,
    },
  ] as const;
  const [activeSection, setActiveSection] =
    useState<(typeof sections)[number]["id"]>("general");
  const ActiveSection =
    sections.find(({ id }) => id === activeSection)?.component ??
    GeneralSettings;

  return (
    <div className="flex h-full min-h-0">
      <nav
        className="w-16 shrink-0 border-r border-glass-border bg-slate-950/10 px-2 py-4"
        aria-label={t("settings.sections")}
      >
        <div className="space-y-1.5">
          {sections.map(({ id, label, icon: Icon }) => {
            const isActive = id === activeSection;

            return (
              <button
                key={id}
                className={clsx(
                  "grid h-11 w-full place-items-center rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none",
                  isActive
                    ? "bg-white/15 text-glass-strong shadow-sm"
                    : "text-glass-content hover:bg-glass-hover hover:text-glass-strong",
                )}
                type="button"
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                title={label}
                onClick={() => setActiveSection(id)}
              >
                <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
              </button>
            );
          })}
        </div>
      </nav>

      <ActiveSection />
    </div>
  );
}
