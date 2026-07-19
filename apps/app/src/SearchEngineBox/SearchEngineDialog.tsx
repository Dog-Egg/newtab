import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogTitle } from "../components/Dialog";
import type { CustomEngineDraft, SearchEngine } from "./searchEngineUtils";

export function SearchEngineDialogs({
  isEditorOpen,
  editingEngineId,
  draft,
  onDraftChange,
  onCloseEditor,
  onSave,
  enginePendingDeletion,
  onCloseDeletion,
  onDelete,
}: {
  isEditorOpen: boolean;
  editingEngineId: string | null;
  draft: CustomEngineDraft;
  onDraftChange: (draft: CustomEngineDraft) => void;
  onCloseEditor: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  enginePendingDeletion: SearchEngine | null;
  onCloseDeletion: () => void;
  onDelete: (engine: SearchEngine) => void;
}) {
  const { t } = useTranslation();
  const canSave = Boolean(draft.name.trim() && draft.urlFormat.trim());

  return (
    <>
      {isEditorOpen ? (
        <Dialog className="max-w-xl p-6 sm:p-8" onClose={onCloseEditor}>
          {(close) => (
            <form
              onSubmit={(event) => {
                onSave(event);
                if (canSave) close();
              }}
              aria-label={t(
                editingEngineId ? "search.editEngine" : "search.addEngine",
              )}
            >
              <DialogTitle className="text-xl font-semibold">
                {t(editingEngineId ? "search.editEngine" : "search.addEngine")}
              </DialogTitle>

              <label className="mt-6 block text-sm font-semibold text-glass-content">
                {t("search.name")}
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-glass-border bg-white/15 px-4 text-base font-semibold text-glass-strong outline-none transition placeholder:text-white/70 focus:border-glass-focus focus:bg-white/20 focus:ring-2 focus:ring-glass-focus motion-reduce:transition-none"
                  value={draft.name}
                  onChange={(event) =>
                    onDraftChange({ ...draft, name: event.target.value })
                  }
                  placeholder="Google"
                />
              </label>

              <label className="mt-5 block text-sm font-semibold text-glass-content">
                {t("search.urlFormat")}
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-glass-border bg-white/15 px-4 text-sm font-semibold text-glass-strong outline-none transition placeholder:text-white/70 focus:border-glass-focus focus:bg-white/20 focus:ring-2 focus:ring-glass-focus motion-reduce:transition-none"
                  value={draft.urlFormat}
                  onChange={(event) =>
                    onDraftChange({ ...draft, urlFormat: event.target.value })
                  }
                  placeholder="https://www.google.com/search?q=%s"
                />
              </label>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  className="h-10 rounded-xl px-6 text-sm font-semibold text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
                  type="button"
                  onClick={close}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="h-10 rounded-xl bg-action px-7 text-sm font-semibold text-white outline-none transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-glass-focus disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                  type="submit"
                  disabled={!canSave}
                >
                  {t("common.save")}
                </button>
              </div>
            </form>
          )}
        </Dialog>
      ) : null}

      {enginePendingDeletion ? (
        <Dialog className="max-w-md p-7" onClose={onCloseDeletion}>
          {(close) => (
            <>
              <DialogTitle className="text-xl font-semibold">
                {t("search.deleteEngine")}
              </DialogTitle>
              <p className="mt-3 text-sm leading-6 text-glass-content">
                {t("search.deleteConfirm", {
                  name: enginePendingDeletion.name,
                })}
              </p>
              <div className="mt-7 flex justify-end gap-3">
                <button
                  className="h-10 rounded-xl px-6 text-sm font-semibold text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus"
                  type="button"
                  onClick={close}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="h-10 rounded-xl bg-red-500 px-6 text-sm font-semibold text-white outline-none transition hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-glass-focus"
                  type="button"
                  onClick={() => {
                    onDelete(enginePendingDeletion);
                    close();
                  }}
                >
                  {t("common.delete")}
                </button>
              </div>
            </>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
