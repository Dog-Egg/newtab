import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import clsx from "clsx";
import {
  normalizeImageUrl,
  readStoredWallpaperUrl,
  saveStoredWallpaperUrl,
  WALLPAPER_STORAGE_KEY,
} from "./wallpapers";

const WALLPAPER_FADE_DURATION_MS = 520;
const DEFAULT_WALLPAPER_URL =
  "https://images.unsplash.com/photo-1781978604675-9e955e007ee5?q=80&w=5777&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

function canUseChromeStorage() {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.storage !== "undefined" &&
    typeof chrome.storage.local !== "undefined"
  );
}

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function getWallpaperLayerStyle(wallpaperUrl: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.34), rgba(15,23,42,0.5)), url("${wallpaperUrl}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function preloadImage(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = url;
  });
}

function WallpaperSettingsPanel({
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

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="fixed right-4 top-20 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-white/35 bg-slate-950/65 text-white shadow-2xl backdrop-blur-xl sm:right-8">
      <div className="flex items-center justify-between gap-3 border-b border-white/15 px-4 py-3">
        <h2 className="text-base font-bold">壁纸</h2>
        <button
          className="grid size-9 place-items-center rounded-full bg-white/10 outline-none transition hover:bg-white/18 focus-visible:ring-4 focus-visible:ring-white/60"
          type="button"
          onClick={onClose}
          aria-label="关闭设置"
        >
          <CloseIcon />
        </button>
      </div>

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
            disabled={isApplyingCustomImage || customImageUrl.trim().length === 0}
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
          className="h-9 shrink-0 rounded-full bg-white/10 px-3 text-sm font-semibold outline-none transition hover:bg-white/18 focus-visible:ring-4 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onClearWallpaper}
          disabled={!selectedWallpaperUrl}
        >
          恢复默认
        </button>
      </div>
    </aside>
  );
}

export function WallpaperSettings({ children }: { children: ReactNode }) {
  const [storedWallpaperUrl, setStoredWallpaperUrl] = useState<string | null>(
    null,
  );
  const [activeWallpaperUrl, setActiveWallpaperUrl] = useState<string | null>(
    null,
  );
  const [pendingWallpaperUrl, setPendingWallpaperUrl] = useState<string | null>(
    null,
  );
  const [isPendingWallpaperVisible, setIsPendingWallpaperVisible] =
    useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const wallpaperRequestIdRef = useRef(0);

  const wallpaperUrl = storedWallpaperUrl ?? DEFAULT_WALLPAPER_URL;

  const saveWallpaper = useCallback((nextWallpaperUrl: string | null) => {
    setStoredWallpaperUrl(nextWallpaperUrl);
    void saveStoredWallpaperUrl(nextWallpaperUrl);
  }, []);

  useEffect(() => {
    const requestId = wallpaperRequestIdRef.current + 1;
    wallpaperRequestIdRef.current = requestId;

    if (activeWallpaperUrl === wallpaperUrl) {
      setPendingWallpaperUrl(null);
      setIsPendingWallpaperVisible(false);
      return;
    }

    setIsPendingWallpaperVisible(false);

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (wallpaperRequestIdRef.current !== requestId) {
        return;
      }

      setPendingWallpaperUrl(wallpaperUrl);
      window.requestAnimationFrame(() => {
        if (wallpaperRequestIdRef.current === requestId) {
          setIsPendingWallpaperVisible(true);
        }
      });
    };
    image.src = wallpaperUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [activeWallpaperUrl, wallpaperUrl]);

  const completeWallpaperFade = useCallback(() => {
    if (!pendingWallpaperUrl || !isPendingWallpaperVisible) {
      return;
    }

    setActiveWallpaperUrl(pendingWallpaperUrl);
    setPendingWallpaperUrl(null);
    setIsPendingWallpaperVisible(false);
  }, [isPendingWallpaperVisible, pendingWallpaperUrl]);

  useEffect(() => {
    let isCurrent = true;

    void readStoredWallpaperUrl().then((wallpaperUrlFromStorage) => {
      if (isCurrent) {
        setStoredWallpaperUrl(wallpaperUrlFromStorage);
      }
    });

    if (!canUseChromeStorage()) {
      return () => {
        isCurrent = false;
      };
    }

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName !== "local" || !changes[WALLPAPER_STORAGE_KEY]) {
        return;
      }

      const nextValue = changes[WALLPAPER_STORAGE_KEY].newValue;

      if (typeof nextValue === "string") {
        try {
          setStoredWallpaperUrl(normalizeImageUrl(nextValue));
          return;
        } catch {
          setStoredWallpaperUrl(null);
          return;
        }
      }

      setStoredWallpaperUrl(null);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      isCurrent = false;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return (
    <main className="relative min-h-screen min-w-80 overflow-hidden font-sans text-white">
      {activeWallpaperUrl ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={getWallpaperLayerStyle(activeWallpaperUrl)}
        />
      ) : null}

      {pendingWallpaperUrl ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-0 transition-opacity ease-out"
          style={{
            ...getWallpaperLayerStyle(pendingWallpaperUrl),
            opacity: isPendingWallpaperVisible ? 1 : 0,
            transitionDuration: `${WALLPAPER_FADE_DURATION_MS}ms`,
          }}
          onTransitionEnd={completeWallpaperFade}
        />
      ) : null}

      {activeWallpaperUrl || pendingWallpaperUrl ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.2),transparent_28%)]" />
      ) : null}

      <button
        className={clsx(
          "fixed right-4 top-4 z-50 grid size-11 place-items-center rounded-full border border-white/35 bg-slate-950/35 text-white shadow-xl outline-none backdrop-blur-md transition hover:bg-slate-950/45 focus-visible:ring-4 focus-visible:ring-white/70 sm:right-8 sm:top-6",
          isSettingsOpen && "bg-white text-slate-900 hover:bg-white/90",
        )}
        type="button"
        onClick={() => setIsSettingsOpen((isOpen) => !isOpen)}
        aria-label="打开设置"
        aria-expanded={isSettingsOpen}
      >
        <GearIcon />
      </button>

      <WallpaperSettingsPanel
        isOpen={isSettingsOpen}
        selectedWallpaperUrl={storedWallpaperUrl}
        onClose={() => setIsSettingsOpen(false)}
        onSelectWallpaper={saveWallpaper}
        onClearWallpaper={() => saveWallpaper(null)}
      />

      {children}
    </main>
  );
}
