/**
 * Drop Shoulder builder page boot.
 *
 * Reuses the sleeveless Express wizard client (steps, size charts, persistence, review nav) and
 * layers on the two drop-shoulder-specific pieces of state:
 *   - `style.construction = "drop-shoulder"` so the pattern workspace uses the drop-shoulder
 *     generator + layout (see dropShoulderPatternOutput.ts / sleevelessPatternPageShared.ts).
 *   - `style.sleeveDirection` ("cuff-up" default | "top-down") from the in-wizard chooser.
 *   - `style.sleeveLength` ("long" default | "three-quarter" | "elbow" | "short") from the picker.
 *     NOTE: the length selection is captured/persisted now for the UI, but is intentionally NOT
 *     yet applied to the generator math (deferred until the length→inches mapping is defined).
 *
 * Both are written to the canonical draft AND the patternBuilderData mirror so they survive the
 * generator's style merge. We (re)assert after the wizard boots (incl. the `?new=1` fresh start,
 * which clears storage) and again on `pagehide` just before navigating to review.
 */
import "/src/scripts/sleeveless-builder-page.ts";
import {
  saveCurrentPattern,
  savePatternData,
  getCurrentPattern,
  getPatternData,
} from "../lib/patterns/patternStorage";

const CONSTRUCTION = "drop-shoulder";
type SleeveDirection = "cuff-up" | "top-down";
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

function readStoredSleeveDirection(): SleeveDirection {
  const v = readStyleValue("sleeveDirection");
  return v === "top-down" ? "top-down" : "cuff-up";
}

function readStoredSleeveLength(): SleeveLength {
  const v = readStyleValue("sleeveLength");
  return SLEEVE_LENGTHS.includes(v as SleeveLength) ? (v as SleeveLength) : "long";
}

function persist(sleeveDirection: SleeveDirection, sleeveLength: SleeveLength): void {
  try {
    saveCurrentPattern({ style: { construction: CONSTRUCTION, sleeveDirection, sleeveLength } });
    savePatternData("style", { construction: CONSTRUCTION, sleeveDirection, sleeveLength });
  } catch {
    /* ignore */
  }
}

function reflectRadios(dir: SleeveDirection): void {
  document
    .querySelectorAll<HTMLInputElement>('[data-ds-sleeve-direction] input[name="dsSleeveDirection"]')
    .forEach((radio) => {
      radio.checked = radio.value === dir;
    });
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
  const dirRoot = document.querySelector("[data-ds-sleeve-direction]");
  if (dirRoot) {
    dirRoot.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.name === "dsSleeveDirection") {
        const dir: SleeveDirection = target.value === "top-down" ? "top-down" : "cuff-up";
        persist(dir, readStoredSleeveLength());
      }
    });
  }

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
      persist(readStoredSleeveDirection(), length);
    });
  }
}

function init(): void {
  const dir = readStoredSleeveDirection();
  const length = readStoredSleeveLength();
  persist(dir, length);
  reflectRadios(dir);
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
  persist(readStoredSleeveDirection(), readStoredSleeveLength());
});
