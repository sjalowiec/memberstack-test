/**
 * Express size chart fetch + table UI (shared by `/patterns/sleeveless-express` and Custom Build design).
 * Same JSON URLs and bust/chest formatting as the Fit step.
 */
import { fitEaseInchesForChoice } from "./fitEaseInches";
import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import { expressWhoToChartAudience } from "./syncSleevelessExpressDesignToStorage";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

export type { ChartRow } from "./sleevelessExpressSizeChartTypes";
export { expressWhoToChartAudience };

const CHART_AUDIENCES = ["misses", "plus", "men", "kids", "baby"] as const;

const chartRowsByAudience: Record<string, ChartRow[]> = {};
const chartSizeSets: Record<string, Set<string>> = {};
let expressChartsLoadPromise: Promise<void> | null = null;

import { SWEATER_CHART_DATA_URLS_BY_AUDIENCE } from "../sizing/sizingChartCatalog";

/** Same sweater chart URLs as the reference sizing charts page. */
const SWEATER_CHART_URLS: Record<string, string> = SWEATER_CHART_DATA_URLS_BY_AUDIENCE;

/** Must match `UnitToggle` id on Express + Custom Build design (size labels). */
export const SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID = "sleeveless-fit";

function toFiniteNumber(v: unknown): number {
  if (v === undefined || v === null) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function roundQuarter(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 4) / 4;
}

export function normalizeChartRowSize(row: ChartRow): string {
  if (row.size === undefined || row.size === null) return "";
  return String(row.size);
}

export function computeDefaultMeasurementsFromChartRow(
  row: ChartRow,
  fitPreference: string,
  options?: { bodyShape?: string },
): Record<string, number> {
  const ease = fitEaseInchesForChoice(fitPreference);
  const bust = toFiniteNumber(row.bust_or_chest);
  const waist = toFiniteNumber(row.waist);
  const finishedBustChest = roundQuarter(bust + ease);
  const bodyShape = options?.bodyShape ?? "straight";
  const chartHip = toFiniteNumber(row.hip);
  const finishedHip =
    bodyShape === "aline" && Number.isFinite(chartHip)
      ? Math.max(finishedBustChest, roundQuarter(chartHip + ease))
      : finishedBustChest;
  return {
    finished_bust_chest: finishedBustChest,
    finished_waist: roundQuarter(waist + ease),
    finished_hip: finishedHip,
    back_neck_to_hem: roundQuarter(toFiniteNumber(row.garment_back_length)),
    armhole_depth: roundQuarter(toFiniteNumber(row.armhole_depth)),
    shoulder_width: roundQuarter(toFiniteNumber(row.shoulder_width)),
    neck_width: roundQuarter(toFiniteNumber(row.neck_opening)),
    front_neck_depth: roundQuarter(toFiniteNumber(row.front_neck_depth)),
    back_neck_depth: roundQuarter(toFiniteNumber(row.back_neck_depth)),
    // Sleeve measurements — only meaningful for sleeved constructions (drop shoulder);
    // harmless extra keys for sleeveless. Armhole depth for drop shoulder is derived
    // from upper_arm at generation time (upper_arm ÷ 2), not stored here.
    upper_arm: roundQuarter(toFiniteNumber(row.upper_arm)),
    wrist: roundQuarter(toFiniteNumber(row.wrist)),
    sleeve_length: roundQuarter(toFiniteNumber(row.sleeve_length)),
  };
}

export function nonEmptyTrimmed(s: unknown): boolean {
  return typeof s === "string" && s.trim() !== "";
}

