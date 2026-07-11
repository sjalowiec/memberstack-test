/**
 * Rehydrate Express wizard localStorage (`kbm_sleeveless_express_builder`) from the canonical
 * working pattern — used when reopening a saved project to revise gauge, size, style, etc.
 */
import {
  resolveAvailableNeedlesFromSources,
} from "./availableNeedlesMirrors";
import {
  CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY,
  readActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  getCurrentPattern,
  getPatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  type SleevelessPatternRecord,
} from "./patternStorage";
import {
  deriveExpressStyleKey,
  expressWhoToChartAudience,
  mapExpressStyleKey,
} from "./syncSleevelessExpressDesignToStorage";
import { writeOverrideSeedSizingIdentity } from "./customBuildMeasurementOverrideReconcile";
import { buildSizingIdentityFromExpressValues } from "./savedCustomPatternSessionIdentity";
import { mergeCbMeasurementOverridesFromFitSources } from "./sleevelessCustomMeasurementStorage";
import {
  EXPRESS_FLOW_STEPS,
  isExpressEditChoicesReopenSession,
  loadExpressPersisted,
  type ExpressPersistedV1,
} from "./sleevelessExpressResume";
import { syncExpressWizardToPatternStorage } from "./syncExpressWizardToPatternStorage";
import { CUSTOM_BUILD_GARMENT_TYPE_KEY, CUSTOM_BUILD_NECKLINE_STYLE_KEY } from "./sleevelessCustomBuildWizardNeckline";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import type { CustomPatternProjectSource } from "./customPatternProjectTypes";

export const SLEEVELESS_EXPRESS_EDIT_CHOICES_PARAM = "edit";
export const SLEEVELESS_EXPRESS_EDIT_CHOICES_VALUE = "choices";

export function chartAudienceToExpressWho(chartAudience: string): string {
  const a = String(chartAudience ?? "")
    .trim()
    .toLowerCase();
  if (a === "men" || a === "male") return "men";
  if (a === "kids" || a === "kid") return "kids";
  if (a === "baby") return "baby";
  return "women";
}

export function mapStorageNecklineToExpress(neckline: unknown): string {
  const s = String(neckline ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!s) return "";
  if (s === "v" || s === "v-neck" || s === "vneck" || s === "v_neck" || s === "v neck") return "v-neck";
  if (/\bv[\s_-]?neck\b/.test(s)) return "v-neck";
  if (s === "round") return "round";
  return "";
}

function section(obj: unknown): Record<string, unknown> {
  return obj && typeof obj === "object" && !Array.isArray(obj) ? { ...(obj as Record<string, unknown>) } : {};
}

function resolveFrontStyle(style: Record<string, unknown>): "open" | "closed" | "" {
  if (style.frontStyle === "open" || style.frontStyle === "closed") return style.frontStyle;
  if (style.garmentStyle === "cardigan") return "open";
  if (style.garmentStyle === "pullover") return "closed";
  return "";
}

