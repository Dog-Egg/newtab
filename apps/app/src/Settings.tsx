import { useCallback, useState, type FormEvent } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { platform } from "@platform";
import { normalizeImageUrl } from "./wallpapers";

function preloadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = url;
  });
}

function BrowserBookmarksImportSettings() {
  const [importMessage, setImportMessage] = useState("");
  const [isImportingBookmarks, setIsImportingBookmarks] = useState(false);

  const handleImportBrowserBookmarks = useCallback(async () => {
    setIsImportingBookmarks(true);
    setImportMessage("");

    try {
      const result = await platform.browserBookmarks.import();

      if (result.unsupported) {
        toast.error("当前环境无法读取浏览器收藏夹", {
          description: "请在浏览器扩展环境中使用收藏夹导入。",
        });
        return;
      }

      const skippedText =
        result.skippedDuplicateCount > 0
          ? `，跳过 ${result.skippedDuplicateCount} 个重复项`
          : "";

      if (result.importedCount === 0) {
        setImportMessage(
          result.skippedDuplicateCount > 0
            ? `没有新的可导入收藏${skippedText}`
            : "没有找到可导入的浏览器收藏",
        );
        return;
      }

      setImportMessage(
        `已导入 ${result.importedCount} 个收藏${
          result.folderCount > 0 ? `，包含 ${result.folderCount} 个文件夹` : ""
        }${skippedText}`,
      );
    } catch (error) {
      toast.error("导入失败，请稍后重试");
    } finally {
      setIsImportingBookmarks(false);
    }
  }, []);

  return (
    <section className="space-y-3 border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">收藏夹</h3>
          <p className="mt-1 text-xs font-semibold text-white/60">
            将浏览器收藏夹合并到当前书签
          </p>
        </div>
        <button
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-sm font-bold text-slate-900 outline-none transition hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={handleImportBrowserBookmarks}
          disabled={isImportingBookmarks}
        >
          <Download aria-hidden="true" className="size-4" />
          {isImportingBookmarks ? "导入中" : "导入"}
        </button>
      </div>
      {importMessage ? (
        <p className="text-xs font-semibold text-emerald-100">
          {importMessage}
        </p>
      ) : null}
    </section>
  );
}

function WallpaperSettingsSection({
  selectedWallpaperUrl,
  onSelectWallpaper,
  onClearWallpaper,
}: {
  selectedWallpaperUrl: string | null;
  onSelectWallpaper: (wallpaperUrl: string) => void;
  onClearWallpaper: () => void;
}) {
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [customImageError, setCustomImageError] = useState("");
  const [isApplyingCustomImage, setIsApplyingCustomImage] = useState(false);

  const applyCustomWallpaper = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      let imageUrl: string;

      try {
        imageUrl = normalizeImageUrl(customImageUrl);
      } catch {
        setCustomImageError("请输入有效的 http 或 https 图片 URL");
        return;
      }

      setIsApplyingCustomImage(true);
      setCustomImageError("");

      try {
        await preloadImage(imageUrl);
        onSelectWallpaper(imageUrl);
        setCustomImageUrl("");
      } catch {
        setCustomImageError("图片加载失败，请检查 URL 是否可访问");
      } finally {
        setIsApplyingCustomImage(false);
      }
    },
    [customImageUrl, onSelectWallpaper],
  );

  return (
    <>
      <form className="space-y-2 px-4 py-3" onSubmit={applyCustomWallpaper}>
        <label
          className="block text-xs font-bold text-white/70"
          htmlFor="wallpaper-url"
        >
          图片 URL
        </label>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/40 focus:border-white/45 focus:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/30"
            id="wallpaper-url"
            type="url"
            inputMode="url"
            value={customImageUrl}
            placeholder="https://example.com/image.jpg"
            onChange={(event) => {
              setCustomImageUrl(event.target.value);
              setCustomImageError("");
            }}
          />
          <button
            className="h-10 shrink-0 rounded-full bg-white px-3 text-sm font-bold text-slate-900 outline-none transition hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={
              isApplyingCustomImage || customImageUrl.trim().length === 0
            }
          >
            {isApplyingCustomImage ? "加载中" : "应用"}
          </button>
        </div>
        {customImageError ? (
          <p className="text-xs font-semibold text-rose-100">
            {customImageError}
          </p>
        ) : null}
      </form>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <p className="min-w-0 truncate text-xs font-semibold text-white/65">
          {selectedWallpaperUrl ?? "当前使用默认壁纸"}
        </p>
        <button
          className="hover:bg-white/18 h-9 shrink-0 rounded-full bg-white/10 px-3 text-sm font-semibold outline-none transition focus-visible:ring-4 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onClearWallpaper}
          disabled={!selectedWallpaperUrl}
        >
          恢复默认
        </button>
      </div>
    </>
  );
}

export function SettingsPanel({
  isOpen,
  selectedWallpaperUrl,
  onClose,
  onSelectWallpaper,
  onClearWallpaper,
}: {
  isOpen: boolean;
  selectedWallpaperUrl: string | null;
  onClose: () => void;
  onSelectWallpaper: (wallpaperUrl: string) => void;
  onClearWallpaper: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="fixed right-4 top-20 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-white/35 bg-slate-950/65 text-white shadow-2xl backdrop-blur-xl sm:right-8">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 px-4 py-3">
        <h2 className="text-base font-bold">设置</h2>
        <button
          className="hover:bg-white/18 grid size-9 place-items-center rounded-full bg-white/10 outline-none transition focus-visible:ring-4 focus-visible:ring-white/60"
          type="button"
          onClick={onClose}
          aria-label="关闭设置"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <BrowserBookmarksImportSettings />
      <WallpaperSettingsSection
        selectedWallpaperUrl={selectedWallpaperUrl}
        onSelectWallpaper={onSelectWallpaper}
        onClearWallpaper={onClearWallpaper}
      />
    </aside>
  );
}
