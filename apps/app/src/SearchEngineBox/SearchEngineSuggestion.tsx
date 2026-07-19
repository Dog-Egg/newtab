import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SiteIcon } from "../components/SiteIcon";
import {
  getSearchEngineDomain,
  getSearchEngineIconSource,
  type SearchEngine,
} from "./searchEngineUtils";

export const SEARCH_ENGINE_SUGGESTIONS_ID = "search-engine-suggestions";
export function getSearchEngineSuggestionId(engineId: string) {
  return `search-engine-suggestion-${engineId}`;
}

export function SearchEngineSuggestion({
  engines,
  activeEngineId,
  onActiveEngineChange,
  onAccept,
}: {
  engines: SearchEngine[];
  activeEngineId: string;
  onActiveEngineChange: (engineId: string) => void;
  onAccept: (engine: SearchEngine) => void;
}) {
  const { t } = useTranslation();

  return (
    <Popover.Portal>
      <Popover.Content
        id={SEARCH_ENGINE_SUGGESTIONS_ID}
        className="glass-panel z-20 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-t-none rounded-b-glass border-t-0 border-white/95 bg-slate-100 p-1.5 pt-2 shadow-[0_22px_58px_rgba(15,23,42,0.32)]"
        side="bottom"
        align="start"
        sideOffset={-1}
        avoidCollisions={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        role="listbox"
        aria-label={t("search.engineSuggestions")}
      >
        {engines.map((engine) => {
          const isActive = engine.id === activeEngineId;
          return (
            <button
              key={engine.id}
              id={getSearchEngineSuggestionId(engine.id)}
              className={clsx(
                "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-slate-700 outline-none transition-colors hover:bg-slate-200/80 hover:text-slate-950 motion-reduce:transition-none",
                isActive &&
                  "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/80",
              )}
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => onActiveEngineChange(engine.id)}
              onClick={() => onAccept(engine)}
            >
              <SiteIcon
                title={engine.name}
                url={getSearchEngineIconSource(engine.urlFormat)}
                seed={engine.id}
                format="png"
                className="size-7 rounded-full text-[12px] font-black shadow-sm"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {getSearchEngineDomain(engine)}
              </span>
              <span
                className={clsx(
                  "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
                  isActive
                    ? "border-blue-600/20 bg-blue-600/10 text-blue-700"
                    : "border-slate-300 bg-white/60 text-slate-700",
                )}
              >
                <Search aria-hidden="true" className="size-4" />
                {t("search.useEngine", { name: engine.name })}
              </span>
            </button>
          );
        })}
      </Popover.Content>
    </Popover.Portal>
  );
}
