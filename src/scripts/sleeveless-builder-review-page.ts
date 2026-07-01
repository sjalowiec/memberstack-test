/**
 * Unified Sleeveless review (`/patterns/sleeveless/review`).
 * Gates read-only vs editable summary (measurements, title, notes) via `canCustomizePattern`.
 */
import { canCustomizePattern } from "../lib/patterns/sleevelessPatternAccessGate";
import {
  canEditSleevelessPatternSettings,
  hasSleevelessPatternSystemAccess,
  type SleevelessUserAccess,
} from "../lib/patterns/sleevelessPatternSystemAccess";
import { isFreeClaimedForSystem } from "../lib/patterns/patternSystemFreeClaim";
import {
  patternSystemDisplayName,
  resolvePatternSystemFromPage,
} from "../lib/patterns/patternSystemId";
import { resolveSleevelessUserAccess } from "../lib/patterns/sleevelessPatternSystemAccessClient";
import { initSleevelessLockedBannerDismiss } from "./sleevelessLockedBannerDismiss";
import { initExpressYarnDrawer } from "./sleeveless-express-measurements-page";
import { initCustomBuildMeasurementsPage } from "./sleeveless-custom-build-measurements-page";
import { flushExpressWizardToCanonicalPattern } from "../lib/patterns/flushExpressWizardToCanonicalPattern";
import { loadExpressSweaterCharts } from "../lib/patterns/sleevelessExpressSizeChartClient";
import { prepareCustomBuildPatternGeneration } from "../lib/patterns/prepareCustomBuildPatternGeneration";
import { navigateToPatternWithUnsavedEditsGuard } from "../lib/patterns/savedCustomPatternUnsavedViewGuard";
import { logSleevelessPatternActivity } from "../lib/patterns/sleevelessPatternActivity";

const DEFAULT_PATTERN_WORKSPACE_TAB_PATTERN_HREF = "/patterns/sleeveless/pattern/?tab=pattern";

/**
 * Where "Build My Pattern" navigates. Configurable so construction variants (e.g. drop shoulder)
 * can route to their own dedicated pattern workspace via `data-pattern-workspace-href` on the
 * review root. Falls back to the shared sleeveless workspace.
 */
function resolvePatternWorkspaceHref(): string {
  if (typeof document === "undefined") return DEFAULT_PATTERN_WORKSPACE_TAB_PATTERN_HREF;
  const root = document.querySelector<HTMLElement>("[data-express-measurements-root]");
  const href = root?.getAttribute("data-pattern-workspace-href")?.trim();
  return href || DEFAULT_PATTERN_WORKSPACE_TAB_PATTERN_HREF;
}

const PATTERN_WORKSPACE_TAB_PATTERN_HREF = resolvePatternWorkspaceHref();

export { flushExpressWizardToCanonicalPattern as flushExpressWizardToCanonicalPatternForReview };

function syncExpressBasicsFromBuilderAndContinue(): void {
  flushExpressWizardToCanonicalPattern();
  void navigateToPatternWithUnsavedEditsGuard({ href: PATTERN_WORKSPACE_TAB_PATTERN_HREF });
}

function configureReviewActions(advanced: boolean): void {
  const cbContinue = document.querySelector("[data-cb-measure-continue]");
  const unitsHost = document.querySelector("[data-express-measurements-units-host]");

  cbContinue?.removeAttribute("hidden");
  if (advanced) {
    unitsHost?.setAttribute("hidden", "");
  } else {
    unitsHost?.removeAttribute("hidden");
  }
}

function continueToPatternFromReview(): void {
  void loadExpressSweaterCharts()
    .then(async () => {
      prepareCustomBuildPatternGeneration({ root: document });
      flushExpressWizardToCanonicalPattern();
      logSleevelessPatternActivity("pattern_generated");
      if (canCustomizePattern()) {
        await navigateToPatternWithUnsavedEditsGuard({ href: PATTERN_WORKSPACE_TAB_PATTERN_HREF });
        return;
      }
      syncExpressBasicsFromBuilderAndContinue();
    })
    .catch(() => {
      window.alert("Could not load size charts. Check your connection and try again.");
    });
}

