/**
 * Custom Build — Measurements step (`/patterns/sleeveless/custom-build/fit/`).
 * Body/finished layer in `kbm_current_pattern.measurements` only; does not alter pattern math.
 */
import {
  getCurrentPattern,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "../lib/patterns/patternStorage";
import { formatSwatchCountForGaugeInput } from "../lib/patterns/gaugeDisplayFormat";
import {
  CUSTOM_BUILD_BODY_FINISHED_KEYS,
  persistCustomBuildBodyFinishedMeasurements,
  readCustomBuildBodyFinishedMeasurements,
  seedCustomBuildBodyFinishedFromChartRow,
  type CustomBuildBodyFinishedKey,
} from "../lib/patterns/sleevelessCustomBuildBodyMeasurements";
import {
  expressWhoToChartAudience,
  findExpressChartRow,
  getExpressUiUnit,
  loadExpressSweaterCharts,
  SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID,
} from "../lib/patterns/sleevelessExpressSizeChartClient";
const FINISHED_FIELD_KEYS: CustomBuildBodyFinishedKey[] = [
  "finishedBustOrChest",
  "finishedWaist",
  "finishedHip",
];

const LABELS: Record<CustomBuildBodyFinishedKey, string> = {
  bodyBustOrChest: "Body bust/chest",
  bodyWaist: "Body waist",
  bodyHip: "Body hip",
  finishedBustOrChest: "Finished bust/chest",
  finishedWaist: "Finished waist",
  finishedHip: "Finished hip",
};

function readExpressValues(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return {};
    const v = (p as Record<string, unknown>).values;
    if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, string>) };
  } catch {
    /* ignore */
  }
  return {};
}

function formatInches(n: number | undefined, uiUnit: "in" | "cm"): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  if (uiUnit === "cm") return `${Math.round(n * 2.54)} cm`;
  return `${formatSwatchCountForGaugeInput(n)}"`;
}

function parseInputInches(raw: string, uiUnit: "in" | "cm"): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (uiUnit === "cm") return Math.round((n / 2.54) * 4) / 4;
  return Math.round(n * 4) / 4;
}

function resolveFitPreference(
  expressValues: Record<string, string>,
  patternFit: Record<string, unknown>,
): string {
  const ev = expressValues.fit;
  if (ev === "close" || ev === "standard" || ev === "relaxed") return ev;
  const ease = patternFit.easeChoice ?? patternFit.fitChoice;
  if (ease === "close" || ease === "standard" || ease === "relaxed") return ease;
  return "standard";
}

function hydrateFromChartIfNeeded(): void {
  const pattern = getCurrentPattern();
  const stored = readCustomBuildBodyFinishedMeasurements(pattern);
  const hasFinished = FINISHED_FIELD_KEYS.every((k) => stored[k] !== undefined);
  if (hasFinished) return;

  const expressValues = readExpressValues();
  const fit = pattern.fit ?? {};
  const audience =
    expressWhoToChartAudience(expressValues.who) ||
    expressWhoToChartAudience(fit.sizingChart) ||
    expressWhoToChartAudience(pattern.style?.recipientCategory);
  const size =
    (typeof expressValues.selectedSize === "string" && expressValues.selectedSize.trim()) ||
    (typeof fit.selectedSize === "string" && fit.selectedSize.trim()) ||
    "";
  if (!audience || !size) return;

  const row = findExpressChartRow(audience, size);
  if (!row) return;
  const fitPref = resolveFitPreference(expressValues, fit);
  seedCustomBuildBodyFinishedFromChartRow(row, fitPref, { preserveFinished: true });
}

function renderSummary(root: HTMLElement, uiUnit: "in" | "cm"): void {
  const stored = readCustomBuildBodyFinishedMeasurements();
  const dl = root.querySelector("[data-cb-measure-summary]");
  if (!(dl instanceof HTMLElement)) return;
  dl.replaceChildren();
  for (const key of CUSTOM_BUILD_BODY_FINISHED_KEYS) {
    const dt = document.createElement("dt");
    dt.textContent = LABELS[key];
    const dd = document.createElement("dd");
    dd.textContent = formatInches(stored[key], uiUnit);
    dl.append(dt, dd);
  }
}

