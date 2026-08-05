/**
 * Presentation-only hint that this browser already joined / clicked through
 * as a Tip of the Week email subscriber. Never authentication or authorization.
 * Never stores name or email.
 */

export const WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY =
  "kin:weekly-tip-subscriber-recognized-at";

/** One calendar year in milliseconds. */
export const WEEKLY_TIP_SUBSCRIBER_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const WEEKLY_TIP_SUBSCRIBER_QUERY_PARAM = "subscriber";
export const WEEKLY_TIP_SUBSCRIBER_QUERY_VALUE = "1";

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Parse a stored recognition timestamp. Invalid / missing → null. */
export function parseWeeklyTipSubscriberRecognizedAt(
  raw: string | null | undefined,
): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate) && asDate > 0) return asDate;
  return null;
}

export function isWeeklyTipSubscriberRecognizedAt(
  recognizedAt: number | null,
  now: number = Date.now(),
  ttlMs: number = WEEKLY_TIP_SUBSCRIBER_TTL_MS,
): boolean {
  if (recognizedAt == null || !Number.isFinite(recognizedAt) || recognizedAt <= 0) {
    return false;
  }
  if (recognizedAt > now + 60_000) {
    // Future timestamps are treated as invalid (clock skew / tampering).
    return false;
  }
  return now - recognizedAt < ttlMs;
}

export function readWeeklyTipSubscriberRecognizedAt(
  storage: Storage | null = getLocalStorage(),
): number | null {
  if (!storage) return null;
  try {
    return parseWeeklyTipSubscriberRecognizedAt(
      storage.getItem(WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

/**
 * Store / refresh the recognition timestamp. Returns false when storage is
 * unavailable — callers must fail safely and keep the tip page working.
 */
export function markWeeklyTipSubscriberRecognized(
  now: number = Date.now(),
  storage: Storage | null = getLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(WEEKLY_TIP_SUBSCRIBER_STORAGE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export function isWeeklyTipSubscriberRecognized(
  now: number = Date.now(),
  storage: Storage | null = getLocalStorage(),
): boolean {
  return isWeeklyTipSubscriberRecognizedAt(
    readWeeklyTipSubscriberRecognizedAt(storage),
    now,
  );
}

/** True when the URL carries the ActiveCampaign presentation hint `subscriber=1`. */
export function urlHasWeeklyTipSubscriberHint(
  search: string | URLSearchParams,
): boolean {
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search,
        )
      : search;
  return params.get(WEEKLY_TIP_SUBSCRIBER_QUERY_PARAM) === WEEKLY_TIP_SUBSCRIBER_QUERY_VALUE;
}

/**
 * Remove only `subscriber` from the query string. Preserves other params and hash.
 * Returns the path + search + hash suitable for history.replaceState.
 */
export function stripWeeklyTipSubscriberParam(
  pathname: string,
  search: string,
  hash: string,
): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  params.delete(WEEKLY_TIP_SUBSCRIBER_QUERY_PARAM);
  const nextSearch = params.toString();
  return `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash || ""}`;
}

/**
 * If `subscriber=1` is present: mark recognition, strip the param from the
 * visible URL via history.replaceState, preserve other params/hash.
 * Returns whether the hint was present and applied.
 */
export function applyWeeklyTipSubscriberQueryHint(options: {
  search?: string;
  pathname?: string;
  hash?: string;
  now?: number;
  storage?: Storage | null;
  replaceState?: (url: string) => void;
}): boolean {
  const search = options.search ?? "";
  if (!urlHasWeeklyTipSubscriberHint(search)) return false;

  markWeeklyTipSubscriberRecognized(options.now, options.storage);

  const pathname = options.pathname ?? "/";
  const hash = options.hash ?? "";
  const nextUrl = stripWeeklyTipSubscriberParam(pathname, search, hash);
  const replace =
    options.replaceState ??
    ((url: string) => {
      if (typeof history !== "undefined" && typeof history.replaceState === "function") {
        history.replaceState(history.state, "", url);
      }
    });
  try {
    replace(nextUrl);
  } catch {
    /* history unavailable — tip page still works */
  }
  return true;
}