/**
 * TEMP DEV: local-only override set by the inline script in review.astro
 * (`DEBUG_FORCE_FREE_USER`). When present, lock the member-only measurement
 * customization controls so the free/non-member experience can be tested while
 * logged in as a member. Remove together with DEBUG_FORCE_FREE_USER. Does not
 * touch the real entitlement/Memberstack logic.
 */
function isDebugForceFreeUser(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __KBM_DEBUG_FORCE_FREE_USER__?: boolean }).__KBM_DEBUG_FORCE_FREE_USER__ === true
  );
}

const LOCKED_BANNER_BODY_UNCLAIMED =
  "You're viewing the measurements from your choices. Editing is included with membership when you want to customize fit, gauge, or style choices.";
const LOCKED_BANNER_BODY_CLAIMED =
  "You can still view, print, rename, and use this pattern. Editing is included with membership.";

/** Show exactly one access banner based on resolved entitlement. */
function applyReviewAccessBanners(access: SleevelessUserAccess, forceFree: boolean): void {
  const paid = document.querySelector<HTMLElement>("[data-sleeveless-review-access-paid]");
  const locked = document.querySelector<HTMLElement>("[data-sleeveless-review-access-locked]");
  const strip = document.querySelector<HTMLElement>("[data-sleeveless-locked-banner-expand]");
  const hasAccess = hasSleevelessPatternSystemAccess(access) && !forceFree;

  if (hasAccess) {
    locked?.setAttribute("hidden", "");
    strip?.setAttribute("hidden", "");
    paid?.removeAttribute("hidden");
    return;
  }

  paid?.setAttribute("hidden", "");
  const lockedBody = document.querySelector<HTMLElement>(
    "[data-sleeveless-review-access-locked-body]",
  );
  if (lockedBody) {
    const system = resolvePatternSystemFromPage();
    const claimed = isFreeClaimedForSystem(access.freeClaimsBySystem, system);
    lockedBody.textContent = claimed
      ? LOCKED_BANNER_BODY_CLAIMED
      : LOCKED_BANNER_BODY_UNCLAIMED.replace(
          "membership",
          `membership for your ${patternSystemDisplayName(system)} pattern`,
        );
  }
  // Reveals the locked banner (or its collapsed strip) honoring the saved dismiss state.
  initSleevelessLockedBannerDismiss();
}

/**
 * The primary action doubles as "build" (creation flow) and "view" (locked, already-claimed
 * pattern). Relabel it to "View My Pattern" when settings editing is locked so a read-only
 * user is not led to believe the pattern can be regenerated.
 */
function applyReviewContinueButtonLabel(canEditSettings: boolean): void {
  if (canEditSettings) return;
  const cbContinue = document.querySelector<HTMLElement>("[data-cb-measure-continue]");
  if (!cbContinue) return;
  const viewLabel = "View My Pattern";
  cbContinue.setAttribute("data-cb-measure-continue-default", viewLabel);
  cbContinue.textContent = viewLabel;
}

async function initUnifiedSleevelessReviewPage(): Promise<void> {
  const forceFree = isDebugForceFreeUser();
  const access = await resolveSleevelessUserAccess();
  applyReviewAccessBanners(access, forceFree);

  const advanced = canCustomizePattern() && hasSleevelessPatternSystemAccess(access) && !forceFree;
  const canEditSettings =
    canEditSleevelessPatternSettings(access, resolvePatternSystemFromPage()) && !forceFree;
  applyReviewContinueButtonLabel(canEditSettings);
  configureReviewActions(advanced);
  initExpressYarnDrawer();

  if (advanced) {
    initCustomBuildMeasurementsPage({
      continueHref: PATTERN_WORKSPACE_TAB_PATTERN_HREF,
      onContinue: continueToPatternFromReview,
      preserveUnitsHost: true,
    });
    return;
  }

  initCustomBuildMeasurementsPage({
    readOnly: true,
    preserveUnitsHost: true,
    onContinue: continueToPatternFromReview,
  });
}

if (typeof document !== "undefined") {
  const boot = (): void => {
    void initUnifiedSleevelessReviewPage();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
