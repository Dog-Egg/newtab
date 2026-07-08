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

const ICON_IMAGE_URL_TEMPLATE =
  import.meta.env.VITE_ICON_IMAGE_URL_TEMPLATE?.trim();

export const loadedSiteIconImageUrls = new Set<string>();

function getSeedIndex(seed: string) {
  let total = 0;
  for (let index = 0; index < seed.length; index += 1) {
    total += seed.charCodeAt(index);
  }

  return total % SITE_ICON_GRADIENTS.length;
}

export function getSiteHostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getSiteIconBackground(seed: string) {
  return SITE_ICON_GRADIENTS[getSeedIndex(seed)];
}

export function getSiteIconImageUrl(url: string) {
  if (!ICON_IMAGE_URL_TEMPLATE) {
    return null;
  }

  try {
    const domain = new URL(url).hostname;
    return ICON_IMAGE_URL_TEMPLATE.split("{domain}").join(
      encodeURIComponent(domain),
    );
  } catch {
    return null;
  }
}

export function getSiteIconText({
  title,
  url,
}: {
  title: string;
  url: string;
}) {
  const source = title.trim() || getSiteHostLabel(url);
  return source.slice(0, 1).toUpperCase();
}
