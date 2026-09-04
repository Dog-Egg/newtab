import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const WALLPAPER_FADE_DURATION_MS = 520;
const DEFAULT_WALLPAPER_URL =
  import.meta.env.VITE_DEFAULT_WALLPAPER_URL?.trim() ||
  "https://images.unsplash.com/photo-1515268064940-5150b7c29f35";

type WallpaperRequest = {
  url: string;
};

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
  const wallpaperUrl = selectedWallpaperUrl ?? DEFAULT_WALLPAPER_URL;
  const wallpaperRequest = useMemo<WallpaperRequest>(
    () => ({ url: wallpaperUrl }),
    [wallpaperUrl],
  );
  // 首次渲染必须直接展示当前壁纸；pending/onLoad 只用于后续切换时的淡入效果。
  const [activeWallpaperUrl, setActiveWallpaperUrl] = useState<string | null>(
    wallpaperUrl,
  );
  const [pendingWallpaperRequest, setPendingWallpaperRequest] =
    useState<WallpaperRequest | null>(null);
  const wallpaperRequestIdRef = useRef(0);

  useEffect(() => {
    const requestId = wallpaperRequestIdRef.current + 1;
    wallpaperRequestIdRef.current = requestId;

    if (activeWallpaperUrl === wallpaperUrl) return;

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (wallpaperRequestIdRef.current !== requestId) {
        return;
      }

      setPendingWallpaperRequest(wallpaperRequest);
    };
    image.src = wallpaperUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [activeWallpaperUrl, wallpaperRequest, wallpaperUrl]);

  const completeWallpaperFade = useCallback(() => {
    if (
      !pendingWallpaperRequest ||
      pendingWallpaperRequest !== wallpaperRequest
    ) {
      return;
    }

    setActiveWallpaperUrl(pendingWallpaperRequest.url);
    setPendingWallpaperRequest(null);
  }, [pendingWallpaperRequest, wallpaperRequest]);

  const pendingWallpaperUrl =
    pendingWallpaperRequest === wallpaperRequest ? wallpaperRequest.url : null;

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
          key={pendingWallpaperUrl}
          className="wallpaper-fade-in absolute inset-0 bg-cover bg-center"
          style={{
            ...getWallpaperLayerStyle(pendingWallpaperUrl),
            animationDuration: `${WALLPAPER_FADE_DURATION_MS}ms`,
          }}
          onAnimationEnd={completeWallpaperFade}
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
