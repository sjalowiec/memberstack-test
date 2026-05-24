/**
 * Blank Express pattern session — used by Patterns landing “Start a New Pattern” and in-page Start Over.
 * Does not delete saved Blob projects (see {@link clearSleevelessExpressSession}).
 */
import {
  clearSleevelessExpressSession,
  SLEEVELESS_EXPRESS_NEW_SESSION_PARAM,
  SLEEVELESS_EXPRESS_NEW_SESSION_VALUE,
} from "./patternStorage";
import { clearMeasurementOverridesOnWorkingDraft } from "./sleevelessCustomMeasurementStorage";
import {
  clearPatternProjectPrintSession,
  resetPatternProjectMetaForNewDraft,
} from "./sleevelessPatternProjectMeta";

export { SLEEVELESS_EXPRESS_NEW_SESSION_PARAM, SLEEVELESS_EXPRESS_NEW_SESSION_VALUE };

export function startFreshSleevelessExpressPattern(): void {
  clearSleevelessExpressSession();
  clearPatternProjectPrintSession();
  resetPatternProjectMetaForNewDraft();
  clearMeasurementOverridesOnWorkingDraft();
}

export function isSleevelessExpressNewSessionSearchParams(params: URLSearchParams): boolean {
  return params.get(SLEEVELESS_EXPRESS_NEW_SESSION_PARAM) === SLEEVELESS_EXPRESS_NEW_SESSION_VALUE;
}

/** If `?new=1` is present, clear working session storage and remove the flag from the address bar. */
export function applySleevelessExpressNewSessionFromUrl(href = window.location.href): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(href, window.location.origin);
    if (!isSleevelessExpressNewSessionSearchParams(url.searchParams)) return false;
    startFreshSleevelessExpressPattern();
    url.searchParams.delete(SLEEVELESS_EXPRESS_NEW_SESSION_PARAM);
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}