function fillBodyDisplays(root: HTMLElement, uiUnit: "in" | "cm"): void {
  const stored = readCustomBuildBodyFinishedMeasurements();
  root.querySelectorAll("[data-cb-body-display]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const key = el.getAttribute("data-cb-body-display") as CustomBuildBodyFinishedKey | null;
    if (!key || !key.startsWith("body")) return;
    el.textContent = formatInches(stored[key], uiUnit);
  });
}

function fillFinishedInputs(root: HTMLElement, uiUnit: "in" | "cm"): void {
  const stored = readCustomBuildBodyFinishedMeasurements();
  FINISHED_FIELD_KEYS.forEach((key) => {
    const input = root.querySelector<HTMLInputElement>(`[data-cb-finished-input="${key}"]`);
    if (!input) return;
    const n = stored[key];
    if (n === undefined) {
      input.value = "";
      return;
    }
    input.value = uiUnit === "cm" ? String(Math.round(n * 2.54)) : formatSwatchCountForGaugeInput(n);
  });
}

function persistFinishedFromInputs(root: HTMLElement, uiUnit: "in" | "cm"): void {
  const partial: Partial<Record<CustomBuildBodyFinishedKey, number>> = {};
  FINISHED_FIELD_KEYS.forEach((key) => {
    const input = root.querySelector<HTMLInputElement>(`[data-cb-finished-input="${key}"]`);
    if (!input) return;
    const n = parseInputInches(input.value, uiUnit);
    if (n !== undefined) partial[key] = n;
  });
  persistCustomBuildBodyFinishedMeasurements(partial, {
    preserveFinished: false,
    refreshBody: false,
  });
}

function refreshUi(root: HTMLElement): void {
  const uiUnit = getExpressUiUnit();
  const unitHint = root.querySelector("[data-cb-measure-unit-hint]");
  if (unitHint instanceof HTMLElement) {
    unitHint.textContent =
      uiUnit === "cm"
        ? "Measurements are shown in centimeters."
        : "Measurements are shown in inches.";
  }
  fillBodyDisplays(root, uiUnit);
  fillFinishedInputs(root, uiUnit);
  renderSummary(root, uiUnit);
}

function initCustomBuildMeasurementsPage(): void {
  const root = document.querySelector("[data-cb-measure-root]");
  if (!(root instanceof HTMLElement)) return;

  const missing = root.querySelector("[data-cb-measure-missing]");
  const panel = root.querySelector("[data-cb-measure-panel]");

  void loadExpressSweaterCharts()
    .then(() => {
      hydrateFromChartIfNeeded();
      const pattern = getCurrentPattern();
      const fit = pattern.fit ?? {};
      const expressValues = readExpressValues();
      const audience =
        expressWhoToChartAudience(expressValues.who) ||
        expressWhoToChartAudience(fit.sizingChart);
      const size =
        (typeof expressValues.selectedSize === "string" && expressValues.selectedSize.trim()) ||
        (typeof fit.selectedSize === "string" && fit.selectedSize.trim()) ||
        "";
      const hasChart = audience && size && findExpressChartRow(audience, size);

      if (!hasChart) {
        if (missing instanceof HTMLElement) missing.removeAttribute("hidden");
        if (panel instanceof HTMLElement) panel.setAttribute("hidden", "");
      } else {
        if (missing instanceof HTMLElement) missing.setAttribute("hidden", "");
        if (panel instanceof HTMLElement) panel.removeAttribute("hidden");
        refreshUi(root);
      }
    })
    .catch(() => {
      if (missing instanceof HTMLElement) {
        missing.textContent =
          "Could not load size charts. Check your connection and refresh, or complete Foundation and Style first.";
        missing.removeAttribute("hidden");
      }
    });

  root.querySelectorAll("[data-cb-finished-input]").forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const save = (): void => {
      persistFinishedFromInputs(root, getExpressUiUnit());
      renderSummary(root, getExpressUiUnit());
    };
    input.addEventListener("change", save);
    input.addEventListener("blur", save);
  });

  window.addEventListener("kbm:units-change", (ev: Event) => {
    const tid = (ev as CustomEvent<{ toggleId?: string }>).detail?.toggleId;
    if (tid != null && tid !== SLEEVELESS_EXPRESS_SIZE_UNIT_TOGGLE_ID) return;
    refreshUi(root);
  });
}

if (typeof document !== "undefined") {
  const boot = (): void => initCustomBuildMeasurementsPage();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
