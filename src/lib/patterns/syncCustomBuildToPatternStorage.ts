/**
 * Maps Custom Build wizard state (Foundation, Style, measurements step) into canonical
 * `kbm_current_pattern` / `patternBuilderData` for {@link generateSleevelessBackPattern}.
 *
 * Custom measurement overrides (`cbMeasurementOverrides` in Express builder storage) are merged
 * into generator input on the pattern page; armhole depth is applied in pattern math when valid
 * (see {@link resolveEffectiveArmholeDepthInches}). Other overrides remain stored only.
 */
import {
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import {
  computeDefaultMeasurementsFromChartRow,
  findExpressChartRow,
  loadExpressSweaterCharts,
  nonEmptyTrimmed,
  resolveExpressChartFit,
} from "./sleevelessExpressSizeChartClient";
import { expressWhoToChartAudience } from "./syncSleevelessExpressDesignToStorage";
import {
  mapExpressNecklineToStorage,
  syncSleevelessDesignBasicsToPatternStorage,
} from "./syncSleevelessExpressDesignToStorage";
import { seedCustomBuildBodyFinishedFromChartRow } from "./sleevelessCustomBuildBodyMeasurements";
import { loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import {
  CUSTOM_BUILD_NECKLINE_STYLE_KEY,
  readCustomBuildWizardNeckline,
} from "./sleevelessCustomBuildWizardNeckline";

/** Keys written by `/patterns/sleeveless/custom-style` (see `sleeveless-custom-style-page.ts`). */
export const CUSTOM_BUILD_STYLE_STORAGE_KEYS = {
  bodyShape: "bodyShape",
  garmentType: "garmentType",
} as const;

/** Neckline choices on Style & Shaping (`sleeveless-custom-style-page.ts`). */
const CUSTOM_BUILD_NECKLINE_VALUES = new Set(["round", "v-neck"]);

export { CUSTOM_BUILD_NECKLINE_STYLE_KEY, readCustomBuildWizardNeckline };

const DEFAULT_AVAILABLE_NEEDLES = "200";

function readExpressPersisted(): Record<string, unknown> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    return p as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readCustomBuildExpressValues(): Record<string, string> {
  const p = readExpressPersisted();
  const v = p?.values;
  if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, string>) };
  return {};
}

function readStyleStepValue(key: string, allowed: Set<string>, fallback: string): string {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key)?.trim() ?? "";
    if (allowed.has(raw)) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

function resolveGarmentFromType(garmentType: string): {
  frontStyle: "open" | "closed";
  garmentStyle: "pullover" | "cardigan";
} {
  if (garmentType === "cardigan") {
    return { frontStyle: "open", garmentStyle: "cardigan" };
  }
  return { frontStyle: "closed", garmentStyle: "pullover" };
}

function resolveBodyShape(raw: string): string {
  if (raw === "aline") return "aline";
  return "straight";
}

function ensureYarnGaugeMachineDefaults(): void {
  const data = getPatternData();
  const ygm =
    data.yarnGaugeMachine && typeof data.yarnGaugeMachine === "object" && !Array.isArray(data.yarnGaugeMachine)
      ? { ...(data.yarnGaugeMachine as Record<string, unknown>) }
      : {};
  const machine =
    data.machine && typeof data.machine === "object" && !Array.isArray(data.machine)
      ? { ...(data.machine as Record<string, unknown>) }
      : {};

  let changed = false;
  const needles = ygm.availableNeedles ?? machine.availableNeedles;
  if (needles == null || String(needles).trim() === "") {
    ygm.availableNeedles = DEFAULT_AVAILABLE_NEEDLES;
    machine.availableNeedles = DEFAULT_AVAILABLE_NEEDLES;
    changed = true;
  }

  if (changed) {
    saveCurrentPattern({
      yarnGaugeMachine: ygm,
      machine,
    });
    savePatternData("yarnGaugeMachine", ygm);
    savePatternData("machine", machine);
  }
}

export type SyncCustomBuildOptions = {
  /** When true, wait for chart JSON before syncing (default true in browser). */
  awaitCharts?: boolean;
};

/**
 * Push Custom Build selections into pattern storage. Safe to call repeatedly (merge-friendly).
 */
export function syncCustomBuildToPatternStorage(options: SyncCustomBuildOptions = {}): void {
  const run = (): void => {
    const ev = readCustomBuildExpressValues();
    const wizardNeckline = readCustomBuildWizardNeckline();
    const neckline =
      ev.neckline && CUSTOM_BUILD_NECKLINE_VALUES.has(ev.neckline) ? ev.neckline : wizardNeckline;
    const bodyShapeRaw = readStyleStepValue(
      CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape,
      new Set(["straight", "aline", "shaped"]),
      "straight",
    );
    const garmentType = readStyleStepValue(
      CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType,
      new Set(["pullover", "cardigan"]),
      "pullover",
    );
    const garment = resolveGarmentFromType(garmentType);
    const fit = ev.fit === "close" || ev.fit === "standard" || ev.fit === "relaxed" ? ev.fit : "standard";
    const aud = ev.who ? expressWhoToChartAudience(ev.who) : "";
    const size = nonEmptyTrimmed(ev.selectedSize) ? ev.selectedSize!.trim() : "";

    const chartFit =
      aud && size ? resolveExpressChartFit(aud, size, fit) : null;
    const chartRow = chartFit ? findExpressChartRow(aud, chartFit.selectedSize) : null;

    let selectedMeasurements = chartFit?.selectedMeasurements;
    if (!selectedMeasurements && chartRow) {
      selectedMeasurements = computeDefaultMeasurementsFromChartRow(chartRow, fit);
    }

    syncSleevelessDesignBasicsToPatternStorage({
      ...(ev.who ? { who: ev.who } : {}),
      ...(neckline ? { neckline } : {}),
      fit,
      ...(size ? { selectedSize: size } : {}),
      ...(selectedMeasurements ? { selectedMeasurements } : {}),
      frontStyle: garment.frontStyle,
      garmentStyle: garment.garmentStyle,
      patternMode: "custom-build",
      ...(chartRow ? { chartRow, preserveCustomBuildFinished: true } : {}),
    });

    const bodyShape = resolveBodyShape(bodyShapeRaw);
    const neckCanon = neckline ? mapExpressNecklineToStorage(neckline) : undefined;
    const stylePatch: Record<string, unknown> = {
      bodyShape,
      length: "top",
      armholeStyle: "standard",
      patternMode: "custom-build",
      garmentStyle: garment.garmentStyle,
      frontStyle: garment.frontStyle,
    };
    if (neckCanon) stylePatch.neckline = neckCanon;
    if (aud) stylePatch.recipientCategory = aud;

    saveCurrentPattern({ style: stylePatch });
    savePatternData("style", { ...section(getPatternData().style), ...stylePatch });

    if (chartRow && fit) {
      seedCustomBuildBodyFinishedFromChartRow(chartRow, fit, { preserveFinished: true });
    }

    const overrides = loadMeasurementOverrides();
    if (Object.keys(overrides).length > 0) {
      const pbFit = section(getPatternData().fit);
      savePatternData("fit", { ...pbFit, cbMeasurementOverrides: overrides });
      saveCurrentPattern({ fit: { cbMeasurementOverrides: overrides } });
    }

    ensureYarnGaugeMachineDefaults();
  };

  if (options.awaitCharts === false) {
    run();
    return;
  }

  void loadExpressSweaterCharts().then(run).catch(run);
}

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
  return {};
}
