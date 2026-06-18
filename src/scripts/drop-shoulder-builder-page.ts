/**
 * Drop Shoulder builder page boot.
 *
 * Reuses the sleeveless Express wizard client (steps, size charts, persistence, review nav) and
 * layers on drop-shoulder-specific state:
 *   - `style.construction = "drop-shoulder"` so the pattern workspace uses the drop-shoulder
 *     generator + layout (see dropShoulderPatternOutput.ts / sleevelessPatternPageShared.ts).
 *   - `style.sleeveLength` ("long" default | "three-quarter" | "elbow" | "short") from the picker.
 *     NOTE: the length selection is captured/persisted now for the UI, but is intentionally NOT
 *     yet applied to the generator math (deferred until the length→inches mapping is defined).
 *
 * Sleeve construction (bottom-up vs top-down) is chosen on the pattern view, not in the builder.
 *
 * Both are written to the canonical draft AND the patternBuilderData mirror so they survive the
 * generator's style merge. We (re)assert after the wizard boots (incl. the `?new=1` fresh start,
 * which clears storage) and again on `pagehide` just before navigating to review.
 */
import "/src/scripts/sleeveless-builder-page.ts";
import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId } from "../lib/patterns/customPatternProjectActiveId";
import { readHydratedConstructionBaseline } from "../lib/patterns/customPatternProjectConstructionBaseline";
import {
  saveCurrentPattern,
  savePatternData,
  getCurrentPattern,
  getPatternData,
} from "../lib/patterns/patternStorage";
import { withDropShoulderConstructionAuthored } from "../lib/patterns/patternConstructionIdentity";

type SleeveLength = "long" | "three-quarter" | "elbow" | "short";

const SLEEVE_LENGTHS: readonly SleeveLength[] = ["long", "three-quarter", "elbow", "short"];

const SLEEVE_LENGTH_LABELS: Record<SleeveLength, string> = {
  long: "Long",
  "three-quarter": "3/4",
  elbow: "Elbow",
  short: "Short",
};

function readStyleValue(key: string): unknown {
  try {
    const canonical = (getCurrentPattern().style as Record<string, unknown> | undefined) ?? {};
    if (canonical[key] !== undefined && canonical[key] !== null) return canonical[key];
    const pb = (getPatternData().style as Record<string, unknown> | undefined) ?? {};
    return pb[key];
  } catch {
    return undefined;
  }
}

function readStoredSleeveLength(): SleeveLength {
  const v = readStyleValue("sleeveLength");
  return SLEEVE_LENGTHS.includes(v as SleeveLength) ? (v as SleeveLength) : "long";
}

function persist(sleeveLength: SleeveLength): void {
  try {
    const canonicalStyle =
      (getCurrentPattern().style as Record<string, unknown> | undefined) ?? {};
    const pbStyle = (getPatternData().style as Record<string, unknown> | undefined) ?? {};
    const style = withDropShoulderConstructionAuthored({ ...canonicalStyle, ...pbStyle }, sleeveLength);
    saveCurrentPattern({ style });
    savePatternData("style", style);
  } catch {
    /* ignore */
  }
}

/** Drop-shoulder builder must not update a sleeveless saved project id left from a prior session. */
function clearStaleSleevelessActiveProjectLink(): void {
  const activeId = readActiveCustomPatternProjectId();
  if (!activeId) return;
  const baseline = readHydratedConstructionBaseline();
  if (!baseline || baseline.projectId !== activeId || !baseline.hadAuthoritativeDropShoulder) {
    clearActiveCustomPatternProjectId();
  }
}

function reflectLengthButtons(length: SleeveLength): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-ds-sleeve-length-option]")
    .forEach((btn) => {
      const selected = btn.getAttribute("data-value") === length;
      btn.classList.toggle("is-selected", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  reflectLengthSummary(length);
}

/** Collapsed accordion summary for the Sleeve Length step (driven here, not by the shared client). */
function reflectLengthSummary(length: SleeveLength): void {
  document
    .querySelectorAll<HTMLElement>("[data-ds-sleeve-length-summary]")
    .forEach((el) => {
      el.textContent = SLEEVE_LENGTH_LABELS[length] ?? "";
    });
}

function wireControls(): void {
  const lengthRoot = document.querySelector("[data-ds-sleeve-length]");
  if (lengthRoot) {
    lengthRoot.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
        "[data-ds-sleeve-length-option]",
      );
      if (!btn) return;
      const raw = btn.getAttribute("data-value");
      const length: SleeveLength = SLEEVE_LENGTHS.includes(raw as SleeveLength)
        ? (raw as SleeveLength)
        : "long";
      reflectLengthButtons(length);
      persist(length);
    });
  }
}

function init(): void {
  clearStaleSleevelessActiveProjectLink();
  const length = readStoredSleeveLength();
  persist(length);
  reflectLengthButtons(length);
  wireControls();
}

// `load` fires after the wizard's DOMContentLoaded boot + any `?new=1` reset, so our flags win.
if (document.readyState === "complete") {
  init();
} else {
  window.addEventListener("load", init, { once: true });
}

// Belt-and-suspenders: re-assert just before leaving for the review page.
window.addEventListener("pagehide", () => {
  persist(readStoredSleeveLength());
});
