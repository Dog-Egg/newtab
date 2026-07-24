import projectConfig from "../../../../project.config.json";

interface PageStructuredDataOptions {
  path: string;
  title: string;
  description: string;
  lang: string;
  imageAlt: string;
  includeSoftwareApplication?: boolean;
}

const siteUrl = new URL(projectConfig.site.url);
const rootUrl = new URL("/", siteUrl).toString();
const websiteId = `${rootUrl}#website`;
const softwareId = `${rootUrl}#software`;

function toAbsoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

function cleanUrl(value: string) {
  const url = new URL(value);

  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

export function createPageStructuredData({
  path,
  title,
  description,
  lang,
  imageAlt,
  includeSoftwareApplication = false,
}: PageStructuredDataOptions) {
  const pageUrl = toAbsoluteUrl(path);
  const webpageId = `${pageUrl}#webpage`;
  const imageId = `${pageUrl}#primaryimage`;
  const chromeStoreUrl = cleanUrl(projectConfig.links.stores.chrome);
  const sameAs = [projectConfig.links.source, chromeStoreUrl];

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: rootUrl,
      name: projectConfig.product.name,
      inLanguage: ["en", "zh-CN"],
    },
    {
      "@type": "ImageObject",
      "@id": imageId,
      url: toAbsoluteUrl("/og.png"),
      contentUrl: toAbsoluteUrl("/og.png"),
      width: 1200,
      height: 630,
      caption: imageAlt,
      inLanguage: lang,
    },
    {
      "@type": "WebPage",
      "@id": webpageId,
      url: pageUrl,
      name: title,
      description,
      inLanguage: lang,
      isPartOf: { "@id": websiteId },
      primaryImageOfPage: { "@id": imageId },
      ...(includeSoftwareApplication
        ? { mainEntity: { "@id": softwareId } }
        : {}),
    },
  ];

  if (includeSoftwareApplication) {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": softwareId,
      name: projectConfig.product.name,
      url: rootUrl,
      image: { "@id": imageId },
      applicationCategory: "BrowserApplication",
      applicationSubCategory: "New tab browser extension",
      operatingSystem: ["Windows", "macOS", "Linux", "ChromeOS"],
      softwareRequirements: "Google Chrome or Microsoft Edge",
      isAccessibleForFree: true,
      installUrl: chromeStoreUrl,
      sameAs,
      offers: {
        "@type": "Offer",
        url: chromeStoreUrl,
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
