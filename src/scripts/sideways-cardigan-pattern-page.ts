/**
 * Sideways V-Neck Sweater workspace — Cardigan BODY Lego instructions plus the
 * existing sleeve sequence. Does not boot the Sleeveless page initializer.
 */
import {
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import {
  loadSidewaysCardiganWorkspaceView,
} from "../lib/patterns/sidewaysCardiganWorkspaceLoad";
import { applySavedPatternUnavailableMessage, ensureUrlRequestedSavedPatternHydrated } from "../lib/patterns/ensureUrlRequestedSavedPattern";
import { SAVED_PATTERN_UNAVAILABLE_BODY } from "../lib/patterns/savedPatternAccessState";
import { readActiveCustomPatternProjectId } from "../lib/patterns/customPatternProjectActiveId";
import { buildSidewaysCardiganSummaryEditFromPatternHref } from "../lib/patterns/sidewaysCardiganPatternNavigation";
import { hydrateGlossaryTooltipPlaceholders } from "../lib/glossary/glossaryTooltipHydrate";
import { bindPatternSectionCollapse } from "../lib/patterns/sleevelessPatternDisplayHtml";
import { initChartProgressTracking } from "./chartProgressTracker";
import { getCurrentPattern } from "../lib/patterns/patternStorage";

function renderView(): void {
  stampSidewaysCardiganWorkingDraftFromPage();

  const missing = document.querySelector("[data-sideways-calc-missing]");
  const host = document.querySelector("[data-sideways-calc-host]");
  const errorEl = document.querySelector("[data-sideways-calc-error]");
  const sequenceEl = document.querySelector("[data-sideways-body-sequence]");
  const sleeveHost = document.querySelector("[data-sideways-sleeve-host]");
  const sleeveEl = document.querySelector("[data-sideways-sleeve-sequence]");
  const sleeveErrorEl = document.querySelector("[data-sideways-sleeve-error]");
  if (!(missing instanceof HTMLElement) || !(host instanceof HTMLElement)) {
    return;
  }

  const showDiagnostic = (message: string): void => {
    missing.hidden = false;
    missing.textContent = message;
    host.hidden = true;
    if (errorEl instanceof HTMLElement) {
      errorEl.hidden = false;
      errorEl.textContent = message;
    }
    if (sequenceEl instanceof HTMLElement) sequenceEl.innerHTML = "";
    if (sleeveHost instanceof HTMLElement) sleeveHost.hidden = true;
    if (sleeveEl instanceof HTMLElement) sleeveEl.innerHTML = "";
    if (sleeveErrorEl instanceof HTMLElement) {
      sleeveErrorEl.hidden = true;
      sleeveErrorEl.textContent = "";
    }
  };

  let view;
  try {
    view = loadSidewaysCardiganWorkspaceView();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showDiagnostic(
      import.meta.env.DEV
        ? `[DEV] Sideways V-Neck Sweater workspace failed to load: ${detail}`
        : "This Sideways V-Neck Sweater could not be loaded from the saved draft.",
    );
    return;
  }

  if (!view.ok) {
    showDiagnostic(view.message);
    return;
  }

  missing.hidden = true;
  missing.textContent = "";
  host.hidden = false;
  if (errorEl instanceof HTMLElement) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  if (sequenceEl instanceof HTMLElement) {
    if (view.instructionError) {
      sequenceEl.replaceChildren();
      const note = document.createElement("p");
      note.className = "sg-fit-size-copy";
      note.textContent = view.instructionError;
      sequenceEl.append(note);
    } else {
      sequenceEl.innerHTML = view.sequenceHtml;
      bindPatternSectionCollapse(sequenceEl);
      hydrateGlossaryTooltipPlaceholders(sequenceEl);
      try {
        const patternId = String(getCurrentPattern()?.id ?? "").trim();
        if (patternId) {
          initChartProgressTracking({ root: sequenceEl, patternId });
        }
      } catch {
        /* pattern id is optional for checklist persistence */
      }
    }
  }

  const hasSleeveContent = Boolean(view.sleeveHtml) || Boolean(view.sleeveError);
  if (sleeveHost instanceof HTMLElement) {
    sleeveHost.hidden = !hasSleeveContent;
  }
  if (sleeveErrorEl instanceof HTMLElement) {
    if (view.sleeveError) {
      sleeveErrorEl.hidden = false;
      sleeveErrorEl.textContent = view.sleeveError;
    } else {
      sleeveErrorEl.hidden = true;
      sleeveErrorEl.textContent = "";
    }
  }
  if (sleeveEl instanceof HTMLElement) {
    sleeveEl.innerHTML = view.sleeveError ? "" : view.sleeveHtml;
  }
}

function wireEditPatternLink(): void {
  const edit = document.querySelector("[data-sideways-edit-open]");
  if (!(edit instanceof HTMLAnchorElement)) return;
  edit.href = buildSidewaysCardiganSummaryEditFromPatternHref(readActiveCustomPatternProjectId());
}

function boot(): void {
  void (async () => {
    try {
      const hydrateOutcome = await ensureUrlRequestedSavedPatternHydrated();
      if (hydrateOutcome === "load-failed") {
        applySavedPatternUnavailableMessage();
        const missing = document.querySelector("[data-sideways-calc-missing]");
        if (missing instanceof HTMLElement) {
          missing.hidden = false;
          missing.textContent = SAVED_PATTERN_UNAVAILABLE_BODY;
        }
        return;
      }
      renderView();
      wireEditPatternLink();
    } catch (error) {
      const missing = document.querySelector("[data-sideways-calc-missing]");
      if (missing instanceof HTMLElement) {
        missing.hidden = false;
        const detail = error instanceof Error ? error.message : String(error);
        missing.textContent = import.meta.env.DEV
          ? `[DEV] Sideways V-Neck Sweater workspace failed to load: ${detail}`
          : "This Sideways V-Neck Sweater could not be loaded from the saved draft.";
      }
    }
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
