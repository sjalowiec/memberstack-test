/**
 * Progress checklists for neckline/shoulder chart tables ({@link initChartProgressTracking}).
 * Storage keys: `kbm:chart-rows:<sanitizedPatternId>:<sanitizedChartId>`
 */

export type ChartProgressTrackerOptions = {
  patternId: string;
  /** Default: document */
  root?: ParentNode | null;
};

const STORAGE_NS = "kbm:chart-rows";

function sanitizeKeyPart(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/[^\w.-]/g, "_");
}

export function chartProgressStorageKey(patternId: string, chartId: string): string {
  return `${STORAGE_NS}:${sanitizeKeyPart(patternId)}:${sanitizeKeyPart(chartId)}`;
}

function readCheckedRows(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeCheckedRows(key: string, ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].sort()));
  } catch {
    /* quota / blocked */
  }
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

  const key = chartProgressStorageKey(patternId, chartId);

  const hideBtn =
    chartRoot.querySelector<HTMLButtonElement>("[data-chart-progress-toggle-hide]");
  const resetBtn = chartRoot.querySelector<HTMLButtonElement>("[data-chart-progress-reset]");

  const rowById = (): Map<string, HTMLTableRowElement> => {
    const m = new Map<string, HTMLTableRowElement>();
    tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]").forEach((row) => {
      const id = row.dataset.rowId?.trim();
      if (id) m.set(id, row);
    });
    return m;
  };

  const applyStorage = (): void => {
    const stored = readCheckedRows(key);
    tbody.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]").forEach((row) => {
      const rid = row.dataset.rowId?.trim();
      const cb = checkboxInRow(row);
      if (!(cb instanceof HTMLInputElement) || !rid) return;
      cb.checked = stored.has(rid);
      syncRowCompletedClass(row);
    });
    chartRoot.dataset.chartRowsLoaded = "true";
  };

  /** Persist union of tbody row ids referenced on this render. */
  const pruneStorageToCurrentRows = (): void => {
    const ids = rowById();
    const stored = readCheckedRows(key);
    let changed = false;
    for (const id of [...stored]) {
      if (!ids.has(id)) {
        stored.delete(id);
        changed = true;
      }
    }
    if (changed) writeCheckedRows(key, stored);
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
    writeCheckedRows(key, next);
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

  hideBtn?.addEventListener("click", () => {
    const hiding = chartRoot.dataset.chartProgressHideCompleted !== "true";
    chartRoot.dataset.chartProgressHideCompleted = hiding ? "true" : "false";
    chartRoot.classList.toggle("ns-shaping-chart--completed-hidden", hiding);
    hideBtn.setAttribute("aria-pressed", hiding ? "true" : "false");
    hideBtn.textContent = hiding ? "Show completed rows" : "Hide completed rows";
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
    chartRoot.dataset.chartProgressHideCompleted = "false";
    chartRoot.classList.remove("ns-shaping-chart--completed-hidden");
    if (hideBtn) {
      hideBtn.setAttribute("aria-pressed", "false");
      hideBtn.textContent = "Hide completed rows";
    }
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
