import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { preloadWallpaper } from "./preload-wallpaper";
import { useWallpapersStore } from "./store";
import styles from "./WallpaperBackground.module.css";

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

export function WallpaperBackground() {
  const { url, overlayOpacity } = useWallpapersStore(
    (state) => state.wallpaper,
  );
  const wallpaperUrl = url ?? DEFAULT_WALLPAPER_URL;
  const wallpaperRequest = useMemo<WallpaperRequest>(
    () => ({ url: wallpaperUrl }),
    [wallpaperUrl],
  );
  // 首次渲染必须直接展示当前壁纸；pending/onLoad 只用于后续切换时的淡入效果。
  const [activeWallpaperUrl, setActiveWallpaperUrl] = useState(wallpaperUrl);
  const [pendingWallpaperRequest, setPendingWallpaperRequest] =
    useState<WallpaperRequest | null>(null);

  useEffect(() => {
    if (activeWallpaperUrl === wallpaperUrl) return;

    let canceled = false;
    void preloadWallpaper(wallpaperUrl).then((loaded) => {
      if (loaded && !canceled) setPendingWallpaperRequest(wallpaperRequest);
    });
    return () => {
      canceled = true;
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
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={getWallpaperLayerStyle(activeWallpaperUrl)}
      />

      {pendingWallpaperUrl && (
        <div
          key={pendingWallpaperUrl}
          className={`absolute inset-0 bg-cover bg-center ${styles.fadeIn}`}
          style={getWallpaperLayerStyle(pendingWallpaperUrl)}
          onAnimationEnd={completeWallpaperFade}
        />
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.2),transparent_28%)]" />
      <div
        className="absolute inset-0 bg-black transition-opacity duration-200"
        style={{ opacity: overlayOpacity }}
      />
    </div>
  );
}
