/**
 * Open the shared site search modal from `?search=open`, then strip that param
 * from the visible URL without a reload. Uses the caller's `open` callback so
 * the Header keeps a single open path (same as the magnifying-glass button).
 */

export const SITE_SEARCH_OPEN_PARAM = "search";
export const SITE_SEARCH_OPEN_VALUE = "open";

const URL_PARSE_BASE = "http://localhost";

/** One-shot for this JS realm so re-running boot / history noise cannot reopen. */
let consumedThisLoad = false;

function parseBase(): string {
  return typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : URL_PARSE_BASE;
}

function searchParamsFrom(input: string | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  const raw = String(input ?? "");
  if (!raw) return new URLSearchParams();
  if (raw.startsWith("?")) return new URLSearchParams(raw.slice(1));
  try {
    return new URL(raw, parseBase()).searchParams;
  } catch {
    return new URLSearchParams(raw);
  }
}

export function shouldOpenSiteSearchFromUrl(
  searchOrHref: string | URLSearchParams = typeof window !== "undefined"
    ? window.location?.search ?? ""
    : "",
): boolean {
  try {
    return searchParamsFrom(searchOrHref).get(SITE_SEARCH_OPEN_PARAM) === SITE_SEARCH_OPEN_VALUE;
  } catch {
    return false;
  }
}

/**
 * Return pathname + search + hash with `search=open` removed.
 * Preserves every other query parameter and the hash.
 */
export function hrefWithoutSiteSearchOpen(href: string): string {
  const url = new URL(href, parseBase());
  if (url.searchParams.get(SITE_SEARCH_OPEN_PARAM) !== SITE_SEARCH_OPEN_VALUE) {
    const qs = url.searchParams.toString();
    return `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
  }
  url.searchParams.delete(SITE_SEARCH_OPEN_PARAM);
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
}

export type OpenSiteSearchFromUrlOptions = {
  /** Full href or location.href; defaults to `window.location.href`. */
  href?: string;
  /** Must invoke the same open path as the header search button. */
  open: () => void;
  /** Defaults to `history.replaceState` on the current window. */
  replaceState?: (url: string) => void;
};

/**
 * If the URL asks for search (`?search=open`), open once, then strip the param.
 * Returns true when the modal open was requested and performed.
 */
export function openSiteSearchFromUrlIfRequested(
  options: OpenSiteSearchFromUrlOptions,
): boolean {
  if (consumedThisLoad) return false;

  const href =
    options.href ??
    (typeof window !== "undefined" ? window.location?.href : undefined);
  if (!href || !shouldOpenSiteSearchFromUrl(href)) return false;

  consumedThisLoad = true;

  const next = hrefWithoutSiteSearchOpen(href);
  options.open();

  const replace =
    options.replaceState ??
    ((path: string) => {
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState({}, "", path);
      }
    });
  replace(next);

  return true;
}

/** Reset one-shot guard between unit tests. */
export function resetSiteSearchOpenFromUrlForTests(): void {
  consumedThisLoad = false;
}
