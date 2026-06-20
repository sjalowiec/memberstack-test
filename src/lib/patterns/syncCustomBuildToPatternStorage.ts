/**
 * Maps Custom Build wizard state (Foundation, Style, measurements step) into canonical
 * `kbm_current_pattern` / `patternBuilderData` for {@link generateSleevelessBackPattern}.
 *
 * Custom measurement overrides (`cbMeasurementOverrides` in Express builder storage) are merged
 * into generator input on the pattern page; armhole depth is applied in pattern math when valid
 * (see {@link resolveEffectiveArmholeDepthInches}, {@link resolveEffectiveFinishedLengthInches},
 * {@link resolveEffectiveFinishedBustInches}, {@link resolveEffectiveShoulderWidthInches},
 * {@link resolveEffectiveNeckOpeningWidthInches}, {@link resolveEffectiveFrontNeckDepthInches},
 * {@link resolveEffectiveHemDepthInches}). Other overrides remain stored only.
 */
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { resolveAvailableNeedlesFromSources } from "./availableNeedlesMirrors";
import {
  computeDefaultMeasurementsFromChartRow,
  findExpressChartRow,
  loadExpressSweaterCharts,
  nonEmptyTrimmed,
  normalizeChartRowSize,
  resolveExpressChartFit,
} from "./sleevelessExpressSizeChartClient";
import {
  expressWhoToChartAudience,
  mapExpressStyleKey,
  mapExpressNecklineToStorage,
  syncSleevelessDesignBasicsToPatternStorage,
} from "./syncSleevelessExpressDesignToStorage";
import {
  buildDropShoulderReviewDisplayIdentity,
  markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged,
} from "./dropShoulderReviewDiagramRefresh";
import {
  reconcileCustomBuildOverridesForSizingIdentityChange,
  resolveDropShoulderOverrideReconcileFlag,
  writeOverrideSeedSizingIdentity,
} from "./customBuildMeasurementOverrideReconcile";
import { isActiveDropShoulderConstruction } from "./patternConstructionIdentity";
import {
  reconcileStraightTorsoChartMeasurements,
  reconcileStraightTorsoOverridesPreservingUserHip,
  seedCustomBuildBodyFinishedFromChartRow,
} from "./sleevelessCustomBuildBodyMeasurements";
import {
  loadMeasurementOverrides,
  persistMeasurementOverrides,
  readCanonicalMeasurementOverrides,
} from "./sleevelessCustomMeasurementStorage";
import {
  CUSTOM_BUILD_NECKLINE_STYLE_KEY,
  readCustomBuildWizardNeckline,
} from "./sleevelessCustomBuildWizardNeckline";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import {
  buildSizingIdentityFromExpressValues,
  detachActiveSavedProjectWhenChartAudienceDrifts,
} from "./savedCustomPatternSessionIdentity";
import {
  overrideRecordsEqual,
  sectionPatchWouldChange,
} from "./patternSectionPatch";

export { CUSTOM_BUILD_STYLE_STORAGE_KEYS };

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

/**
 * Pattern mode for {@link syncCustomBuildToPatternStorage} only (Custom Build routes).
 * Express review keeps `patternMode: express` when already stored; otherwise default custom-build.
 * Do not infer Express from wizard `values` — Custom Build uses the same express-builder storage shape.
 */
