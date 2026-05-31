/**
 * Progress checklists for neckline/shoulder chart tables ({@link initChartProgressTracking}).
 * Storage keys: `kbm:chart-rows:<sanitizedPatternId>:<sanitizedChartId>`
 */
import {
  chartProgressStorageKey,
  readChartProgressBlob,
  writeChartProgressBlob,
} from "../lib/patterns/chartProgressStorage";
import { scheduleReadingWorkflowSync } from "../lib/patterns/patternReadingWorkflowSync";

export type ChartProgressTrackerOptions = {
  patternId: string;
  /** Default: document */
  root?: ParentNode | null;
};

export {
  chartProgressStorageKey,
  sanitizeChartProgressKeyPart as sanitizeKeyPart,
} from "../lib/patterns/chartProgressStorage";

const CHART_PROGRESS_SHOW_STATE_ON = "Rows visible";
const CHART_PROGRESS_SHOW_STATE_OFF = "Rows hidden";

function readCheckedRows(key: string): Set<string> {
  return new Set(readChartProgressBlob(key).checkedRowIds);
}

function writeCheckedRows(key: string, ids: ReadonlySet<string>, hideCompleted: boolean): void {
  writeChartProgressBlob(key, {
    checkedRowIds: [...ids],
    hideCompleted,
  });
}

function checkboxInRow(row: HTMLTableRowElement): HTMLInputElement | null {
  const cb =
    row.querySelector<HTMLInputElement>("input.ns-shaping-chart__row-check") ??
    row.querySelector<HTMLInputElement>("input[type=checkbox]");
  return cb;
}

function syncRowCompletedClass(row: HTMLTableRowElement): void {
  const cb = checkboxInRow(row);
  const checked = !!(cb instanceof HTMLInputElement && cb.checked);
  row.classList.toggle("ns-shaping-chart__tr--progress-complete", checked);
}

/** One chart block: element with `[data-chart-id]`. */
function bindChartSection(
  chartRoot: HTMLElement,
  patternId: string,
): void {
  const chartId = chartRoot.dataset.chartId?.trim();
  if (!chartId) return;

  const tbody = chartRoot.querySelector("tbody");
  if (!(tbody instanceof HTMLTableSectionElement)) return;

  /** Avoid duplicate listeners when init runs twice on the same DOM (should be rare). */
  if (chartRoot.dataset.chartProgressBound === "true") return;
  chartRoot.dataset.chartProgressBound = "true";

  const key = chartProgressStorageKey(patternId, chartId);

  const showToggle =
    chartRoot.querySelector<HTMLButtonElement>("[data-chart-progress-show-completed]");
  const resetBtn = chartRoot.querySelector<HTMLButtonElement>("[data-chart-progress-reset]");
  const showStateEl = chartRoot.querySelector<HTMLElement>("[data-chart-progress-show-state]");

  const setCompletedHiddenUi = (active: boolean): void => {
    chartRoot.dataset.chartProgressHideCompleted = active ? "true" : "false";
    chartRoot.classList.toggle("ns-shaping-chart--completed-hidden", active);
    const showCompleted = !active;
    if (showToggle) {
      showToggle.setAttribute("aria-checked", showCompleted ? "true" : "false");
    }
    if (showStateEl) {
      showStateEl.textContent = showCompleted ? CHART_PROGRESS_SHOW_STATE_ON : CHART_PROGRESS_SHOW_STATE_OFF;
    }
  };

  const rowById = (): Map<string, HTMLTableRowElement> => {
    const m = new Map<string, HTMLTableRowElement>();
    tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]").forEach((row) => {
      const id = row.dataset.rowId?.trim();
      if (id) m.set(id, row);
    });
    return m;
  };

  const applyStorage = (): void => {
    const blob = readChartProgressBlob(key);
    const stored = new Set(blob.checkedRowIds);
    tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]").forEach((row) => {
      const rid = row.dataset.rowId?.trim();
      const cb = checkboxInRow(row);
      if (!(cb instanceof HTMLInputElement) || !rid) return;
      cb.checked = stored.has(rid);
      syncRowCompletedClass(row);
    });
    setCompletedHiddenUi(blob.hideCompleted);
    chartRoot.dataset.chartRowsLoaded = "true";
  };

  /** Persist union of tbody row ids referenced on this render. */
  const pruneStorageToCurrentRows = (): void => {
    const ids = rowById();
    const blob = readChartProgressBlob(key);
    const stored = new Set(blob.checkedRowIds);
    let changed = false;
    for (const id of [...stored]) {
      if (!ids.has(id)) {
        stored.delete(id);
        changed = true;
      }
    }
    if (changed) {
      writeCheckedRows(key, stored, blob.hideCompleted);
    }
  };

  const notifyWorkflow = (): void => {
    scheduleReadingWorkflowSync(patternId);
  };

  pruneStorageToCurrentRows();
  applyStorage();

  const persistFromDom = (): void => {
    const next = new Set<string>();
    tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]").forEach((row) => {
      const rid = row.dataset.rowId?.trim();
      const cb = checkboxInRow(row);
      if (!rid || !(cb instanceof HTMLInputElement)) return;
      if (cb.checked) next.add(rid);
    });
    const hideCompleted = chartRoot.dataset.chartProgressHideCompleted === "true";
    writeCheckedRows(key, next, hideCompleted);
    notifyWorkflow();
  };

  chartRoot.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!t.matches("input.ns-shaping-chart__row-check")) return;
    const row = t.closest("tr[data-row-id]");
    if (!(row instanceof HTMLTableRowElement)) return;
    syncRowCompletedClass(row);
    persistFromDom();
  });

  showToggle?.addEventListener("click", () => {
    const nextActive = chartRoot.dataset.chartProgressHideCompleted !== "true";
    setCompletedHiddenUi(nextActive);
    const stored = readCheckedRows(key);
    writeCheckedRows(key, stored, nextActive);
    notifyWorkflow();
  });

  resetBtn?.addEventListener("click", () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]").forEach((row) => {
      const cb = checkboxInRow(row);
      if (cb instanceof HTMLInputElement) {
        cb.checked = false;
        syncRowCompletedClass(row);
      }
    });
    setCompletedHiddenUi(false);
    notifyWorkflow();
  });
}

/** Find `[data-chart-id]` sections under `root` and wire persistence + toolbar actions. */
export function initChartProgressTracking(opts: ChartProgressTrackerOptions): void {
  const patternIdRaw = opts.patternId ?? "";
  if (!patternIdRaw.trim()) return;

  const root = opts.root ?? document;
  if (!root.querySelectorAll) return;

  root.querySelectorAll<HTMLElement>("[data-chart-id]").forEach((chartRoot) => {
    bindChartSection(chartRoot, patternIdRaw.trim());
  });
}
