import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VirtuosoGrid } from "react-virtuoso";
import { fetchWallpapers, type GalleryWallpaper } from "./api";

type GalleryState = {
  page: number;
  status: "loading" | "idle" | "error" | "done";
  wallpapers: GalleryWallpaper[];
};

const gridOverscan = { top: 160, bottom: 160 };

function wallpaperKey(_index: number, wallpaper: GalleryWallpaper) {
  return wallpaper.id;
}

export function WallpaperGallery({
  scrollRoot,
  selectedUrl,
  pendingUrl,
  imageFailed,
  onSelect,
}: {
  scrollRoot: HTMLDivElement;
  selectedUrl?: string;
  pendingUrl?: string;
  imageFailed: boolean;
  onSelect: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [{ page, status, wallpapers }, setGallery] = useState<GalleryState>({
    page: 1,
    status: "loading",
    wallpapers: [],
  });
  const footerRef = useRef<HTMLDivElement>(null);
  const [gridReady, setGridReady] = useState(false);

  useEffect(() => {
    if (status !== "loading") return;

    const controller = new AbortController();

    void fetchWallpapers(page, controller.signal).then(
      ({ wallpapers: nextWallpapers, lastPage }) => {
        if (controller.signal.aborted) return;

        setGallery((current) => {
          const byId = new Map(
            current.wallpapers.map((item) => [item.id, item]),
          );
          for (const item of nextWallpapers) {
            if (!byId.has(item.id)) byId.set(item.id, item);
          }
          return {
            page: page + 1,
            status: page < lastPage ? "idle" : "done",
            wallpapers: [...byId.values()],
          };
        });
      },
      () => {
        if (!controller.signal.aborted) {
          setGallery((current) => ({ ...current, status: "error" }));
        }
      },
    );

    return () => controller.abort();
  }, [page, status]);

  const requestPage = useCallback((from: "idle" | "error") => {
    setGallery((current) =>
      current.status === from ? { ...current, status: "loading" } : current,
    );
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    if (
      status !== "idle" ||
      (wallpapers.length > 0 && !gridReady) ||
      !footer ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) requestPage("idle");
      },
      { root: scrollRoot, rootMargin: "0px 0px 300px 0px" },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [gridReady, page, requestPage, scrollRoot, status, wallpapers.length]);

  return (
    <div
      className="space-y-3 [overflow-anchor:none]"
      role="group"
      aria-label={t("settings.wallpaperGallery.label")}
    >
      {imageFailed && (
        <p role="alert" className="text-xs font-semibold text-rose-300">
          {t("settings.wallpaperGallery.imageFailed")}
        </p>
      )}

      {status === "done" && wallpapers.length === 0 && (
        <p role="status" className="text-xs text-glass-content">
          {t("settings.wallpaperGallery.empty")}
        </p>
      )}

      {wallpapers.length > 0 && (
        <VirtuosoGrid
          customScrollParent={scrollRoot}
          data={wallpapers}
          computeItemKey={wallpaperKey}
          increaseViewportBy={gridOverscan}
          readyStateChanged={setGridReady}
          listClassName="grid grid-cols-2 gap-2.5"
          itemContent={(index, { id, url, resolution, thumbnailUrl }) => {
            const selected = selectedUrl === url;
            const pending = pendingUrl === url;

            return (
              <button
                className={clsx(
                  "group relative block aspect-video w-full overflow-hidden rounded-xl bg-white/10 text-left outline-none ring-inset focus-visible:ring-2 focus-visible:ring-glass-focus",
                  selected && "ring-2 ring-cyan-300",
                )}
                type="button"
                aria-label={t("settings.wallpaperGallery.select", {
                  id,
                  resolution,
                })}
                aria-pressed={selected}
                aria-busy={pending}
                onClick={() => onSelect(url)}
              >
                <img
                  className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
                  src={thumbnailUrl}
                  alt=""
                  loading={index < 6 ? "eager" : "lazy"}
                  decoding="async"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-1.5 pt-4 text-[10px] font-medium tabular-nums text-white"
                >
                  {resolution.replace("x", " × ")}
                </span>
                {(pending || selected) && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-slate-950/80 text-cyan-200"
                  >
                    {pending ? (
                      <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </span>
                )}
                {selected && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-cyan-300"
                  />
                )}
              </button>
            );
          }}
        />
      )}

      <div ref={footerRef} className="grid h-7 place-items-center">
        {status === "loading" && (
          <div role="status" className="text-glass-content">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            <span className="sr-only">{t("common.loading")}</span>
          </div>
        )}
        {status === "error" && (
          <>
            <span role="alert" className="sr-only">
              {t("settings.wallpaperGallery.loadFailed")}
            </span>
            <button
              className="rounded px-2 py-1 text-xs font-medium text-glass-strong underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-glass-focus"
              type="button"
              onClick={() => requestPage("error")}
            >
              {t("settings.wallpaperGallery.retry")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
