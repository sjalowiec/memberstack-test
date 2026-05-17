/**
 * Temporary entitlement gate for the unified Sleeveless builder review page.
 * TODO: replace temporary gate with real Memberstack entitlement check.
 */

/** localStorage key for dev/testing override (`"1"` = editable, `"0"` = read-only). */
export const SLEEVELESS_PATTERN_ACCESS_LS_KEY = "kbm_sleeveless_advanced_pattern_access";

const ADVANCED_QUERY_PARAM = "advanced";
const CUSTOMIZE_QUERY_PARAM = "customize";

function parseAccessOverride(raw: string | null | undefined): boolean | null {
  const v = raw?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return null;
}

/**
 * When true, review-page measurement fields are editable and full validation runs.
 * When false, measurements are read-only; knitters can still generate/print the pattern.
 *
 * Default: editable (beta / current testing).
 *
 * Force read-only for future free-state testing:
 * - `?advanced=0` or `?customize=0` on the review URL
 * - `localStorage.setItem('kbm_sleeveless_advanced_pattern_access', '0')`
 */
export function resolveHasAdvancedPatternAccess(pageUrl?: URL): boolean {
  let url: URL | null = pageUrl ?? null;
  if (!url && typeof window !== "undefined") {
    try {
      url = new URL(window.location.href);
    } catch {
      url = null;
    }
  }

  if (url) {
    const fromAdvanced = parseAccessOverride(url.searchParams.get(ADVANCED_QUERY_PARAM));
    if (fromAdvanced !== null) return fromAdvanced;
    const fromCustomize = parseAccessOverride(url.searchParams.get(CUSTOMIZE_QUERY_PARAM));
    if (fromCustomize !== null) return fromCustomize;
  }

  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const stored = parseAccessOverride(localStorage.getItem(SLEEVELESS_PATTERN_ACCESS_LS_KEY));
      if (stored !== null) return stored;
    } catch {
      /* ignore */
    }
  }

  // TODO: replace temporary default with real Memberstack entitlement check.
  return true;
}

/** When true, review-page title, notes, measurements, and save controls are editable. */
export function canCustomizePattern(pageUrl?: URL): boolean {
  return resolveHasAdvancedPatternAccess(pageUrl);
}
