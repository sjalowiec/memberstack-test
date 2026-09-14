/**
 * Watch-page return link (`Back to Videos` / `Back to Search Results`).
 *
 * Reconstructs `/videos?q=&cat=&sort=` as the href fallback. Uses
 * `history.back()` only when the previous same-origin document was the
 * Videos catalog, matching Tools/Patterns WizardBackLink without following
 * unrelated history.
 */

export const VIDEOS_WATCH_BACK_LINK_SELECTOR = ".back-to-videos-link";
export const VIDEOS_CATALOG_PATH = "/videos";

function queryFromSearch(search: string): string {
  const raw = String(search ?? "");
  if (!raw) return "";
  return raw.startsWith("?") ? raw : `?${raw}`;
}

/** Catalog href copied from the watch page query (`?q=` / `?cat=` / `?sort=`). */
export function videosCatalogHrefFromWatchSearch(search: string): string {
  const qs = queryFromSearch(search);
  return qs ? `${VIDEOS_CATALOG_PATH}${qs}` : VIDEOS_CATALOG_PATH;
}

/** Label suffix: Search Results, "{cat} Videos", or Videos. */
export function videosWatchBackLabelSuffix(search: string): string {
  const params = new URLSearchParams(queryFromSearch(search));
  const cat = params.get("cat");
  const q = params.get("q");
  if (cat) return `${cat} Videos`;
  if (q) return "Search Results";
  return "Videos";
}

export function videosWatchBackLinkText(opts: {
  id?: string | null;
  search: string;
}): string {
  const prefix = opts.id === "back-to-videos" ? "← " : "";
  return `${prefix}Back to ${videosWatchBackLabelSuffix(opts.search)}`;
}

function pathnameWithoutTrailingSlash(pathname: string): string {
  const trimmed = String(pathname || "").replace(/\/+$/, "");
  return trimmed || "/";
}

/** True for `/videos` or `/videos/`, not `/videos/{id}` or other Learn routes. */
export function isVideosCatalogPath(pathname: string): boolean {
  return pathnameWithoutTrailingSlash(pathname) === VIDEOS_CATALOG_PATH;
}

export function isVideosCatalogReferrer(
  referrer: string,
  currentOrigin: string,
): boolean {
  const raw = String(referrer || "").trim();
  if (!raw || !currentOrigin) return false;
  try {
    const url = new URL(raw, currentOrigin);
    if (url.origin !== currentOrigin) return false;
    return isVideosCatalogPath(url.pathname);
  } catch {
    return false;
  }
}

export type VideosWatchBackHistoryInput = {
  referrer: string;
  historyLength: number;
  currentOrigin: string;
};

/**
 * Use browser Back only when this tab can return to the Videos catalog.
 * New tabs, pasted URLs, and unrelated referrers keep the reconstructed href.
 */
export function shouldUseVideosCatalogHistoryBack(
  opts: VideosWatchBackHistoryInput,
): boolean {
  if (!Number.isFinite(opts.historyLength) || opts.historyLength <= 1) {
    return false;
  }
  return isVideosCatalogReferrer(opts.referrer, opts.currentOrigin);
}

export function isUnmodifiedPrimaryClick(event: {
  defaultPrevented?: boolean;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): boolean {
  if (event.defaultPrevented) return false;
  if ((event.button ?? 0) !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  return true;
}

export type VideosWatchBackClickEvent = {
  preventDefault(): void;
  defaultPrevented?: boolean;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

/** @returns true when history.back() ran instead of following href. */
export function handleVideosWatchBackLinkClick(
  event: VideosWatchBackClickEvent,
  opts: VideosWatchBackHistoryInput & { back: () => void },
): boolean {
  if (!isUnmodifiedPrimaryClick(event)) return false;
  if (!shouldUseVideosCatalogHistoryBack(opts)) return false;
  event.preventDefault();
  opts.back();
  return true;
}

export type VideosWatchBackLinkElement = {
  id?: string;
  href: string;
  textContent: string | null;
  addEventListener(
    type: "click",
    listener: (event: VideosWatchBackClickEvent) => void,
  ): void;
};

export type BindVideosWatchPageBackLinksOptions = {
  links: Iterable<VideosWatchBackLinkElement> | ArrayLike<VideosWatchBackLinkElement>;
  search: string;
  referrer: string;
  historyLength: number;
  currentOrigin: string;
  back: () => void;
};

export function bindVideosWatchPageBackLinks(
  opts: BindVideosWatchPageBackLinksOptions,
): string {
  const href = videosCatalogHrefFromWatchSearch(opts.search);
  const historyInput: VideosWatchBackHistoryInput = {
    referrer: opts.referrer,
    historyLength: opts.historyLength,
    currentOrigin: opts.currentOrigin,
  };

  for (const el of Array.from(opts.links as ArrayLike<VideosWatchBackLinkElement>)) {
    el.href = href;
    el.textContent = videosWatchBackLinkText({
      id: el.id,
      search: opts.search,
    });
    el.addEventListener("click", (event) => {
      handleVideosWatchBackLinkClick(event, {
        ...historyInput,
        back: opts.back,
      });
    });
  }

  return href;
}
