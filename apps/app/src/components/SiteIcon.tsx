import { useState, type CSSProperties } from "react";
import clsx from "clsx";
import { getFaviconUrl } from "../platform/favicon";

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

function getSiteDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getSiteIconBackground(seed: string) {
  return SITE_ICON_GRADIENTS[getSeedIndex(seed)];
}

function getSiteIconImageUrl(domain: string, format?: string) {
  if (!LOGO_DEV_API_TOKEN || !domain) {
    return null;
  }

  const params = new URLSearchParams({
    token: LOGO_DEV_API_TOKEN,
    fallback: "404",
  });
  if (format) {
    params.append("format", format);
  }

  return (
    `https://img.logo.dev/${encodeURIComponent(domain)}?` + params.toString()
  );
}

function getSiteIconText({ title, url }: { title: string; url: string }) {
  const source = title.trim() || getSiteDomain(url) || url;
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
  const domain = getSiteDomain(url);
  const logoUrl = getSiteIconImageUrl(domain, format);
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const [failedFaviconUrl, setFailedFaviconUrl] = useState<string | null>(null);
  const useLogo = !!logoUrl && logoUrl !== failedLogoUrl;
  const faviconUrl = useLogo ? null : getFaviconUrl(url);
  const fallbackUrl = faviconUrl === failedFaviconUrl ? null : faviconUrl;
  const imageUrl = useLogo ? logoUrl : fallbackUrl;

  return (
    <span
      className={clsx(
        "relative grid shrink-0 place-items-center overflow-hidden text-white",
        className,
      )}
      style={{
        ...style,
        background: imageUrl ? "transparent" : getSiteIconBackground(seed),
      }}
    >
      {imageUrl ? (
        <img
          key={imageUrl}
          alt=""
          className={clsx(
            "absolute inset-0 size-full",
            useLogo ? "object-cover" : "bg-white object-contain p-[15%]",
          )}
          src={imageUrl}
          onError={() => {
            if (useLogo) setFailedLogoUrl(imageUrl);
            else setFailedFaviconUrl(imageUrl);
          }}
        />
      ) : (
        getSiteIconText({ title, url })
      )}
    </span>
  );
}
