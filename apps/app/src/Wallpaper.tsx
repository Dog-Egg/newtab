import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const WALLPAPER_FADE_DURATION_MS = 520;
const DEFAULT_WALLPAPER_URL =
  import.meta.env.VITE_DEFAULT_WALLPAPER_URL?.trim() ||
  "https://images.unsplash.com/photo-1515268064940-5150b7c29f35";

function getWallpaperLayerStyle(wallpaperUrl: string): CSSProperties {
  return {
    backgroundImage: `url("${wallpaperUrl}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

export function Wallpaper({
  wallpaperUrl: selectedWallpaperUrl,
  overlayOpacity,
}: {
  wallpaperUrl: string | null;
  overlayOpacity: number;
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
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {activeWallpaperUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={getWallpaperLayerStyle(activeWallpaperUrl)}
        />
      ) : null}

      {pendingWallpaperUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-0 transition-opacity ease-out"
          style={{
            ...getWallpaperLayerStyle(pendingWallpaperUrl),
            opacity: isPendingWallpaperVisible ? 1 : 0,
            transitionDuration: `${WALLPAPER_FADE_DURATION_MS}ms`,
          }}
          onTransitionEnd={completeWallpaperFade}
        />
      ) : null}

      {activeWallpaperUrl || pendingWallpaperUrl ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.2),transparent_28%)]" />
      ) : null}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-200"
        style={{ opacity: overlayOpacity }}
      />
    </div>
  );
}
