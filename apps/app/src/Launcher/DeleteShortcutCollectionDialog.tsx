import { Dialog, DialogTitle } from "../components/Dialog";
import { useTranslation } from "react-i18next";

export function DeleteShortcutCollectionDialog({
  title,
  collectionName,
  shortcutCount,
  keepShortcutsLabel,
  deleteAllLabel,
  onClose,
  onKeepShortcuts,
  onDeleteAll,
}: {
  title: string;
  collectionName: string;
  shortcutCount: number;
  keepShortcutsLabel: string;
  deleteAllLabel: string;
  onClose: () => void;
  onKeepShortcuts: () => void;
  onDeleteAll: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog onClose={onClose} className="max-w-md p-7">
      {(close) => (
        <>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <p className="mt-3 text-sm leading-6 text-white/70">
            {t("launcher.collectionPrompt", {
              name: collectionName,
              count: shortcutCount,
            })}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              className="rounded-xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              onClick={() => {
                onKeepShortcuts();
                close();
              }}
            >
              {keepShortcutsLabel}
            </button>
            <button
              type="button"
              className="rounded-xl bg-red-500/15 px-4 py-3 text-left text-sm font-semibold text-red-200 transition hover:bg-red-500/25"
              onClick={() => {
                onDeleteAll();
                close();
              }}
            >
              {deleteAllLabel}
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={close}
            >
              {t("common.cancel")}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
