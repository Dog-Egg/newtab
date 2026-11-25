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
      scrollInPanel: true,
    },
    {
      id: "wallpaper",
      label: t("settings.wallpaper"),
      icon: Image,
      component: WallpaperSettings,
      scrollInPanel: false,
    },
    {
      id: "about",
      label: t("settings.about"),
      icon: Info,
      component: AboutSettings,
      scrollInPanel: true,
    },
  ] as const;
  const [activeSectionId, setActiveSectionId] =
    useState<(typeof sections)[number]["id"]>("general");
  const { component: ActiveSection, scrollInPanel } =
    sections.find(({ id }) => id === activeSectionId) ?? sections[0];

  return (
    <div className="flex h-full min-h-0">
      <nav
        className="w-16 shrink-0 border-r border-glass-border bg-slate-950/10 px-2 py-4"
        aria-label={t("settings.sections")}
      >
        <div className="space-y-1.5">
          {sections.map(({ id, label, icon: Icon }) => {
            const isActive = id === activeSectionId;

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
                onClick={() => setActiveSectionId(id)}
              >
                <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" />
              </button>
            );
          })}
        </div>
      </nav>

      <div
        key={activeSectionId}
        className={clsx(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          scrollInPanel &&
            "overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6",
        )}
      >
        <ActiveSection />
      </div>
    </div>
  );
}
