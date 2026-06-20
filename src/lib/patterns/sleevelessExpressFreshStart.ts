/**
 * Blank Express pattern session — used by Patterns landing “Start a New Pattern” and in-page Start Over.
 * Does not delete saved Blob projects (see {@link clearSleevelessExpressSession}).
 */
import {
  clearSleevelessExpressSession,
  savePatternData,
  SLEEVELESS_EXPRESS_NEW_SESSION_PARAM,
  SLEEVELESS_EXPRESS_NEW_SESSION_VALUE,
} from "./patternStorage";
import { clearSavedCustomPatternDirtyBaseline } from "./customPatternSavedProjectDirtyState";
import { clearMeasurementOverridesOnWorkingDraft } from "./sleevelessCustomMeasurementStorage";
import {
  clearPatternProjectPrintSession,
  resetPatternProjectMetaForNewDraft,
} from "./sleevelessPatternProjectMeta";
import { logSleevelessPatternActivity } from "./sleevelessPatternActivity";
import { stampDropShoulderWorkingDraftFromPage } from "./patternConstructionIdentity";
import { clearDropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";

export { SLEEVELESS_EXPRESS_NEW_SESSION_PARAM, SLEEVELESS_EXPRESS_NEW_SESSION_VALUE };

export function startFreshSleevelessExpressPattern(): void {
  clearSleevelessExpressSession();
  clearPatternProjectPrintSession();
  resetPatternProjectMetaForNewDraft();
  clearMeasurementOverridesOnWorkingDraft();
  clearDropShoulderUserEditedSleeveFields();
  clearSavedCustomPatternDirtyBaseline();
  // Mark the fresh session as Express via the builder-data hint only (canonical stays an empty
  // draft so cross-user/start-new guards still see a blank pattern). Without this, a later
  // Customize/review sync (syncCustomBuildToPatternStorage) defaults to custom-build; resolving from
  // the builder-data mode keeps a fresh Express start truly express, and the sync writes it through.
  savePatternData("style", { patternMode: "express" });
  stampDropShoulderWorkingDraftFromPage();
  // Best-effort: record that a logged-in knitter started a fresh pattern. The session was just
  // cleared, so no id/title/mode context is available — that is expected for a new draft.
  logSleevelessPatternActivity("pattern_started", { mode: "express" });
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
