/**
 * Set-in sleeve builder page boot.
 *
 * Reuses the sleeveless Express wizard. Sleeves are permanently cuff-up.
 * `style.construction = "set-in-sleeve"` sends the pattern workspace to the set-in generator.
 */
import "/src/scripts/sleeveless-builder-page.ts";
import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId } from "../lib/patterns/customPatternProjectActiveId";
import {
  saveCurrentPattern,
  savePatternData,
  getCurrentPattern,
  getPatternData,
} from "../lib/patterns/patternStorage";
import {
  isActiveSetInSleeveConstruction,
  stampSetInSleeveWorkingDraftFromPage,
  withSetInSleeveConstructionAuthored,
} from "../lib/patterns/setInSleeveConstructionIdentity";

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
    const style = withSetInSleeveConstructionAuthored({ ...canonicalStyle, ...pbStyle }, sleeveLength);
    saveCurrentPattern({ style });
    savePatternData("style", style);
  } catch {
    /* ignore */
  }
}

/** A set-in session must not update a sleeveless or drop-shoulder project left active. */
function clearStaleActiveProjectLink(): void {
  const activeId = readActiveCustomPatternProjectId();
  if (!activeId) return;
  if (isActiveSetInSleeveConstruction()) return;
  clearActiveCustomPatternProjectId();
}

function reflectLengthButtons(length: SleeveLength): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-ds-sleeve-length-option]")
    .forEach((btn) => {
      const selected = btn.getAttribute("data-value") === length;
      btn.classList.toggle("is-selected", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  document.querySelectorAll<HTMLElement>("[data-ds-sleeve-length-summary]").forEach((el) => {
    el.textContent = SLEEVE_LENGTH_LABELS[length] ?? "";
  });
}

function wireControls(): void {
  const lengthRoot = document.querySelector("[data-ds-sleeve-length]");
  if (!lengthRoot) return;
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

function init(): void {
  clearStaleActiveProjectLink();
  const length = readStoredSleeveLength();
  stampSetInSleeveWorkingDraftFromPage(length);
  persist(length);
  reflectLengthButtons(length);
  wireControls();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  queueMicrotask(init);
}

window.addEventListener("pagehide", () => {
  persist(readStoredSleeveLength());
});
