import { useState, type CSSProperties } from "react";
import clsx from "clsx";
import * as z from "zod/mini";

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

class SiteIconFailureCache {
  // 存储格式为 { 域名: 失败记录时间 }，有效期统一由 ttl 决定。
  private readonly schema = z.record(z.string(), z.number());
  private readonly storageKey = "site-icon:failed";
  private readonly ttl = 60 * 60 * 1000;
  private readonly failedDomains = new Map<string, number>();

  constructor() {
    this.read();
    window.addEventListener("storage", (event) => {
      if (
        event.storageArea === localStorage &&
        (event.key === this.storageKey || event.key === null)
      ) {
        this.failedDomains.clear();
        this.read();
      }
    });
  }

  private read() {
    try {
      const stored = this.schema.parse(
        JSON.parse(localStorage.getItem(this.storageKey) ?? "{}"),
      );
      for (const [domain, failedAt] of Object.entries(stored)) {
        if (!this.isExpired(failedAt)) {
          this.failedDomains.set(domain, failedAt);
        }
      }
    } catch {
      // Invalid or unavailable storage leaves the in-memory cache usable.
    }
  }

  private isExpired(failedAt: number, now = Date.now()) {
    return failedAt > now || now - failedAt >= this.ttl;
  }

  has(domain: string) {
    const failedAt = this.failedDomains.get(domain);
    if (failedAt !== undefined && !this.isExpired(failedAt)) {
      return true;
    }
    this.failedDomains.delete(domain);
    return false;
  }

  add(domain: string) {
    this.read();
    if (this.has(domain)) {
      return;
    }
    const now = Date.now();
    for (const [cachedDomain, failedAt] of this.failedDomains) {
      if (this.isExpired(failedAt, now)) {
        this.failedDomains.delete(cachedDomain);
      }
    }
    this.failedDomains.set(domain, now);

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(Object.fromEntries(this.failedDomains)),
      );
    } catch {
      // The in-memory cache still prevents retries when storage is unavailable.
    }
  }
}

const siteIconFailureCache = new SiteIconFailureCache();

function useSiteIconFailure(domain: string) {
  const [, setFailureCount] = useState(0);

  return {
    hasFailed: siteIconFailureCache.has(domain),
    markFailed: () => {
      siteIconFailureCache.add(domain);
      setFailureCount((count) => count + 1);
    },
  };
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
  const imageUrl = getSiteIconImageUrl(domain, format);
  const iconText = getSiteIconText({ title, url });
  const { hasFailed, markFailed } = useSiteIconFailure(domain);
  const hasImageError = !imageUrl || hasFailed;

  return (
    <span
      className={clsx(
        "relative grid shrink-0 place-items-center overflow-hidden text-white",
        className,
      )}
      style={{
        ...style,
        background: !hasImageError
          ? "transparent"
          : getSiteIconBackground(seed),
      }}
    >
      {!hasImageError ? null : iconText}
      {imageUrl && !hasImageError ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src={imageUrl}
          onError={markFailed}
        />
      ) : null}
    </span>
  );
}
