import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { platform } from "@platform";
import { SettingsPanel } from "./Settings";

const WALLPAPER_FADE_DURATION_MS = 520;
const DEFAULT_WALLPAPER_URL =
  "https://images.unsplash.com/photo-1781978604675-9e955e007ee5?q=80&w=5777&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

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

function getWallpaperLayerStyle(wallpaperUrl: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.34), rgba(15,23,42,0.5)), url("${wallpaperUrl}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

export function Wallpaper({ children }: { children: ReactNode }) {
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
    void platform.wallpaper.save(nextWallpaperUrl);
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

    void platform.wallpaper.read().then((wallpaperUrlFromStorage) => {
      if (isCurrent) {
        setStoredWallpaperUrl(wallpaperUrlFromStorage);
      }
    });

    const unsubscribe = platform.wallpaper.subscribe(setStoredWallpaperUrl);
    return () => {
      isCurrent = false;
      unsubscribe();
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

      <SettingsPanel
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