/** Fit / size-display unit (Express + Custom Build design). */
export function getExpressUiUnit(): "in" | "cm" {
  const root = document.querySelector(`[data-unit-toggle="${SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID}"]`);
  const hidden = root?.querySelector<HTMLInputElement>("[data-kbm-unit-value]");
  if (hidden && (hidden.value === "in" || hidden.value === "cm")) {
    return hidden.value;
  }
  try {
    const scoped = localStorage.getItem(`kbm-units-${SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID}`);
    if (scoped === "in" || scoped === "cm") return scoped;
    const u = localStorage.getItem("kbm-units");
    if (u === "in" || u === "cm") return u;
  } catch {
    /* ignore */
  }
  return "in";
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export const EXPRESS_STANDARD_BODY_MEASUREMENT_FIELDS = [
  { key: "bust_or_chest", label: "Bust/Chest" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hip" },
  { key: "upper_arm", label: "Upper Arm" },
] as const;

export type ExpressStandardBodyMeasurementKey =
  (typeof EXPRESS_STANDARD_BODY_MEASUREMENT_FIELDS)[number]["key"];

/** Table cell — same inches/cm rules as Fit dropdown labels. */
export function formatBodyMeasurementDisplay(
  row: ChartRow,
  field: ExpressStandardBodyMeasurementKey,
  uiUnit: "in" | "cm",
): string {
  const rowObj = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  if (uiUnit === "cm") {
    let cm: number | null = null;
    const cmKeys =
      field === "bust_or_chest"
        ? (["bust_or_chest_cm", "bust_cm", "chest_cm"] as const)
        : ([`${field}_cm`] as const);
    for (const key of cmKeys) {
      const raw = rowObj[key];
      const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
      if (Number.isFinite(n) && n > 0) {
        cm = Math.round(n);
        break;
      }
    }
    if (cm === null) {
      const inches = toFiniteNumber(row[field]);
      cm = Number.isFinite(inches) ? Math.round(inches * 2.54) : null;
    }
    return cm !== null ? `${cm} cm` : "—";
  }
  const inches = toFiniteNumber(row[field]);
  if (!Number.isFinite(inches)) return "—";
  return `${formatSwatchCountForGaugeInput(inches)}"`;
}

/** Table cell — same inches/cm rules as Fit dropdown labels. */
export function formatBustChestDisplay(row: ChartRow, uiUnit: "in" | "cm"): string {
  return formatBodyMeasurementDisplay(row, "bust_or_chest", uiUnit);
}

export type ExpressStandardBodyMeasurementsSummary = {
  heading: string;
  measurements: Array<{ label: string; value: string }>;
};

/** Standard chart body measurements for the selected size (no fit ease applied). */
export function buildExpressStandardBodyMeasurementsSummaryFromRow(
  sizeStr: string,
  row: ChartRow,
  uiUnit: "in" | "cm",
): ExpressStandardBodyMeasurementsSummary {
  const sizeLabel = sizeStr.trim();
  return {
    heading: `Size ${sizeLabel} standard body measurements`,
    measurements: EXPRESS_STANDARD_BODY_MEASUREMENT_FIELDS.map(({ key, label }) => ({
      label,
      value: formatBodyMeasurementDisplay(row, key, uiUnit),
    })),
  };
}

export function buildExpressStandardBodyMeasurementsSummary(
  values: Record<string, string>,
  options?: { uiUnit?: "in" | "cm" },
): ExpressStandardBodyMeasurementsSummary | null {
  const sz = values.selectedSize?.trim();
  if (!sz) return null;
  const aud = expressWhoToChartAudience(values.who);
  const row = findExpressChartRow(aud, sz);
  if (!row) return null;
  const uiUnit = options?.uiUnit ?? getExpressUiUnit();
  return buildExpressStandardBodyMeasurementsSummaryFromRow(sz, row, uiUnit);
}

/** Already-loaded sweater chart rows for an audience (empty until {@link loadExpressSweaterCharts} resolves). */
export function getExpressChartRowsForAudience(audience: string): ChartRow[] {
  const list = chartRowsByAudience[audience];
  return Array.isArray(list) ? list : [];
}

export function findExpressChartRow(audience: string, sizeStr: string): ChartRow | null {
  const list = chartRowsByAudience[audience];
  if (!Array.isArray(list)) return null;
  const key = String(sizeStr);
  return list.find((row) => normalizeChartRowSize(row) === key) ?? null;
}

export function isValidExpressSizeForAudience(audience: string, size: unknown): boolean {
  if (!audience || size === undefined || size === null || size === "") return false;
  const set = chartSizeSets[audience];
  return set instanceof Set && set.has(String(size));
}

/** Loads all sweater charts once (same URLs as Fit step). */
export function loadExpressSweaterCharts(): Promise<void> {
  if (expressChartsLoadPromise) return expressChartsLoadPromise;
  expressChartsLoadPromise = (async () => {
    await Promise.all(
      CHART_AUDIENCES.map(async (aud) => {
        const url = SWEATER_CHART_URLS[aud];
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${aud}: ${res.status}`);
        const rows = (await res.json()) as unknown;
        const list = Array.isArray(rows) ? (rows as ChartRow[]) : [];
        chartSizeSets[aud] = new Set();
        chartRowsByAudience[aud] = list;
        list.forEach((row) => {
          const k = normalizeChartRowSize(row);
          if (k) chartSizeSets[aud]!.add(k);
        });
      }),
    );
  })().catch((err) => {
    expressChartsLoadPromise = null;
    throw err;
  });
  return expressChartsLoadPromise;
}

export function resolveExpressChartFit(
  chartAudience: string,
  sizeStr: string,
  fitPreference: string,
  options?: { bodyShape?: string },
): { selectedSize: string; selectedMeasurements: Record<string, number> } | null {
  const row = findExpressChartRow(chartAudience, sizeStr);
  if (!row) return null;
  const selectedSize = normalizeChartRowSize(row);
  if (!selectedSize) return null;
  return {
    selectedSize,
    selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, fitPreference, options),
  };
}

/** Drop `selectedSize` if it is not valid for the current “who” chart (after chart load or audience change). */
export function pruneInvalidExpressSelectedSize(values: Record<string, string>): void {
  const aud = expressWhoToChartAudience(values.who);
  const sizeSet = chartSizeSets[aud];
  const hasLoadedSizes = sizeSet instanceof Set && sizeSet.size > 0;
  if (hasLoadedSizes && values.selectedSize && !sizeSet.has(String(values.selectedSize).trim())) {
    delete values.selectedSize;
  }
}

export function formatExpressSelectedSizeSummary(values: Record<string, string>): string {
  const sz = values.selectedSize?.trim();
  if (!sz) return "";
  const aud = expressWhoToChartAudience(values.who);
  const row = findExpressChartRow(aud, sz);
  const uiUnit = getExpressUiUnit();
  const meas = row ? formatBustChestDisplay(row, uiUnit) : "";
  return meas ? `Size ${sz} • Bust/Chest ${meas}` : `Size ${sz}`;
}

/** Confirmation line shown below the size chart after the user picks a row. */
export function formatExpressSizeBodyConfirmation(
  values: Record<string, string>,
  options?: { includeDropShoulderSleeveMeasurements?: boolean },
): string {
  const sz = values.selectedSize?.trim();
  if (!sz) return "";
  const aud = expressWhoToChartAudience(values.who);
  const row = findExpressChartRow(aud, sz);
  const meas = row ? formatBustChestDisplay(row, getExpressUiUnit()) : "";
  let line = meas ? `Selected: Size ${sz}, ${meas} bust/chest` : `Selected: Size ${sz}`;
  if (options?.includeDropShoulderSleeveMeasurements && row) {
    const sleeveLength = toFiniteNumber(row.sleeve_length);
    if (Number.isFinite(sleeveLength) && sleeveLength > 0) {
      const unit = getExpressUiUnit();
      const sleeveDisplay =
        unit === "cm"
          ? `${Math.round(sleeveLength * 2.54 * 10) / 10} cm sleeve length`
          : `${formatSwatchCountForGaugeInput(sleeveLength)}" sleeve length`;
      line += ` • ${sleeveDisplay}`;
    }
  }
  return line;
}

function nestedHasStandardBodyMeasurementsSummary(nested: ParentNode): boolean {
  return nested.querySelector("[data-express-size-standard-body-summary]") instanceof HTMLElement;
}

function renderExpressStandardBodyMeasurementsSummaryHtml(
  summary: ExpressStandardBodyMeasurementsSummary,
): string {
  const items = summary.measurements
    .map(
      ({ label, value }) =>
        `<div class="express-size-standard-body-summary__item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
  return `<h3 class="express-size-standard-body-summary__heading">${escapeHtml(summary.heading)}</h3><dl class="express-size-standard-body-summary__list">${items}</dl>`;
}

/**
 * Express builders with `[data-express-size-standard-body-summary]`: compact standard body measurements.
 */
export function patchExpressStandardBodyMeasurementsSummary(
  scope: ParentNode,
  values: Record<string, string>,
): void {
  const nested = scope.querySelector("[data-express-nested-size]");
  if (!(nested instanceof HTMLElement)) return;

  const el = nested.querySelector("[data-express-size-standard-body-summary]");
  if (!(el instanceof HTMLElement)) return;

  const summary = buildExpressStandardBodyMeasurementsSummary(values);
  if (!summary) {
    el.innerHTML = "";
    el.setAttribute("hidden", "");
    return;
  }

  el.innerHTML = renderExpressStandardBodyMeasurementsSummaryHtml(summary);
  el.removeAttribute("hidden");
}

/**
 * Inline “selected size” line under the chart (Express parity).
 */
export function patchExpressSizeBodyConfirmation(scope: ParentNode, values: Record<string, string>): void {
  const nested = scope.querySelector("[data-express-nested-size]");
  if (!(nested instanceof HTMLElement)) return;
  let el = nested.querySelector("[data-express-size-body-summary]");
  if (!(el instanceof HTMLElement)) {
    el = document.createElement("p");
    el.setAttribute("data-express-size-body-summary", "");
    el.className = "express-size-selected-confirm sg-fit-size-copy";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("hidden", "");
    const wrap = nested.querySelector("[data-express-size-select-wrap]");
    if (wrap instanceof HTMLElement) wrap.after(el);
    else nested.appendChild(el);
  }
  if (nestedHasStandardBodyMeasurementsSummary(nested)) {
    el.textContent = "";
    el.setAttribute("hidden", "");
    return;
  }
  const t = nonEmptyTrimmed(values.selectedSize)
    ? formatExpressSizeBodyConfirmation(values, {
        includeDropShoulderSleeveMeasurements: false,
      })
    : "";
  el.textContent = t;
  if (t) el.removeAttribute("hidden");
  else el.setAttribute("hidden", "");
}

/**
 * Fills the hidden `<select>` + measurement table under `[data-express-nested-size]` within `scope`.
 */
export function refreshExpressSizePanel(
  scope: ParentNode,
  values: Record<string, string>,
  interactive: boolean,
): void {
  const nested = scope.querySelector("[data-express-nested-size]");
  if (!(nested instanceof HTMLElement)) return;

  if (!values.who) {
    nested.setAttribute("hidden", "");
    return;
  }
  nested.removeAttribute("hidden");

  const aud = expressWhoToChartAudience(values.who);
  const list = chartRowsByAudience[aud];
  pruneInvalidExpressSelectedSize(values);

  const uiUnit = getExpressUiUnit();

  const wrap = scope.querySelector("[data-express-size-select-wrap]");
  const selectEl = scope.querySelector("[data-express-size-select]");
  const tableBody = wrap?.querySelector("[data-express-size-table-body]");
  if (wrap instanceof HTMLElement && selectEl instanceof HTMLSelectElement) {
    if (Array.isArray(list) && list.length > 0) {
      wrap.removeAttribute("hidden");
      const placeholder = `<option value="">${escapeHtml("Choose a size…")}</option>`;
      const opts = list
        .map((row) => {
          const sz = normalizeChartRowSize(row);
          if (!sz) return "";
          const meas = formatBustChestDisplay(row, uiUnit);
          const label = `${sz} — ${meas}`;
          return `<option value="${escapeAttr(sz)}">${escapeHtml(label)}</option>`;
        })
        .join("");
      selectEl.innerHTML = placeholder + opts;
      const chosen =
        values.selectedSize && isValidExpressSizeForAudience(aud, values.selectedSize)
          ? values.selectedSize.trim()
          : "";
      selectEl.value = chosen;

      if (tableBody instanceof HTMLElement) {
        tableBody.replaceChildren();
        for (const row of list) {
          const sz = normalizeChartRowSize(row);
          if (!sz) continue;
          const meas = formatBustChestDisplay(row, uiUnit);
          const value = sz;
          const isSelected = chosen === value;

          const rowEl = document.createElement("tr");
          rowEl.className = "express-size-row";
          rowEl.classList.toggle("is-selected", isSelected);
          rowEl.setAttribute("data-express-size-row", "");
          rowEl.setAttribute("data-value", sz);
          rowEl.setAttribute("role", "radio");
          rowEl.setAttribute("aria-checked", isSelected ? "true" : "false");
          rowEl.setAttribute("aria-label", `${sz}, ${meas}`);
          if (interactive) {
            rowEl.setAttribute("tabindex", "0");
            rowEl.removeAttribute("aria-disabled");
          } else {
            rowEl.setAttribute("tabindex", "-1");
            rowEl.setAttribute("aria-disabled", "true");
          }

          const tdSize = document.createElement("td");
          tdSize.className = "express-size-row__size";

          const checkSpan = document.createElement("span");
          checkSpan.className = "express-size-row__check";
          checkSpan.textContent = isSelected ? "✓" : "";
          checkSpan.setAttribute("aria-hidden", "true");

          const spanLabel = document.createElement("span");
          spanLabel.className = "express-size-row__size-label";
          spanLabel.textContent = sz;

          tdSize.append(checkSpan, spanLabel);

          const tdMeas = document.createElement("td");
          tdMeas.className = "express-size-row__measure";

          const measSpan = document.createElement("span");
          measSpan.className = "express-size-row__measure-value";
          measSpan.textContent = meas;

          tdMeas.append(measSpan);
          if (isSelected) {
            const badge = document.createElement("span");
            badge.className = "express-size-row__selected-badge";
            badge.textContent = "Selected";
            tdMeas.append(badge);
          }

          rowEl.append(tdSize, tdMeas);
          tableBody.appendChild(rowEl);
        }
      }
    } else {
      wrap.setAttribute("hidden", "");
      selectEl.innerHTML = `<option value="">${escapeHtml("Choose a size…")}</option>`;
      if (tableBody instanceof HTMLElement) tableBody.replaceChildren();
    }
  }

  patchExpressSizeBodyConfirmation(scope, values);
  patchExpressStandardBodyMeasurementsSummary(scope, values);
}
