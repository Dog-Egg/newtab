import { Popover } from "@base-ui/react/popover";
import clsx from "clsx";
import { EllipsisVertical, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Menu, MenuItem, MenuPopup } from "../components/Menu";
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
  anchorElement,
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
  anchorElement: HTMLDivElement | null;
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
        className="flex h-9 min-w-0 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300/70 bg-white/45 py-1 pl-1.5 pr-1 text-slate-800"
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
    <Popover.Root open={isOpen} onOpenChange={onOpenChange} modal={false}>
      <Popover.Trigger
        render={
          <button
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-slate-700 outline-none transition hover:bg-white/45 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
            type="button"
            aria-label={t("search.selectEngine", { name: selectedEngine.name })}
            title={selectedEngine.name}
          >
            <SearchEngineGlyph engine={selectedEngine} size="small" />
          </button>
        }
      />

      <Popover.Portal>
        <Popover.Positioner
          anchor={anchorElement}
          sideOffset={6}
          align="start"
          className="z-30"
        >
          <Popover.Popup className="glass-panel w-[var(--anchor-width)] overflow-hidden p-2">
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
                  <Menu.Root>
                    <Menu.Trigger
                      render={
                        <button
                          className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-slate-800/80 text-white/80 shadow-sm outline-none transition hover:bg-slate-800 hover:text-white focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-glass-focus data-[popup-open]:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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
                      }
                    />
                    <Menu.Portal>
                      <MenuPopup
                        positionerZIndex={50}
                        className="text-sm text-glass-content"
                      >
                        <MenuItem onClick={() => onEdit(engine)}>
                          {t("common.edit")}
                        </MenuItem>
                        <MenuItem
                          variant="danger"
                          disabled={engines.length === 1}
                          onClick={() => onRequestDelete(engine)}
                        >
                          {t("common.delete")}
                        </MenuItem>
                      </MenuPopup>
                    </Menu.Portal>
                  </Menu.Root>
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
