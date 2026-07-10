/**
 * URL contract for opening a saved pattern's read-only View page.
 *
 * The saved project id is carried in the `project` query param so the destination pattern page can
 * load that exact project authoritatively � independent of localStorage (working draft,
 * activeProjectId, Express builder mirror, drift-promotion). This closes an intermittent race where
 * opening one saved pattern could render a different, previously-open pattern of the same
 * construction (same destination path).
 */
export const SAVED_PATTERN_VIEW_PROJECT_QUERY_KEY = "project";

const URL_PARSE_BASE = "http://localhost";

function parseBase(): string {
  return typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : URL_PARSE_BASE;
}

/**
 * Append (or replace) the saved project id on a View href. Preserves relative hrefs
 * (e.g. `/patterns/drop-shoulder/pattern/`) and existing query/hash.
 */
export function withSavedPatternProjectId(href: string, projectId: string): string {
  const id = projectId?.trim();
  if (!id) return href;
  try {
    const url = new URL(href, parseBase());
    url.searchParams.set(SAVED_PATTERN_VIEW_PROJECT_QUERY_KEY, id);
    if (/^https?:\/\//i.test(href)) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}${SAVED_PATTERN_VIEW_PROJECT_QUERY_KEY}=${encodeURIComponent(id)}`;
  }
}

/** Read the saved project id from a URL (defaults to the current location). Returns "" when absent. */
export function readSavedPatternProjectIdFromUrl(
  href: string | undefined = typeof window !== "undefined" ? window.location?.href : undefined,
): string {
  if (!href) return "";
  try {
    const url = new URL(href, parseBase());
    return url.searchParams.get(SAVED_PATTERN_VIEW_PROJECT_QUERY_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Remove the `project` id from the current location without reloading. Called when the requested
 * project could not be loaded, so the page falls back to normal reconciliation / self-heal.
 */
export function stripSavedPatternProjectIdFromLocation(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SAVED_PATTERN_VIEW_PROJECT_QUERY_KEY)) return;
    url.searchParams.delete(SAVED_PATTERN_VIEW_PROJECT_QUERY_KEY);
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
  } catch {
    /* ignore */
  }
}

/** Synchronous gate � true when the URL still carries an authoritative saved project id. */
export function hasAuthoritativeUrlSavedPatternId(href?: string): boolean {
  return Boolean(readSavedPatternProjectIdFromUrl(href));
}
