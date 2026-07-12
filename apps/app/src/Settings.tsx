import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Download, X } from "lucide-react";
import { importBrowserBookmarksWithToast } from "./browserBookmarks";
import { normalizeImageUrl } from "./wallpapers";
import {
  LAUNCHER_NODE_SCALE_STEP,
  MAX_WALLPAPER_OVERLAY_OPACITY,
  MAX_LAUNCHER_NODE_SCALE,
  MIN_WALLPAPER_OVERLAY_OPACITY,
  MIN_LAUNCHER_NODE_SCALE,
  WALLPAPER_OVERLAY_OPACITY_STEP,
  type LauncherSettings,
} from "./launcherSettings";

function preloadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = url;
  });
}

function BrowserBookmarksImportSettings() {
  const [isImportingBookmarks, setIsImportingBookmarks] = useState(false);

  const handleImportBrowserBookmarks = useCallback(async () => {
    setIsImportingBookmarks(true);
    try {
      await importBrowserBookmarksWithToast();
    } finally {
      setIsImportingBookmarks(false);
    }
  }, []);

  return (
    <section className="space-y-3 border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">导入浏览器收藏夹</h3>
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
    </section>
  );
}

function LauncherSizeSettings({
  settings,
  onChange,
}: {
  settings: LauncherSettings;
  onChange: (settings: LauncherSettings) => void;
}) {
  return (
    <section className="space-y-3 border-b border-white/10 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-bold" htmlFor="launcher-node-size">
          快捷方式大小
        </label>
      </div>
      <div>
        <input
          id="launcher-node-size"
          className="w-full cursor-pointer accent-white"
          type="range"
          min={MIN_LAUNCHER_NODE_SCALE}
          max={MAX_LAUNCHER_NODE_SCALE}
          step={LAUNCHER_NODE_SCALE_STEP}
          value={settings.nodeScale}
          aria-label="快捷方式大小"
          onChange={(event) =>
            onChange({
              ...settings,
              nodeScale: Number(event.currentTarget.value),
            })
          }
        />
        <div className="flex justify-between text-xs font-semibold text-white/55">
          <span>小</span>
          <span>大</span>
        </div>
      </div>
    </section>
  );
}

function WallpaperSettingsSection({
  selectedWallpaperUrl,
  settings,
  onSelectWallpaper,
  onClearWallpaper,
  onChangeSettings,
}: {
  selectedWallpaperUrl: string | null;
  settings: LauncherSettings;
  onSelectWallpaper: (wallpaperUrl: string) => void;
  onClearWallpaper: () => void;
  onChangeSettings: (settings: LauncherSettings) => void;
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
      <section className="space-y-3 border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-bold" htmlFor="wallpaper-overlay">
            壁纸遮罩
          </label>
        </div>
        <div>
          <input
            id="wallpaper-overlay"
            className="w-full cursor-pointer accent-white"
            type="range"
            min={MIN_WALLPAPER_OVERLAY_OPACITY}
            max={MAX_WALLPAPER_OVERLAY_OPACITY}
            step={WALLPAPER_OVERLAY_OPACITY_STEP}
            value={settings.wallpaperOverlayOpacity}
            aria-label="壁纸遮罩强度"
            onChange={(event) =>
              onChangeSettings({
                ...settings,
                wallpaperOverlayOpacity: Number(event.currentTarget.value),
              })
            }
          />
          <div className="flex justify-between text-xs font-semibold text-white/55">
            <span>清晰</span>
            <span>深色</span>
          </div>
        </div>
      </section>

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
  launcherSettings,
  onClose,
  onSelectWallpaper,
  onClearWallpaper,
  onChangeLauncherSettings,
}: {
  isOpen: boolean;
  selectedWallpaperUrl: string | null;
  launcherSettings: LauncherSettings;
  onClose: () => void;
  onSelectWallpaper: (wallpaperUrl: string) => void;
  onClearWallpaper: () => void;
  onChangeLauncherSettings: (settings: LauncherSettings) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className="relative z-[110] shrink-0 overflow-hidden transition-[width] duration-300 ease-out"
      style={{ width: isOpen ? "min(100vw, 26rem)" : 0 }}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <aside
        data-settings-drawer=""
        className={`absolute inset-y-0 right-0 flex w-[min(100vw,26rem)] flex-col overflow-hidden border-l border-white/30 bg-slate-950/90 text-white shadow-[-24px_0_70px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="settings-drawer-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-5 py-4">
          <h2 id="settings-drawer-title" className="text-base font-bold">
            设置
          </h2>
          <button
            ref={closeButtonRef}
            className="grid size-9 place-items-center rounded-full bg-white/10 outline-none transition hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-white/60"
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <BrowserBookmarksImportSettings />
          <LauncherSizeSettings
            settings={launcherSettings}
            onChange={onChangeLauncherSettings}
          />
          <WallpaperSettingsSection
            selectedWallpaperUrl={selectedWallpaperUrl}
            settings={launcherSettings}
            onSelectWallpaper={onSelectWallpaper}
            onClearWallpaper={onClearWallpaper}
            onChangeSettings={onChangeLauncherSettings}
          />
        </div>
      </aside>
    </div>
  );
}
