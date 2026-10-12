/**
 * Set-In Sleeve size is chosen in the builder and stays fixed once a pattern
 * has been generated. Measurement edits keep that size and its chart.
 * Sleeveless, Drop Shoulder, and Sideways Knit do not use this lock.
 */

import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import {
  getCurrentPattern,
  getPatternData,
  getSleevelessChartAudience,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import {
  isActiveSetInSleeveConstruction,
  isSetInSleeveWorkspaceMeasurementSummaryPage,
} from "./setInSleeveConstructionIdentity";
import { isSetInSleeveBuilderPage } from "./setInSleeveSizeCharts";

export const SET_IN_SLEEVE_SIZE_LOCK_KEY = "setInSleeveSizeLocked";

export const SET_IN_SLEEVE_SIZE_LOCK_NOTICE_SELECTOR = "[data-set-in-sleeve-size-lock-notice]";

export function expressWhoForSetInSleeveChart(chartAudience: string): string {
  const key = String(chartAudience ?? "").trim().toLowerCase();
  if (key === "men") return "men";
  if (key === "plus") return "plus";
  if (key === "misses" || key === "women" || key === "woman") return "women";
  return "";
}

export function setInSleeveSizeLockNotice(size: string): string {
  return `This pattern keeps size ${size.trim()}. To choose a different size, start a new pattern.`;
}

function fitRecord(fit: unknown): Record<string, unknown> {
  return fit && typeof fit === "object" && !Array.isArray(fit)
    ? (fit as Record<string, unknown>)
    : {};
}

export function readSetInSleeveSelectedSize(fit: unknown): string {
  return String(fitRecord(fit).selectedSize ?? "").trim();
}

export function isSetInSleeveSizeLockFlagSet(fit: unknown): boolean {
  return fitRecord(fit)[SET_IN_SLEEVE_SIZE_LOCK_KEY] === true;
}

/**
 * Locked after generation (flag) or when a saved Set-In Sleeve project is open.
 * A new pattern can still change size until it is generated.
 */
export function isSetInSleeveGeneratedSizeLocked(input: {
  constructionIsSetIn: boolean;
  selectedSize: string;
  sizeLockFlag: boolean;
  savedProject: boolean;
}): boolean {
  if (!input.constructionIsSetIn) return false;
  if (!input.selectedSize.trim()) return false;
  return input.sizeLockFlag || input.savedProject;
}

export function setInSleeveLockedSizeChangeAllowed(
  currentSize: string,
  attemptedSize: string,
): boolean {
  return attemptedSize.trim() === currentSize.trim();
}

export type SetInSleeveGeneratedSizeLock = {
  locked: boolean;
  selectedSize: string;
  chartAudience: string;
};

export function readSetInSleeveGeneratedSizeLockFromDraft(): SetInSleeveGeneratedSizeLock {
  let selectedSize = "";
  let chartAudience = "";
  let sizeLockFlag = false;
  let constructionIsSetIn = false;
  let savedProject = false;
  try {
    const pattern = getCurrentPattern();
    selectedSize = readSetInSleeveSelectedSize(pattern.fit);
    chartAudience = getSleevelessChartAudience(pattern);
    sizeLockFlag = isSetInSleeveSizeLockFlagSet(pattern.fit);
    constructionIsSetIn = isActiveSetInSleeveConstruction();
    savedProject = isEditingSavedCustomPatternProject();
  } catch {
    /* storage unavailable */
  }
  return {
    locked: isSetInSleeveGeneratedSizeLocked({
      constructionIsSetIn,
      selectedSize,
      sizeLockFlag,
      savedProject,
    }),
    selectedSize,
    chartAudience,
  };
}

/**
 * Record that this Set-In Sleeve draft has been generated.
 * Writes the lock flag and the current size only. Chart measurements stay as they are.
 */
export function stampSetInSleeveGeneratedSizeLock(): boolean {
  if (!isActiveSetInSleeveConstruction()) return false;
  const fit = fitRecord(getCurrentPattern().fit);
  const selectedSize = readSetInSleeveSelectedSize(fit);
  if (!selectedSize) return false;
  if (isSetInSleeveSizeLockFlagSet(fit)) return true;
  const patch = {
    [SET_IN_SLEEVE_SIZE_LOCK_KEY]: true,
    selectedSize,
  };
  saveCurrentPattern({ fit: patch });
  savePatternData("fit", patch);
  return true;
}

/** Put the wizard back on the generated size and chart. No-op before generation. */
export function pinSetInSleeveWizardValuesToLockedSize(
  values: Record<string, string>,
): boolean {
  if (!isSetInSleeveBuilderPage()) return false;
  const lock = readSetInSleeveGeneratedSizeLockFromDraft();
  if (!lock.locked) return false;
  let changed = false;
  if (values.selectedSize !== lock.selectedSize) {
    values.selectedSize = lock.selectedSize;
    changed = true;
  }
  const who = expressWhoForSetInSleeveChart(lock.chartAudience);
  if (who && values.who !== who) {
    values.who = who;
    changed = true;
  }
  return changed;
}

/**
 * After a Set-In Sleeve measurement save, write the original size and chart back.
 * Does not replace selected measurements or measurement overrides.
 */
export function reassertSetInSleeveSizeLockOnEditSave(): void {
  if (!isSetInSleeveWorkspaceMeasurementSummaryPage()) return;
  const pattern = getCurrentPattern();
  const pbFit = fitRecord(getPatternData().fit);
  const selectedSize =
    readSetInSleeveSelectedSize(pattern.fit) || readSetInSleeveSelectedSize(pbFit);
  if (!selectedSize) return;
  const chartAudience = getSleevelessChartAudience(pattern);
  const fitPatch: Record<string, unknown> = {
    [SET_IN_SLEEVE_SIZE_LOCK_KEY]: true,
    selectedSize,
  };
  if (chartAudience) fitPatch.sizingChart = chartAudience;
  saveCurrentPattern({
    fit: fitPatch,
    ...(chartAudience ? { style: { recipientCategory: chartAudience } } : {}),
  });
  savePatternData("fit", fitPatch);
  if (chartAudience) savePatternData("style", { recipientCategory: chartAudience });
}

/** Show the builder notice and stop size and chart controls while the lock is on. */
export function syncSetInSleeveGeneratedSizeLockUi(root: ParentNode): void {
  if (typeof document === "undefined") return;
  if (!isSetInSleeveBuilderPage()) return;
  const lock = readSetInSleeveGeneratedSizeLockFromDraft();
  let notice = root.querySelector(SET_IN_SLEEVE_SIZE_LOCK_NOTICE_SELECTOR);
  if (!lock.locked) {
    if (notice instanceof HTMLElement) notice.hidden = true;
    return;
  }
  if (!(notice instanceof HTMLElement)) {
    const created = document.createElement("p");
    created.className = "saved-pattern-audience-lock-notice";
    created.setAttribute("data-set-in-sleeve-size-lock-notice", "");
    created.setAttribute("role", "status");
    const sizeStep = root.querySelector("[data-express-nested-size]");
    if (sizeStep instanceof HTMLElement) sizeStep.prepend(created);
    else if (root instanceof HTMLElement) root.prepend(created);
    notice = created;
  }
  notice.hidden = false;
  notice.textContent = setInSleeveSizeLockNotice(lock.selectedSize);

  root.querySelectorAll("[data-express-size-select]").forEach((el) => {
    if (el instanceof HTMLSelectElement) el.disabled = true;
  });
  root.querySelectorAll("[data-express-size-row]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.setAttribute("aria-disabled", "true");
    el.setAttribute("tabindex", "-1");
  });
  const who = expressWhoForSetInSleeveChart(lock.chartAudience);
  root.querySelectorAll('[data-choice][data-field="who"]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const value = el.getAttribute("data-value")?.trim().toLowerCase() ?? "";
    if (who && value !== who) {
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
    }
  });
}
