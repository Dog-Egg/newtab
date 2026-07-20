import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { ChevronDown, EllipsisVertical, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../components/DropdownMenu";
import { SiteIcon } from "../components/SiteIcon";
import {
  getSearchEngineIconSource,
  type SearchEngine,
} from "./searchEngineUtils";

function SearchEngineGlyph({
  engine,
  size = "normal",
}: {
  engine: SearchEngine;
  size?: "normal" | "small";
}) {
  return (
    <SiteIcon
      title={engine.name}
      url={getSearchEngineIconSource(engine.urlFormat)}
      seed={engine.id}
      format="png"
      className={clsx(
        "rounded-full font-black shadow-sm",
        size === "small" ? "size-6 text-[12px]" : "size-7 text-[12px]",
      )}
    />
  );
}

export function SearchEngineSelector({
  engines,
  selectedEngine,
  temporaryEngine,
  isOpen,
  onOpenChange,
  onSelect,
  onClearTemporary,
  onAdd,
  onEdit,
  onRequestDelete,
}: {
  engines: SearchEngine[];
  selectedEngine: SearchEngine;
  temporaryEngine?: SearchEngine | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (engineId: string) => void;
  onClearTemporary: () => void;
  onAdd: () => void;
  onEdit: (engine: SearchEngine) => void;
  onRequestDelete: (engine: SearchEngine) => void;
}) {
  const { t } = useTranslation();

  if (temporaryEngine) {
    return (
      <div
        className="flex h-9 min-w-0 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300/70 bg-white/45 py-1 pl-1.5 pr-1 text-slate-800 shadow-sm"
        aria-label={t("search.temporaryEngine", {
          name: temporaryEngine.name,
        })}
      >
        <SearchEngineGlyph engine={temporaryEngine} size="small" />
        <span className="max-w-28 truncate text-sm font-semibold sm:max-w-36">
          {temporaryEngine.name}
        </span>
        <button
          className="grid size-7 shrink-0 place-items-center rounded-full text-slate-500 outline-none transition hover:bg-slate-200/75 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
          type="button"
          onClick={onClearTemporary}
          aria-label={t("search.clearTemporaryEngine", {
            name: temporaryEngine.name,
          })}
          title={t("search.clearTemporaryEngine", {
            name: temporaryEngine.name,
          })}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-slate-700 outline-none transition hover:bg-white/45 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
          type="button"
          aria-label={t("search.selectEngine", { name: selectedEngine.name })}
          title={selectedEngine.name}
        >
          <SearchEngineGlyph engine={selectedEngine} size="small" />
          <ChevronDown aria-hidden="true" className="size-4" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="glass-panel z-30 w-[calc(100vw-2rem)] max-w-[526px] overflow-hidden p-2"
          sideOffset={16}
          align="start"
          alignOffset={-12}
        >
          <div
            className="flex items-center gap-2 overflow-x-auto p-1"
            role="group"
            aria-label={t("search.engines")}
          >
            {engines.map((engine) => (
              <div key={engine.id} className="group relative shrink-0">
                <button
                  className={clsx(
                    "flex h-16 min-w-[88px] flex-col items-center justify-center gap-1 rounded-xl px-3 text-center text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none",
                    engine.id === selectedEngine.id &&
                      "bg-glass-selected text-glass-selected-content shadow-sm",
                  )}
                  type="button"
                  aria-pressed={engine.id === selectedEngine.id}
                  onClick={() => onSelect(engine.id)}
                >
                  <SearchEngineGlyph engine={engine} />
                  <span className="w-full truncate text-xs font-semibold">
                    {engine.name}
                  </span>
                </button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-slate-800/80 text-white/80 shadow-sm outline-none transition hover:bg-slate-800 hover:text-white focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-glass-focus data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      type="button"
                      aria-label={t("search.moreActionsFor", {
                        name: engine.name,
                      })}
                      title={t("search.moreActions")}
                    >
                      <EllipsisVertical
                        aria-hidden="true"
                        className="size-3.5"
                      />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenuContent className="z-50 text-sm text-glass-content">
                      <DropdownMenuItem onSelect={() => onEdit(engine)}>
                        {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="danger"
                        disabled={engines.length === 1}
                        onSelect={() => onRequestDelete(engine)}
                      >
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            ))}
            <button
              className="grid h-16 min-w-[88px] shrink-0 place-items-center rounded-xl border border-dashed border-glass-border text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
              type="button"
              onClick={onAdd}
              aria-label={t("search.addEngine")}
              title={t("search.addEngine")}
            >
              <Plus aria-hidden="true" className="size-5" />
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
