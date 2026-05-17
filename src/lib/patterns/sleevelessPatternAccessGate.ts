/**
 * Temporary entitlement gate for the unified Sleeveless builder review page.
 * TODO: replace temporary gate with real Memberstack entitlement check.
 */

/** localStorage key for dev/testing override (`"1"` = advanced, `"0"` = free). */
export const SLEEVELESS_PATTERN_ACCESS_LS_KEY = "kbm_sleeveless_advanced_pattern_access";

const QUERY_PARAM = "advanced";

/**
 * When true, review-page measurement fields are editable and full validation runs.
 * When false, measurements are read-only; knitters can still generate/print the pattern.
 *
 * Testing (any one enables advanced):
 * - `?advanced=1` on the review URL
 * - `localStorage.setItem('kbm_sleeveless_advanced_pattern_access', '1')`
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
    const qp = url.searchParams.get(QUERY_PARAM)?.trim().toLowerCase();
    if (qp === "1" || qp === "true" || qp === "yes") return true;
    if (qp === "0" || qp === "false" || qp === "no") return false;
  }

  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(SLEEVELESS_PATTERN_ACCESS_LS_KEY)?.trim().toLowerCase();
      if (stored === "1" || stored === "true" || stored === "yes") return true;
      if (stored === "0" || stored === "false" || stored === "no") return false;
    } catch {
      /* ignore */
    }
  }

  /** Default for migration testing: free / read-only until Memberstack is wired. */
  // TODO: replace temporary gate with real Memberstack entitlement check.
  const hasAdvancedPatternAccess = false;
  return hasAdvancedPatternAccess;
}