function resolveGaugeFields(
  pattern: SleevelessPatternRecord,
  patternData: Record<string, unknown>,
): Pick<ExpressPersistedV1, "gaugeStitchRaw" | "gaugeRowRaw" | "availableNeedles"> {
  const yarnGauge = section(pattern.yarnGauge);
  const ygm = section(patternData.yarnGaugeMachine);
  const machinePb = section(patternData.machine);
  const machine = section(pattern.machine);

  let gaugeStitchRaw =
    typeof yarnGauge.gaugeStitchRaw === "string"
      ? yarnGauge.gaugeStitchRaw.trim()
      : typeof ygm.gaugeStitchRaw === "string"
        ? ygm.gaugeStitchRaw.trim()
        : "";
  let gaugeRowRaw =
    typeof yarnGauge.gaugeRowRaw === "string"
      ? yarnGauge.gaugeRowRaw.trim()
      : typeof ygm.gaugeRowRaw === "string"
        ? ygm.gaugeRowRaw.trim()
        : "";

  const unitRaw =
    typeof yarnGauge.gaugeRawUnit === "string"
      ? yarnGauge.gaugeRawUnit
      : typeof ygm.gaugeRawUnit === "string"
        ? ygm.gaugeRawUnit
        : "in";
  const basis: "in" | "cm" = unitRaw === "cm" ? "cm" : "in";

  if (!gaugeStitchRaw || !gaugeRowRaw) {
    const spi = parseFloat(String(yarnGauge.stitchGauge ?? ygm.gaugeStitchesPerInch ?? ""));
    const rpi = parseFloat(String(yarnGauge.rowGauge ?? ygm.gaugeRowsPerInch ?? ""));
    if (!gaugeStitchRaw && Number.isFinite(spi) && spi > 0) {
      gaugeStitchRaw = formatSwatchCountForGaugeInput(basis === "cm" ? (spi / 2.54) * 10 : spi * 4);
    }
    if (!gaugeRowRaw && Number.isFinite(rpi) && rpi > 0) {
      gaugeRowRaw = formatSwatchCountForGaugeInput(basis === "cm" ? (rpi / 2.54) * 10 : rpi * 4);
    }
  }

  // This function rebuilds the Express snapshot FROM the working draft (the saved project is the
  // source of truth on reopen). Prefer the just-loaded pattern/builder needle values over any prior
  // `kbm_sleeveless_express_builder` snapshot, otherwise a stale snapshot (from an earlier session or
  // a different pattern) would win and re-clobber the freshly-restored value.
  const needles = resolveAvailableNeedlesFromSources(
    ygm.availableNeedles,
    machinePb.availableNeedles,
    machine.availableNeedles,
    loadExpressPersisted()?.availableNeedles,
  );

  return {
    gaugeStitchRaw,
    gaugeRowRaw,
    ...(needles ? { availableNeedles: needles } : {}),
  };
}

/** Build Express wizard `values` from canonical pattern sections. */
export function buildExpressValuesFromPattern(
  pattern: SleevelessPatternRecord,
  patternData: Record<string, unknown> = getPatternData(),
): Record<string, string> {
  const style = { ...section(pattern.style), ...section(patternData.style) };
  const fit = { ...section(pattern.fit), ...section(patternData.fit) };

  const chartAudience = String(
    style.recipientCategory ?? fit.sizingChart ?? "",
  ).trim();
  const who = chartAudience ? chartAudienceToExpressWho(chartAudience) : "";

  const bodyShape = String(style.bodyShape ?? "").trim();
  let front = resolveFrontStyle(style);
  let styleKey = deriveExpressStyleKey(bodyShape, front);
  if (!front && styleKey) {
    const mapped = mapExpressStyleKey(styleKey);
    front = mapped.frontStyle;
  }
  if (!styleKey && bodyShape && front) {
    styleKey = deriveExpressStyleKey(bodyShape, front);
  }

  const selectedSize = String(fit.selectedSize ?? "").trim();
  const fitEase = String(fit.easeChoice ?? fit.fitChoice ?? "").trim();
  const neckline = mapStorageNecklineToExpress(style.neckline);

  const values: Record<string, string> = {};
  if (who) values.who = who;
  if (selectedSize) values.selectedSize = selectedSize;
  if (front) values.front = front;
  if (neckline) values.neckline = neckline;
  if (fitEase === "close" || fitEase === "standard" || fitEase === "relaxed") values.fit = fitEase;
  if (styleKey) {
    values.style = styleKey;
    values.shape = bodyShape || "straight";
  }

  return values;
}

export function hasExpressChoicesToRestore(values: Record<string, string>): boolean {
  const t = (k: string) => (values[k] ?? "").trim();
  return Boolean(
    t("who") ||
      t("selectedSize") ||
      t("style") ||
      t("front") ||
      t("neckline") ||
      t("fit"),
  );
}

