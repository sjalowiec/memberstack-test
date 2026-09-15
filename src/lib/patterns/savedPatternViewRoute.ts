/**
 * Paid Pattern Builder view vs mutation routes.
 * Used by the membership page gate for former-member read-only exceptions.
 */
import { readSavedPatternProjectIdFromUrl } from "./savedPatternViewUrl";

const PAID_VIEW_PATHS = [
  /^\/patterns\/socks\/pattern\/?$/,
  /^\/patterns\/sleeveless\/pattern\/?$/,
  /^\/patterns\/sleeveless\/print\/?$/,
  /^\/patterns\/drop-shoulder\/pattern\/?$/,
  /^\/patterns\/sideways-cardigan\/pattern\/?$/,
];

const PAID_MUTATION_PATHS = [
  /^\/patterns\/socks\/builder\/?$/,
  /^\/patterns\/socks\/summary\/?$/,
  /^\/patterns\/socks\/edit\/?$/,
  /^\/patterns\/sleeveless\/builder\/?$/,
  /^\/patterns\/sleeveless\/custom-build(?:\/|$)/,
  /^\/patterns\/sleeveless\/custom-style\/?$/,
  /^\/patterns\/sleeveless-express\/?$/,
  /^\/patterns\/drop-shoulder\/builder\/?$/,
  /^\/patterns\/sideways-cardigan\/builder\/?$/,
];

export function pathnameFromHref(
  href: string | undefined = typeof window !== "undefined" ? window.location?.pathname : undefined,
): string {
  if (!href) return "";
  try {
    if (href.startsWith("/")) {
      const url = new URL(href, "http://localhost");
      return url.pathname;
    }
    return new URL(href).pathname;
  } catch {
    return href.split("?")[0] ?? "";
  }
}

export function searchFromHref(
  href: string | undefined = typeof window !== "undefined" ? window.location?.search : undefined,
): string {
  if (href == null) return "";
  try {
    if (href.startsWith("?")) return href;
    if (href.startsWith("/")) return new URL(href, "http://localhost").search;
    return new URL(href).search;
  } catch {
    const q = href.indexOf("?");
    return q >= 0 ? href.slice(q) : "";
  }
}

export function isPaidPatternMutationSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.get("new") === "1") return true;
  const edit = params.get("edit");
  return edit === "1" || edit === "choices";
}

export function isPaidPatternMutationPath(pathname: string): boolean {
  return PAID_MUTATION_PATHS.some((re) => re.test(pathname));
}

export function isPaidSavedPatternViewPath(pathname: string): boolean {
  return PAID_VIEW_PATHS.some((re) => re.test(pathname));
}

/** True when this URL is a paid builder / edit / new-pattern surface. */
export function isPaidPatternMutationRoute(href?: string): boolean {
  const pathname = pathnameFromHref(href);
  const search =
    href && (href.includes("?") || href.startsWith("/"))
      ? searchFromHref(href)
      : typeof window !== "undefined"
        ? window.location?.search ?? ""
        : searchFromHref(href);
  return isPaidPatternMutationPath(pathname) || isPaidPatternMutationSearch(search);
}

/**
 * Completed-pattern view that may use the former-member read-only exception.
 * Requires an explicit `project=` id — leftover localStorage is not enough.
 */
export function isPaidSavedPatternReadOnlyCandidate(href?: string): boolean {
  const pathname = pathnameFromHref(
    href ?? (typeof window !== "undefined" ? window.location?.pathname : undefined),
  );
  if (!isPaidSavedPatternViewPath(pathname)) return false;
  if (isPaidPatternMutationSearch(searchFromHref(href))) return false;
  return Boolean(readSavedPatternProjectIdFromUrl(href));
}
