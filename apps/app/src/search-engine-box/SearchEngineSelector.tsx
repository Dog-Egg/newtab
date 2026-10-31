import { Popover } from "@base-ui/react/popover";
import { useRef } from "react";
import type { SearchEngine, UrlSearchEngine } from "./schema";
import clsx from "clsx";
import { EllipsisVertical, Plus, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Menu, MenuItem, MenuPopup } from "../components/Menu";
import { SiteIcon } from "../components/SiteIcon";
import { getSearchEngineIconSource } from "./search-engine-utils";

function SearchEngineGlyph({
  engine,
  size = "normal",
}: {
  engine: SearchEngine;
  size?: "normal" | "small";
}) {
  if (engine.kind === "browser") {
    return (
      <Search
        aria-hidden="true"
        className={size === "small" ? "size-6 shrink-0" : "size-7 shrink-0"}
      />
    );
  }
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
  disabled = false,
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
  disabled?: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (engineId: string) => void;
  onClearTemporary: () => void;
  onAdd: () => void;
  onEdit: (engine: UrlSearchEngine) => void;
  onRequestDelete: (engine: UrlSearchEngine) => void;
}) {
  const { t } = useTranslation();
  const pendingDialog = useRef<(() => void) | null>(null);
  function closeForDialog(action: () => void) {
    pendingDialog.current = action;
    onOpenChange(false);
  }

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
          className="grid size-7 shrink-0 place-items-center rounded-full text-slate-500 outline-none transition hover:bg-slate-200/75 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400/70 motion-reduce:transition-none"
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
    <Popover.Root
      open={isOpen}
      onOpenChange={onOpenChange}
      modal={false}
      onOpenChangeComplete={(open) => {
        if (!open) {
          const action = pendingDialog.current;
          pendingDialog.current = null;
          action?.();
        }
      }}
    >
      <Popover.Trigger
        render={
          <button
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2 text-slate-700 outline-none transition hover:bg-white/45 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400/70 motion-reduce:transition-none"
            type="button"
            disabled={disabled}
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
          <Popover.Popup
            finalFocus={() => (pendingDialog.current ? false : undefined)}
            className="glass-panel w-[var(--anchor-width)] overflow-hidden p-2"
          >
            <div
              className="flex items-center gap-2 overflow-x-auto p-2"
              role="group"
              aria-label={t("search.engines")}
            >
              {engines.map((engine) => (
                <div key={engine.id} className="group relative shrink-0">
                  <button
                    className={clsx(
                      "flex h-16 w-[72px] flex-col items-center justify-center gap-1 rounded-xl px-2 text-center outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-inset motion-reduce:transition-none",
                      engine.id === selectedEngine.id
                        ? "bg-white/85 text-slate-800 shadow-sm hover:bg-white/95 focus-visible:bg-white/95 focus-visible:ring-slate-400/80 active:bg-white/75"
                        : "text-glass-content hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:ring-sky-200/80 active:bg-white/20",
                    )}
                    type="button"
                    aria-label={engine.name}
                    title={engine.name}
                    aria-pressed={engine.id === selectedEngine.id}
                    onClick={() => onSelect(engine.id)}
                  >
                    <SearchEngineGlyph engine={engine} />
                    <span className="h-4 w-full truncate text-xs font-semibold leading-4">
                      {engine.kind === "browser"
                        ? t("search.browserDefaultShort")
                        : engine.name}
                    </span>
                  </button>
                  {engine.kind === "url" && (
                    <SearchEngineActions
                      engine={engine}
                      canDelete={engines.length > 1}
                      onEdit={(entry) => closeForDialog(() => onEdit(entry))}
                      onRequestDelete={(entry) =>
                        closeForDialog(() => onRequestDelete(entry))
                      }
                    />
                  )}
                </div>
              ))}
              <button
                className="grid h-16 w-[72px] shrink-0 place-items-center rounded-xl border border-dashed border-glass-border text-glass-content outline-none transition-[background-color,color,box-shadow] duration-150 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-200/80 active:bg-white/20 motion-reduce:transition-none"
                type="button"
                onClick={() => closeForDialog(onAdd)}
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

function SearchEngineActions({
  engine,
  canDelete,
  onEdit,
  onRequestDelete,
}: {
  engine: UrlSearchEngine;
  canDelete: boolean;
  onEdit: (engine: UrlSearchEngine) => void;
  onRequestDelete: (engine: UrlSearchEngine) => void;
}) {
  const { t } = useTranslation();
  const pending = useRef<(() => void) | null>(null);
  return (
    <Menu.Root
      onOpenChangeComplete={(open) => {
        if (!open) {
          const action = pending.current;
          pending.current = null;
          action?.();
        }
      }}
    >
      <Menu.Trigger
        render={
          <button
            className={clsx(
              "absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border border-white/20 bg-slate-800/80 text-white/80 shadow-sm outline-none transition-[background-color,color,box-shadow,opacity] duration-150 motion-reduce:transition-none",
              "hover:bg-slate-700/90 hover:text-white focus-visible:bg-slate-700/90 focus-visible:text-white focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 active:bg-slate-900/90 focus-visible:active:bg-slate-900/90",
              "data-[popup-open]:bg-slate-700/90 data-[popup-open]:text-white data-[popup-open]:opacity-100 data-[popup-open]:active:bg-slate-900/90 sm:opacity-0 sm:group-hover:opacity-100",
            )}
            type="button"
            aria-label={t("search.moreActionsFor", {
              name: engine.name,
            })}
            title={t("search.moreActions")}
          >
            <EllipsisVertical aria-hidden="true" className="size-3.5" />
          </button>
        }
      />
      <Menu.Portal>
        <MenuPopup positionerZIndex={50} className="text-sm text-glass-content">
          <MenuItem
            onClick={() => {
              pending.current = () => onEdit(engine);
            }}
          >
            {t("common.edit")}
          </MenuItem>
          <MenuItem
            variant="danger"
            disabled={!canDelete}
            onClick={() => {
              pending.current = () => onRequestDelete(engine);
            }}
          >
            {t("common.delete")}
          </MenuItem>
        </MenuPopup>
      </Menu.Portal>
    </Menu.Root>
  );
}