function resolveSyncPatternMode(): "express" | "custom-build" {
  const canonicalMode = String(section(getCurrentPattern().style).patternMode ?? "").trim();
  const pbMode = String(section(getPatternData().style).patternMode ?? "").trim();

  if (canonicalMode === "custom-build") return "custom-build";
  if (canonicalMode === "express") return "express";
  if (pbMode === "custom-build") return "custom-build";
  if (pbMode === "express") return "express";

  return "custom-build";
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
  const persisted = readExpressPersisted();
  const canonMachine = section(getCurrentPattern().machine);
  const resolved = resolveAvailableNeedlesFromSources(
    ygm.availableNeedles,
    machine.availableNeedles,
    canonMachine.availableNeedles,
    persisted?.availableNeedles,
  );
  if (resolved) {
    if (String(ygm.availableNeedles ?? "").trim() !== resolved) {
      ygm.availableNeedles = resolved;
      changed = true;
    }
    if (String(machine.availableNeedles ?? "").trim() !== resolved) {
      machine.availableNeedles = resolved;
      changed = true;
    }
  } else {
    ygm.availableNeedles = DEFAULT_AVAILABLE_NEEDLES;
    machine.availableNeedles = DEFAULT_AVAILABLE_NEEDLES;
    changed = true;
  }

  if (changed) {
    saveCurrentPattern({ machine });
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
    const bodyShapeFromStyleStep = readStyleStepValue(
      CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape,
      new Set(["straight", "aline", "shaped"]),
      "straight",
    );
    const bodyShapeRaw = ev.style?.trim()
      ? resolveBodyShape(mapExpressStyleKey(ev.style.trim()).bodyShape)
      : resolveBodyShape(bodyShapeFromStyleStep);
    let garmentType = readStyleStepValue(
      CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType,
      new Set(["pullover", "cardigan"]),
      "pullover",
    );
    const expressStyleKey = ev.style?.trim().toLowerCase() ?? "";
    const expressFront = ev.front?.trim().toLowerCase() ?? "";
    if (
      garmentType === "pullover" &&
      (expressFront === "open" || expressStyleKey.includes("cardigan"))
    ) {
      garmentType = "cardigan";
    }
    const garment = resolveGarmentFromType(garmentType);
    const fit = ev.fit === "close" || ev.fit === "standard" || ev.fit === "relaxed" ? ev.fit : "standard";
    const aud = ev.who ? expressWhoToChartAudience(ev.who) : "";
    const size = nonEmptyTrimmed(ev.selectedSize) ? ev.selectedSize!.trim() : "";

    const bodyShapeForChart = resolveBodyShape(bodyShapeRaw);
    const chartFit =
      aud && size
        ? resolveExpressChartFit(aud, size, fit, { bodyShape: bodyShapeForChart })
        : null;
    const chartRow = chartFit ? findExpressChartRow(aud, chartFit.selectedSize) : null;
    const currentSizingIdentity =
      aud && size ? { chartAudience: aud, selectedSize: size } : buildSizingIdentityFromExpressValues(ev);

    let selectedMeasurements = chartFit?.selectedMeasurements;
    if (!selectedMeasurements && chartRow) {
      selectedMeasurements = computeDefaultMeasurementsFromChartRow(chartRow, fit, {
        bodyShape: bodyShapeForChart,
      });
    }
    let reconciledOverrides = loadMeasurementOverrides();
    if (selectedMeasurements && bodyShapeForChart === "straight") {
      selectedMeasurements = reconcileStraightTorsoChartMeasurements(selectedMeasurements);
      const bust = selectedMeasurements.finished_bust_chest;
      if (bust !== undefined && bust > 0) {
        reconciledOverrides = reconcileStraightTorsoOverridesPreservingUserHip(
          bust,
          reconciledOverrides,
        );
      }
    }
    if (chartRow && currentSizingIdentity) {
      if (isActiveDropShoulderConstruction() && aud && size) {
        markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged(
          buildDropShoulderReviewDisplayIdentity(
            aud,
            chartRow ? normalizeChartRowSize(chartRow) || size : size,
            fit,
          ),
        );
      }
      reconciledOverrides = reconcileCustomBuildOverridesForSizingIdentityChange({
        currentIdentity: currentSizingIdentity,
        currentRow: chartRow,
        fitPreference: fit,
        overrides: reconciledOverrides,
        bodyShape: bodyShapeForChart,
        dropShoulder: resolveDropShoulderOverrideReconcileFlag(),
      });
    }
    if (Object.keys(reconciledOverrides).length > 0) {
      const canonicalOverrides = readCanonicalMeasurementOverrides();
      if (!overrideRecordsEqual(reconciledOverrides, canonicalOverrides)) {
        persistMeasurementOverrides(reconciledOverrides);
        const pbFit = section(getPatternData().fit);
        const fitPatch = { ...pbFit, cbMeasurementOverrides: reconciledOverrides };
        if (sectionPatchWouldChange(pbFit, fitPatch)) {
          savePatternData("fit", fitPatch);
        }
        const canonFit = section(getCurrentPattern().fit);
        const canonFitPatch = { cbMeasurementOverrides: reconciledOverrides };
        if (sectionPatchWouldChange(canonFit, canonFitPatch)) {
          saveCurrentPattern({ fit: canonFitPatch });
        }
      }
    }

    const patternMode = resolveSyncPatternMode();

    syncSleevelessDesignBasicsToPatternStorage({
      ...(ev.who ? { who: ev.who } : {}),
      ...(neckline ? { neckline } : {}),
      fit,
      ...(size ? { selectedSize: size } : {}),
      ...(selectedMeasurements ? { selectedMeasurements } : {}),
      frontStyle: garment.frontStyle,
      garmentStyle: garment.garmentStyle,
      patternMode,
      ...(chartRow ? { chartRow, preserveCustomBuildFinished: true } : {}),
    });

    const bodyShape = resolveBodyShape(bodyShapeRaw);
    const neckCanon = neckline ? mapExpressNecklineToStorage(neckline) : undefined;
    const stylePatch: Record<string, unknown> = {
      bodyShape,
      length: "top",
      armholeStyle: "standard",
      patternMode,
      garmentStyle: garment.garmentStyle,
      frontStyle: garment.frontStyle,
    };
    if (neckCanon) stylePatch.neckline = neckCanon;
    if (aud) stylePatch.recipientCategory = aud;

    const canonStyle = section(getCurrentPattern().style);
    const pbStyle = section(getPatternData().style);
    if (sectionPatchWouldChange(canonStyle, stylePatch)) {
      saveCurrentPattern({ style: stylePatch });
    }
    const mergedPbStyle = { ...pbStyle, ...stylePatch };
    if (sectionPatchWouldChange(pbStyle, mergedPbStyle)) {
      savePatternData("style", mergedPbStyle);
    }

    if (chartRow && fit) {
      seedCustomBuildBodyFinishedFromChartRow(chartRow, fit, {
        preserveFinished: true,
        bodyShape: bodyShapeForChart,
      });
    }

    const overrides = reconciledOverrides;
    if (Object.keys(overrides).length > 0) {
      const pbFit = section(getPatternData().fit);
      const fitPatch = { ...pbFit, cbMeasurementOverrides: overrides };
      if (sectionPatchWouldChange(pbFit, fitPatch)) {
        savePatternData("fit", fitPatch);
      }
      const canonFit = section(getCurrentPattern().fit);
      const canonFitPatch = { cbMeasurementOverrides: overrides };
      if (sectionPatchWouldChange(canonFit, canonFitPatch)) {
        saveCurrentPattern({ fit: canonFitPatch });
      }
    }

    if (currentSizingIdentity && !isActiveDropShoulderConstruction()) {
      writeOverrideSeedSizingIdentity(currentSizingIdentity);
    }

    ensureYarnGaugeMachineDefaults();

    const sizingIdentity = buildSizingIdentityFromExpressValues(ev);
    if (sizingIdentity) {
      detachActiveSavedProjectWhenChartAudienceDrifts(sizingIdentity);
    }
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
