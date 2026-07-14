/**
 * Entitlement gate for advanced Sleeveless customization (measurement fine-tuning) on the
 * unified review page.
 *
 * Resolution order: explicit dev/test overrides (query param, then localStorage) win; otherwise
 * the resolved Memberstack access snapshot decides (`hasSystemAccess`). Before the async snapshot
 * resolves, callers that have not awaited resolution fall back to locked (non-member) so free and
 * downgraded users are not briefly granted member-only controls. Review-page scripts await
 * {@link resolveSleevelessUserAccess} first so the snapshot is primed before reading.
 */
import { getCachedSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";
import {
  hasPatternSystemAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolvePatternSystemForEntitlement } from "./patternSystemId";

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
 * Default: locked until access resolves (conservative for free / downgraded users).
 *
 * Force read-only for future free-state testing:
 * - `?advanced=0` or `?customize=0` on the review URL
 * - `localStorage.setItem('kbm_sleeveless_advanced_pattern_access', '0')`
 */
/**
 * Explicit dev/test override (query param, then localStorage), or null when none is set.
 * Shared by the cache-reading and access-aware resolvers so overrides behave identically.
 */
function readAdvancedPatternAccessOverride(pageUrl?: URL): boolean | null {
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

  return null;
}

export function resolveHasAdvancedPatternAccess(pageUrl?: URL): boolean {
  const override = readAdvancedPatternAccessOverride(pageUrl);
  if (override !== null) return override;

  const access = getCachedSleevelessUserAccess();
  if (access) {
    return hasPatternSystemAccess(access, resolvePatternSystemForEntitlement());
  }

  // Snapshot not resolved yet — default locked so non-members are not briefly unlocked.
  return false;
}

/**
 * Same as {@link resolveHasAdvancedPatternAccess} but decided against an explicitly-resolved access
 * snapshot rather than the shared cache. Use this on pages that resolve access without priming the
 * cache (e.g. My Patterns), so the gate reflects the real entitlement instead of the open default.
 */
export function resolveHasAdvancedPatternAccessForAccess(
  access: SleevelessUserAccess | null,
  pageUrl?: URL,
): boolean {
  const override = readAdvancedPatternAccessOverride(pageUrl);
  if (override !== null) return override;
  if (access) {
    return hasPatternSystemAccess(access, resolvePatternSystemForEntitlement());
  }
  return resolveHasAdvancedPatternAccess(pageUrl);
}

/** When true, review-page title, notes, measurements, and save controls are editable. */
export function canCustomizePattern(pageUrl?: URL): boolean {
  return resolveHasAdvancedPatternAccess(pageUrl);
}
