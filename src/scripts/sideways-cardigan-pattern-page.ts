/**
 * Sideways Cardigan workspace — calculation summary plus a temporary numeric body sequence.
 * Does not generate Drop Shoulder / Sleeveless instructions.
 */
import {
  stampSidewaysCardiganWorkingDraftFromPage,
} from "../lib/patterns/sidewaysCardiganConstructionIdentity";
import {
  loadSidewaysCardiganWorkspaceView,
} from "../lib/patterns/sidewaysCardiganWorkspaceLoad";

function renderView(): void {
  stampSidewaysCardiganWorkingDraftFromPage();

  const missing = document.querySelector("[data-sideways-calc-missing]");
  const host = document.querySelector("[data-sideways-calc-host]");
  const summary = document.querySelector("[data-sideways-calc-summary]");
  const errorEl = document.querySelector("[data-sideways-calc-error]");
  const adjustmentEl = document.querySelector("[data-sideways-calc-adjustment]");
  const sequenceEl = document.querySelector("[data-sideways-body-sequence]");
  if (
    !(summary instanceof HTMLElement) ||
    !(missing instanceof HTMLElement) ||
    !(host instanceof HTMLElement)
  ) {
    return;
  }

  const showDiagnostic = (message: string): void => {
    missing.hidden = false;
    missing.textContent = message;
    host.hidden = true;
    summary.innerHTML = "";
    if (errorEl instanceof HTMLElement) {
      errorEl.hidden = false;
      errorEl.textContent = message;
    }
  };

  let view;
  try {
    view = loadSidewaysCardiganWorkspaceView();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showDiagnostic(
      import.meta.env.DEV
        ? `[DEV] Sideways Cardigan workspace failed to load: ${detail}`
        : "This Sideways Cardigan could not be loaded from the saved draft.",
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

  summary.innerHTML = view.summaryHtml;

  if (adjustmentEl instanceof HTMLElement) {
    if (view.summary.adjustmentMessage) {
      adjustmentEl.hidden = false;
      adjustmentEl.textContent = `Bust adjusted to keep the pattern symmetrical: ${view.summary.adjustmentMessage}.`;
    } else {
      adjustmentEl.hidden = true;
      adjustmentEl.textContent = "";
    }
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
    }
  }
}

function boot(): void {
  try {
    renderView();
  } catch (error) {
    const missing = document.querySelector("[data-sideways-calc-missing]");
    if (missing instanceof HTMLElement) {
      missing.hidden = false;
      const detail = error instanceof Error ? error.message : String(error);
      missing.textContent = import.meta.env.DEV
        ? `[DEV] Sideways Cardigan workspace failed to load: ${detail}`
        : "This Sideways Cardigan could not be loaded from the saved draft.";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
