/**
 * Entitlement gate for advanced Sleeveless customization (measurement fine-tuning) on the
 * unified review page.
 *
 * Resolution order: in development only, explicit overrides (query param, then localStorage)
 * may win; otherwise the resolved Memberstack access snapshot decides. Production builds always
 * ignore query-string and localStorage bypasses. Before the async snapshot resolves, callers that
 * have not awaited resolution fall back to locked so non-members are not briefly granted controls.
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

export type AdvancedAccessResolveOptions = {
  /**
   * When true, ignore query/localStorage overrides (simulates production).
   * Production builds always ignore overrides regardless of this flag.
   */
  ignoreDevOverrides?: boolean;
};

/** True only in local/dev builds — never in production. */
export function isAdvancedAccessDevOverrideEnabled(
  options?: AdvancedAccessResolveOptions,
): boolean {
  if (options?.ignoreDevOverrides === true) return false;
  return Boolean(import.meta.env?.DEV);
}

function parseAccessOverride(raw: string | null | undefined): boolean | null {
  const v = raw?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return null;
}

/**
 * Explicit dev/test override (query param, then localStorage), or null when none is set /
 * overrides are disabled (production).
 */
function readAdvancedPatternAccessOverride(
  pageUrl?: URL,
  options?: AdvancedAccessResolveOptions,
): boolean | null {
  if (!isAdvancedAccessDevOverrideEnabled(options)) return null;

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

  if (typeof localStorage !== "undefined") {
    try {
      const stored = parseAccessOverride(localStorage.getItem(SLEEVELESS_PATTERN_ACCESS_LS_KEY));
      if (stored !== null) return stored;
    } catch {
      /* ignore */
    }
  }

  return null;
}

export function resolveHasAdvancedPatternAccess(
  pageUrl?: URL,
  options?: AdvancedAccessResolveOptions,
): boolean {
  const override = readAdvancedPatternAccessOverride(pageUrl, options);
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
 * snapshot rather than the shared cache.
 */
export function resolveHasAdvancedPatternAccessForAccess(
  access: SleevelessUserAccess | null,
  pageUrl?: URL,
  options?: AdvancedAccessResolveOptions,
): boolean {
  const override = readAdvancedPatternAccessOverride(pageUrl, options);
  if (override !== null) return override;
  if (access) {
    return hasPatternSystemAccess(access, resolvePatternSystemForEntitlement());
  }
  return resolveHasAdvancedPatternAccess(pageUrl, options);
}

/** When true, review-page title, notes, measurements, and save controls are editable. */
export function canCustomizePattern(
  pageUrl?: URL,
  options?: AdvancedAccessResolveOptions,
): boolean {
  return resolveHasAdvancedPatternAccess(pageUrl, options);
}
