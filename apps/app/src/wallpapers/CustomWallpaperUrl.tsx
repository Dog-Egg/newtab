import { Check, LoaderCircle } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { wallpaperUrlSchema } from "./schema";

export function CustomWallpaperUrl({
  onApply,
  pending,
  failedUrl,
}: {
  onApply: (url: string) => void;
  pending: boolean;
  failedUrl?: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const imageFailed =
    failedUrl !== undefined &&
    wallpaperUrlSchema.safeParse(draft).data === failedUrl;
  const error = invalid
    ? t("settings.invalidImageUrl")
    : imageFailed
      ? t("settings.imageLoadFailed")
      : undefined;

  function applyCustomWallpaper(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = wallpaperUrlSchema.safeParse(draft);
    setInvalid(!parsed.success);
    if (parsed.success) onApply(parsed.data);
  }

  return (
    <form className="space-y-2" noValidate onSubmit={applyCustomWallpaper}>
      <div className="flex gap-2">
        <input
          className="h-10 min-w-0 flex-1 rounded-xl border border-glass-border bg-white/10 px-3 text-sm font-medium text-glass-strong outline-none transition placeholder:text-white/45 focus:bg-glass-hover focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
          type="url"
          inputMode="url"
          placeholder={t("settings.imageUrl")}
          aria-label={t("settings.imageUrl")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "wallpaper-url-error" : undefined}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
        />
        <button
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-glass-selected text-glass-selected-content outline-none transition hover:bg-glass-strong/90 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-75 motion-reduce:transition-none"
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label={t(pending ? "common.loading" : "settings.apply")}
        >
          {pending ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      {error && (
        <p
          id="wallpaper-url-error"
          role="alert"
          className="text-xs font-semibold text-rose-300"
        >
          {error}
        </p>
      )}
    </form>
  );
}
