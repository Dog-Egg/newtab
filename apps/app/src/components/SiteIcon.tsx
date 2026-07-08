import { useEffect, useState, type CSSProperties } from "react";
import clsx from "clsx";

const SITE_ICON_GRADIENTS = [
  "linear-gradient(145deg, #2563eb, #0ea5e9)",
  "linear-gradient(145deg, #10b981, #22c55e)",
  "linear-gradient(145deg, #f97316, #ef4444)",
  "linear-gradient(145deg, #8b5cf6, #ec4899)",
  "linear-gradient(145deg, #14b8a6, #06b6d4)",
  "linear-gradient(145deg, #334155, #64748b)",
  "linear-gradient(145deg, #f59e0b, #84cc16)",
  "linear-gradient(145deg, #db2777, #7c3aed)",
];

const LOGO_DEV_API_TOKEN = import.meta.env.VITE_LOGO_DEV_API_TOKEN?.trim();

const loadedSiteIconImageUrls = new Set<string>();

type SiteIconProps = {
  title: string;
  url: string;
  seed: string;
  className?: string;
  style?: CSSProperties;
  format?: "png";
};

function getSeedIndex(seed: string) {
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) {
    total += seed.charCodeAt(index);
  }

  return total % SITE_ICON_GRADIENTS.length;
}

function getSiteHostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getSiteIconBackground(seed: string) {
  return SITE_ICON_GRADIENTS[getSeedIndex(seed)];
}

function getSiteIconImageUrl(url: string, format?: string) {
  if (!LOGO_DEV_API_TOKEN) {
    return null;
  }

  const params = new URLSearchParams({
    token: LOGO_DEV_API_TOKEN,
    fallback: "404",
  });
  if (format) {
    params.append("format", format);
  }

  try {
    const domain = new URL(url).hostname;
    return (
      `https://img.logo.dev/${encodeURIComponent(domain)}?` + params.toString()
    );
  } catch {
    return null;
  }
}

function getSiteIconText({ title, url }: { title: string; url: string }) {
  const source = title.trim() || getSiteHostLabel(url);
  return source.slice(0, 1).toUpperCase();
}

export function SiteIcon({
  title,
  url,
  seed,
  className,
  style,
  format,
}: SiteIconProps) {
  const imageUrl = getSiteIconImageUrl(url, format);
  const iconText = getSiteIconText({ title, url });
  const [isImageLoaded, setIsImageLoaded] = useState(() =>
    Boolean(imageUrl && loadedSiteIconImageUrls.has(imageUrl)),
  );

  useEffect(() => {
    setIsImageLoaded(
      Boolean(imageUrl && loadedSiteIconImageUrls.has(imageUrl)),
    );
  }, [imageUrl]);

  return (
    <span
      className={clsx(
        "relative grid shrink-0 place-items-center overflow-hidden text-white",
        className,
      )}
      style={{
        ...style,
        background: isImageLoaded ? "transparent" : getSiteIconBackground(seed),
      }}
    >
      {isImageLoaded ? null : iconText}
      {imageUrl ? (
        <img
          alt=""
          className={clsx(
            "absolute inset-0 size-full object-cover",
            isImageLoaded ? "opacity-100" : "opacity-0",
          )}
          src={imageUrl}
          onLoad={() => {
            loadedSiteIconImageUrls.add(imageUrl);
            setIsImageLoaded(true);
          }}
          onError={() => {
            loadedSiteIconImageUrls.delete(imageUrl);
            setIsImageLoaded(false);
          }}
        />
      ) : null}
    </span>
  );
}
