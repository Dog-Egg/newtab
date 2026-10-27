export function getFaviconUrl(pageUrl: string): string | null {
  if (import.meta.env.MODE !== "extension") return null;

  try {
    const page = new URL(pageUrl);
    if (page.protocol !== "http:" && page.protocol !== "https:") return null;

    const favicon = new URL(chrome.runtime.getURL("/_favicon/"));
    favicon.searchParams.set("pageUrl", page.href);
    favicon.searchParams.set("size", "64");
    return favicon.href;
  } catch {
    return null;
  }
}
