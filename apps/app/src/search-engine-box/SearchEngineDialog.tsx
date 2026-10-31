import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogClose, DialogTitle } from "../components/Dialog";
import {
  customEngineDraftSchema,
  type CustomEngineDraft,
  type UrlSearchEngine,
} from "./schema";

export function SearchEngineEditorDialog({
  engine,
  onClose,
  onSave,
}: {
  engine?: UrlSearchEngine;
  onClose: () => void;
  onSave: (draft: CustomEngineDraft) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CustomEngineDraft>(() => ({
    name: engine?.name ?? "",
    urlFormat: engine?.urlFormat ?? "",
  }));
  const [isSaving, setSaving] = useState(false);
  const saving = useRef(false);
  const validation = customEngineDraftSchema.safeParse(draft);
  const canSave = validation.success;
  const invalidUrl =
    !validation.success &&
    draft.urlFormat.trim().length > 0 &&
    validation.error.issues.some((issue) => issue.path[0] === "urlFormat");
  return (
    <Dialog className="max-w-xl p-6 sm:p-8" onClose={onClose}>
      {(close) => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!validation.success) return;
            if (saving.current) return;
            saving.current = true;
            setSaving(true);
            void onSave(validation.data)
              .then((success) => {
                if (success) close();
              })
              .finally(() => {
                saving.current = false;
                setSaving(false);
              });
          }}
          aria-label={t(engine ? "search.editEngine" : "search.addEngine")}
        >
          <DialogTitle className="text-xl font-semibold">
            {t(engine ? "search.editEngine" : "search.addEngine")}
          </DialogTitle>

          <label className="mt-6 block text-sm font-semibold text-glass-content">
            {t("search.name")}
            <input
              className="mt-2 h-11 w-full rounded-xl border border-glass-border bg-white/15 px-4 text-base font-semibold text-glass-strong outline-none transition placeholder:text-white/45 focus:border-glass-focus focus:bg-white/20 focus:ring-2 focus:ring-glass-focus motion-reduce:transition-none"
              disabled={isSaving}
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>

          <label className="mt-5 block text-sm font-semibold text-glass-content">
            {t("search.urlFormat")}
            <input
              className="mt-2 h-11 w-full rounded-xl border border-glass-border bg-white/15 px-4 text-sm font-semibold text-glass-strong outline-none transition placeholder:text-white/45 focus:border-glass-focus focus:bg-white/20 focus:ring-2 focus:ring-glass-focus motion-reduce:transition-none"
              disabled={isSaving}
              value={draft.urlFormat}
              aria-invalid={invalidUrl || undefined}
              aria-describedby={
                invalidUrl ? "search-engine-url-error" : undefined
              }
              onChange={(event) =>
                setDraft({ ...draft, urlFormat: event.target.value })
              }
            />
          </label>
          {invalidUrl ? (
            <p
              id="search-engine-url-error"
              className="mt-2 text-sm text-red-200"
            >
              {t("search.invalidUrl")}
            </p>
          ) : null}

          <div className="mt-8 flex justify-end gap-3">
            <DialogClose
              className="h-10 rounded-xl px-6 text-sm font-semibold text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
              type="button"
            >
              {t("common.cancel")}
            </DialogClose>
            <button
              className="h-10 rounded-xl bg-action px-7 text-sm font-semibold text-white outline-none transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-glass-focus disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              type="submit"
              disabled={!canSave || isSaving}
            >
              {t("common.save")}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function DeleteSearchEngineDialog({
  engine,
  onClose,
  onDelete,
}: {
  engine: UrlSearchEngine;
  onClose: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [isSaving, setSaving] = useState(false);
  const saving = useRef(false);
  return (
    <Dialog className="max-w-md p-7" onClose={onClose}>
      {(close) => (
        <>
          <DialogTitle className="text-xl font-semibold">
            {t("search.deleteEngine")}
          </DialogTitle>
          <p className="mt-3 text-sm leading-6 text-glass-content">
            {t("search.deleteConfirm", {
              name: engine.name,
            })}
          </p>
          <div className="mt-7 flex justify-end gap-3">
            <DialogClose
              className="h-10 rounded-xl px-6 text-sm font-semibold text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus"
              type="button"
            >
              {t("common.cancel")}
            </DialogClose>
            <button
              className="h-10 rounded-xl bg-red-500 px-6 text-sm font-semibold text-white outline-none transition hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-glass-focus"
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (saving.current) return;
                saving.current = true;
                setSaving(true);
                void onDelete()
                  .then((success) => {
                    if (success) close();
                  })
                  .finally(() => {
                    saving.current = false;
                    setSaving(false);
                  });
              }}
            >
              {t("common.delete")}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
