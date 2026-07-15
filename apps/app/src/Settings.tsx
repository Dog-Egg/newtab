import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { X } from "lucide-react";
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
} from "./Launcher/launcherSettings";

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
    <section className="border-b border-glass-border px-2 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-glass-strong">
          浏览器收藏夹
        </h3>
        <button
          className="h-8 shrink-0 rounded-lg bg-glass-selected px-3 text-sm font-medium text-glass-selected-content outline-none transition hover:bg-glass-strong/90 focus-visible:ring-2 focus-visible:ring-glass-focus disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          type="button"
          onClick={handleImportBrowserBookmarks}
          disabled={isImportingBookmarks}
        >
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
    <section className="space-y-2.5 border-b border-glass-border px-2 py-4">
      <div className="flex items-center justify-between gap-3">
        <label
          className="text-sm font-medium text-glass-strong"
          htmlFor="launcher-node-size"
        >
          快捷方式大小
        </label>
      </div>
      <div>
        <input
          id="launcher-node-size"
          className="settings-range"
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
        <div className="mt-0.5 flex justify-between text-xs font-medium text-glass-muted">
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
    <section className="space-y-4 px-2 py-4">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <label
            className="text-sm font-medium text-glass-strong"
            htmlFor="wallpaper-overlay"
          >
            壁纸遮罩
          </label>
        </div>
        <div>
          <input
            id="wallpaper-overlay"
            className="settings-range"
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
          <div className="mt-0.5 flex justify-between text-xs font-medium text-glass-muted">
            <span>清晰</span>
            <span>深色</span>
          </div>
        </div>
      </div>

      <form className="space-y-2" onSubmit={applyCustomWallpaper}>
        <label
          className="block text-xs font-semibold text-glass-content"
          htmlFor="wallpaper-url"
        >
          图片 URL
        </label>
        <div className="flex gap-2">
          <input
            className="h-9 min-w-0 flex-1 rounded-lg border border-glass-border bg-white/60 px-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-500 focus:bg-white/80 focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none"
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
            className="h-9 shrink-0 rounded-lg bg-glass-selected px-3 text-sm font-semibold text-glass-selected-content outline-none transition hover:bg-glass-strong/90 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            type="submit"
            disabled={
              isApplyingCustomImage || customImageUrl.trim().length === 0
            }
          >
            {isApplyingCustomImage ? "加载中" : "应用"}
          </button>
        </div>
        {customImageError ? (
          <p className="text-xs font-semibold text-rose-700">
            {customImageError}
          </p>
        ) : null}
      </form>

      <div className="flex items-center justify-between gap-3 border-t border-glass-border pt-3">
        <p className="min-w-0 truncate text-xs font-medium text-glass-content">
          {selectedWallpaperUrl ?? "当前使用默认壁纸"}
        </p>
        <button
          className="h-8 shrink-0 rounded-lg px-2 text-sm font-medium text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          type="button"
          onClick={onClearWallpaper}
          disabled={!selectedWallpaperUrl}
        >
          恢复默认
        </button>
      </div>
    </section>
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

    closeButtonRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className={`relative z-[110] shrink-0 transition-[width] duration-300 ease-out motion-reduce:transition-none`}
      style={{ width: isOpen ? "min(100vw, 26rem)" : 0 }}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <aside
        data-settings-drawer=""
        className={`glass-panel absolute inset-y-0 right-0 flex w-[min(100vw,26rem)] flex-col overflow-hidden rounded-none transition-transform duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="settings-drawer-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-border px-5 py-4">
          <h2
            id="settings-drawer-title"
            className="text-base font-semibold text-glass-strong"
          >
            设置
          </h2>
          <button
            ref={closeButtonRef}
            className="grid size-9 place-items-center rounded-full text-glass-content outline-none transition hover:bg-glass-hover hover:text-glass-strong focus-visible:ring-2 focus-visible:ring-glass-focus motion-reduce:transition-none"
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
