import { PATTERN_CATALOG_HREF } from "../patterns/customPatternProjectNavigation";

export const SWEATER_SIZING_CHART_PATH = "/reference/sweater-sizing-chart";

export const SWEATER_SIZING_CHART_RETURN_LABEL = "Return to Pattern Builder";
export const SWEATER_SIZING_CHART_FALLBACK_LABEL = "Back to Patterns";

/** Query keys worth preserving when returning from the sizing chart to a builder. */
export const BUILDER_RETURN_TO_PRESERVED_QUERY_KEYS = ["edit"] as const;

/**
 * Reject external or malformed return paths. Accepts same-site relative paths only
 * (must start with `/`, not `//`, no URL scheme).
 */
export function sanitizeReturnToPath(returnTo: string | null | undefined): string | null {
  if (!returnTo) return null;
  const trimmed = returnTo.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (trimmed.includes("\\")) return null;

  try {
    const url = new URL(trimmed, "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Build a builder return path, preserving safe query keys from the current location. */
export function buildBuilderReturnToPath(
  builderPath: string,
  search: string | URLSearchParams = "",
): string {
  const path = builderPath.trim();
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const preserved = new URLSearchParams();
  for (const key of BUILDER_RETURN_TO_PRESERVED_QUERY_KEYS) {
    const value = params.get(key);
    if (value) preserved.set(key, value);
  }
  const qs = preserved.toString();
  return qs ? `${path}?${qs}` : path;
}

export function buildSweaterSizingChartHref(
  builderPath: string,
  search: string | URLSearchParams = "",
): string {
  const returnTo = buildBuilderReturnToPath(builderPath, search);
  return `${SWEATER_SIZING_CHART_PATH}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function resolveSweaterSizingChartBackLink(returnToRaw: string | null | undefined): {
  href: string;
  label: string;
} {
  const safeReturnTo = sanitizeReturnToPath(returnToRaw);
  if (safeReturnTo) {
    return { href: safeReturnTo, label: SWEATER_SIZING_CHART_RETURN_LABEL };
  }
  return { href: PATTERN_CATALOG_HREF, label: SWEATER_SIZING_CHART_FALLBACK_LABEL };
}

/** Keep the builder sizing-chart link in sync with the current URL (preserves edit=choices, etc.). */
export function wireExpressSweaterSizingChartLink(
  builderPath: string,
  linkSelector = ".express-size-chart-link-wrap a",
): void {
  if (typeof document === "undefined") return;
  const link = document.querySelector<HTMLAnchorElement>(linkSelector);
  if (!link) return;
  link.href = buildSweaterSizingChartHref(builderPath, window.location.search);
}
