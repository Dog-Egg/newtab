import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const WALLPAPER_FADE_DURATION_MS = 520;
const DEFAULT_WALLPAPER_URL =
  "https://images.unsplash.com/photo-1781978604675-9e955e007ee5?q=80&w=5777&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

function getWallpaperLayerStyle(wallpaperUrl: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.34), rgba(15,23,42,0.5)), url("${wallpaperUrl}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

export function Wallpaper({
  children,
  wallpaperUrl: selectedWallpaperUrl,
}: {
  children: ReactNode;
  wallpaperUrl: string | null;
}) {
  const [activeWallpaperUrl, setActiveWallpaperUrl] = useState<string | null>(
    null,
  );
  const [pendingWallpaperUrl, setPendingWallpaperUrl] = useState<string | null>(
    null,
  );
  const [isPendingWallpaperVisible, setIsPendingWallpaperVisible] =
    useState(false);
  const wallpaperRequestIdRef = useRef(0);

  const wallpaperUrl = selectedWallpaperUrl ?? DEFAULT_WALLPAPER_URL;

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

      {children}
    </main>
  );
}
