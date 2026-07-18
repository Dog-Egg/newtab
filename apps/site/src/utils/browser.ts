export type SupportedBrowser = "chrome" | "edge" | "unknown";

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>;
  };
};

export function detectSupportedBrowser(
  navigatorValue: NavigatorWithUserAgentData = navigator,
): SupportedBrowser {
  const brands = navigatorValue.userAgentData?.brands ?? [];

  if (brands.some(({ brand }) => brand === "Microsoft Edge")) {
    return "edge";
  }

  if (brands.some(({ brand }) => brand === "Google Chrome")) {
    return "chrome";
  }

  const userAgent = navigatorValue.userAgent;

  if (/Edg\//.test(userAgent)) {
    return "edge";
  }

  if (/Chrome\//.test(userAgent) && !/OPR\//.test(userAgent)) {
    return "chrome";
  }

  return "unknown";
}