function writeCustomBuildStyleHandoffKeys(pattern: SleevelessPatternRecord): void {
  if (typeof localStorage === "undefined") return;
  const style = section(pattern.style);
  const bodyShape = String(style.bodyShape ?? "").trim();
  if (bodyShape) {
    try {
      localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, bodyShape);
    } catch {
      /* ignore */
    }
  }
  const garment =
    style.garmentStyle === "cardigan" || style.garmentStyle === "pullover"
      ? style.garmentStyle
      : style.frontStyle === "open"
        ? "cardigan"
        : style.frontStyle === "closed"
          ? "pullover"
          : "";
  if (garment === "cardigan" || garment === "pullover") {
    try {
      localStorage.setItem(CUSTOM_BUILD_GARMENT_TYPE_KEY, garment);
      localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, garment);
    } catch {
      /* ignore */
    }
  }
  const neck = mapStorageNecklineToExpress(style.neckline);
  if (neck === "round" || neck === "v-neck") {
    try {
      localStorage.setItem(CUSTOM_BUILD_NECKLINE_STYLE_KEY, neck);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Writes `kbm_sleeveless_express_builder` (and Custom Build style handoff keys) from the working draft.
 * Returns false when there is not enough stored setup to prefill the wizard.
 */
export type RestoreSleevelessExpressBuilderOptions = {
  /** Change Pattern Choices — unlock and open the full editable wizard (not view-only resume). */
  editChoicesReopen?: boolean;
};

/** Whether the gauge step is unlocked (Change Pattern Choices unlocks all steps). */
export function isExpressGaugeStepEditable(
  persisted: ExpressPersistedV1 | null | undefined,
  values: Record<string, string>,
): boolean {
  if (isExpressEditChoicesReopenSession(persisted)) return true;
  return maxReachableFromExpressValues(values) >= EXPRESS_FLOW_STEPS;
}

export function maxReachableFromExpressValues(values: Record<string, string>): number {
  let m = 1;
  if (values.who && values.selectedSize) m = 2;
  if (values.who && values.selectedSize && values.front) m = 3;
  if (values.who && values.selectedSize && values.front && values.neckline) m = 4;
  if (values.who && values.selectedSize && values.front && values.neckline && values.fit) m = 5;
  return m;
}

export function restoreSleevelessExpressBuilderFromPattern(
  pattern: SleevelessPatternRecord = getCurrentPattern(),
  patternData: Record<string, unknown> = getPatternData(),
  options: RestoreSleevelessExpressBuilderOptions = {},
): boolean {
  if (typeof localStorage === "undefined") return false;

  const values = buildExpressValuesFromPattern(pattern, patternData);
  if (!hasExpressChoicesToRestore(values)) return false;

  const gauge = resolveGaugeFields(pattern, patternData);
  const editChoicesReopen = options.editChoicesReopen === true;
  const maxReachable = editChoicesReopen
    ? EXPRESS_FLOW_STEPS
    : maxReachableFromExpressValues(values);
  const openStep = editChoicesReopen ? EXPRESS_FLOW_STEPS : 1;

  const fit = { ...section(patternData.fit), ...section(pattern.fit) };
  const cbMeasurementOverrides = mergeCbMeasurementOverridesFromFitSources(
    pattern.fit,
    patternData.fit,
  );

  const snapshot: ExpressPersistedV1 = {
    values,
    openStep,
    maxReachable,
    flowSteps: EXPRESS_FLOW_STEPS,
    whoSizeCombined: true,
    ...(editChoicesReopen ? { editChoicesReopen: true } : {}),
    ...gauge,
    ...(Object.keys(cbMeasurementOverrides).length > 0 ? { cbMeasurementOverrides } : {}),
  };

  const sizingIdentity =
    values.who && values.selectedSize
      ? {
          chartAudience: expressWhoToChartAudience(values.who),
          selectedSize: values.selectedSize.trim(),
        }
      : buildSizingIdentityFromExpressValues(values);
  if (sizingIdentity && Object.keys(cbMeasurementOverrides).length > 0) {
    (snapshot as Record<string, unknown>).cbMeasurementOverridesSizingIdentity = sizingIdentity;
  }

  try {
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, JSON.stringify(snapshot));
    if (sizingIdentity) writeOverrideSeedSizingIdentity(sizingIdentity);
  } catch {
    return false;
  }

  writeCustomBuildStyleHandoffKeys(pattern);
  return true;
}

/**
 * Non-throwing wrapper for {@link restoreSleevelessExpressBuilderFromPattern}.
 * Use during saved-project open so a bad snapshot never blocks viewing the pattern.
 */
export function safeRestoreSleevelessExpressBuilderFromPattern(
  pattern: SleevelessPatternRecord = getCurrentPattern(),
  patternData: Record<string, unknown> = getPatternData(),
  options: RestoreSleevelessExpressBuilderOptions = {},
): boolean {
  try {
    return restoreSleevelessExpressBuilderFromPattern(pattern, patternData, options);
  } catch (error) {
    console.error("[kbm] Express builder restore failed; continuing without wizard snapshot.", error);
    return false;
  }
}

export function buildChangePatternChoicesHref(
  source: CustomPatternProjectSource = "express",
): string {
  const q = `${SLEEVELESS_EXPRESS_EDIT_CHOICES_PARAM}=${SLEEVELESS_EXPRESS_EDIT_CHOICES_VALUE}`;
  if (source === "custom-build") {
    return `/patterns/sleeveless/custom-build/design?${q}`;
  }
  return `/patterns/sleeveless-express?${q}`;
}

/** Click handler: re-sync wizard storage from the working draft, then navigate. */
export function navigateToChangePatternChoices(href: string): void {
  safeRestoreSleevelessExpressBuilderFromPattern(getCurrentPattern(), getPatternData(), {
    editChoicesReopen: true,
  });
  const values = buildExpressValuesFromPattern(getCurrentPattern(), getPatternData());
  syncExpressWizardToPatternStorage(values, null, { preferDomGauge: false });
  window.location.assign(href);
}

export function initChangePatternChoicesLinks(): void {
  if (typeof document === "undefined") return;
  const mode = getCurrentPattern().style?.patternMode;
  const source: CustomPatternProjectSource = mode === "express" ? "express" : "custom-build";
  document.querySelectorAll<HTMLElement>("[data-sleeveless-change-pattern-choices]").forEach((el) => {
    const href = el.getAttribute("href")?.trim() || buildChangePatternChoicesHref(source);
    if (el instanceof HTMLAnchorElement) el.href = href;
    el.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) {
        return;
      }
      event.preventDefault();
      navigateToChangePatternChoices(href);
    });
  });
}

