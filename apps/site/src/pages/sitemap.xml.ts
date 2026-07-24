export const prerender = true;

const routes = ["/", "/zh/", "/privacy/", "/zh/privacy/"] as const;

export function GET({ site, url }: { site?: URL; url: URL }) {
  const origin = site ?? new URL(url.origin);
  const urls = routes
    .map((route) => {
      const location = new URL(route, origin);
      return `  <url><loc>${location}</loc></url>`;
    })
    .join("\n");

  return new Response(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      "</urlset>",
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    },
  );
}
