export const prerender = true;

export function GET({ site, url }: { site?: URL; url: URL }) {
  const origin = site ?? new URL(url.origin);
  const sitemapUrl = new URL("/sitemap.xml", origin);

  return new Response(
    ["User-agent: *", "Allow: /", `Sitemap: ${sitemapUrl}`, ""].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