export function isSleevelessExpressEditChoicesSearchParams(params: URLSearchParams): boolean {
  return params.get(SLEEVELESS_EXPRESS_EDIT_CHOICES_PARAM) === SLEEVELESS_EXPRESS_EDIT_CHOICES_VALUE;
}

/**
 * When `?edit=choices` is present, rehydrate the Express wizard from `kbm_current_pattern`
 * and strip the flag. Does not clear the active saved project id.
 */
export function applySleevelessExpressEditChoicesFromUrl(href = window.location.href): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(href, window.location.origin);
    if (!isSleevelessExpressEditChoicesSearchParams(url.searchParams)) return false;
    safeRestoreSleevelessExpressBuilderFromPattern(getCurrentPattern(), getPatternData(), {
      editChoicesReopen: true,
    });
    const values = buildExpressValuesFromPattern(getCurrentPattern(), getPatternData());
    syncExpressWizardToPatternStorage(values, null, { preferDomGauge: false });
    url.searchParams.delete(SLEEVELESS_EXPRESS_EDIT_CHOICES_PARAM);
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}

/** True when the knitter is editing an existing saved project (active id set). */
export function hasActiveSavedPatternProject(): boolean {
  return Boolean(readActiveCustomPatternProjectId());
}

export { CUSTOM_PATTERN_ACTIVE_PROJECT_ID_KEY };
