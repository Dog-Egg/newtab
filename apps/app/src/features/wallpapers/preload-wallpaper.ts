let latest: { url: string; ready: Promise<boolean> } | undefined;

export function preloadWallpaper(url: string): Promise<boolean> {
  if (latest?.url === url) return latest.ready;

  const ready = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load wallpaper"));
    image.src = url;
  }).then(
    () => true,
    () => {
      if (latest?.ready === ready) latest = undefined;
      return false;
    },
  );

  latest = { url, ready };
  return ready;
}
