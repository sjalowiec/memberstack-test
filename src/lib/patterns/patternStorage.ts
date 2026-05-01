/**
 * Client-side persistence for the sleeveless pattern builder.
 * Canonical store: localStorage key `kbm_current_pattern`.
 */

export const PATTERN_STORAGE_KEY = "kbm_current_pattern";

/** Older flat blob used across sleeveless pages — preserved via mirror writes for compatibility. */
export const LEGACY_GARMENT_CONFIG_KEY = "sleeveless-garment-config";

const LEGACY_STORAGE_CANDIDATES = [
  LEGACY_GARMENT_CONFIG_KEY,
  "sleevelessGarmentConfig",
  "sleevelessGarmentBuilder",
] as const;

export type PatternSectionName =
  | "style"
  | "fit"
  | "yarnGauge"
  | "measurements"
  | "machine"
  | "calculations"
  | "instructions";

export interface SleevelessPatternRecord {
  id: string;
  patternType: "sleeveless";
  status: "draft";
  version: number;
  createdAt: string;
  updatedAt: string;
  style: Record<string, unknown>;
  fit: Record<string, unknown>;
  yarnGauge: Record<string, unknown>;
  measurements: Record<string, unknown>;
  machine: Record<string, unknown>;
  calculations: Record<string, unknown>;
  instructions: Record<string, unknown>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function getPatternStorageKey(): string {
  return PATTERN_STORAGE_KEY;
}

export function generatePatternId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyPattern(id: string): SleevelessPatternRecord {
  const t = nowIso();
  return {
    id,
    patternType: "sleeveless",
    status: "draft",
    version: 1,
    createdAt: t,
    updatedAt: t,
    style: {},
    fit: {},
    yarnGauge: {},
    measurements: {},
    machine: {},
    calculations: {},
    instructions: {},
  };
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function looksLikePatternRecord(o: Record<string, unknown>): o is SleevelessPatternRecord {
  return (
    typeof o.id === "string" &&
    o.patternType === "sleeveless" &&
    typeof o.version === "number" &&
    isRecord(o.style) &&
    isRecord(o.fit) &&
    isRecord(o.yarnGauge)
  );
}

/** Stable chart keys for sweater sizing — single source for normalization. */
export const SLEEVELESS_CHART_AUDIENCES = ["misses", "plus", "men", "kids", "baby"] as const;

export type SleevelessChartAudience = (typeof SLEEVELESS_CHART_AUDIENCES)[number];

/** Normalize legacy / stray casing to a stable audience key, or "". */
export function normalizeSleevelessAudience(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  const s = String(raw).trim().toLowerCase();
  if (s === "women" || s === "woman") return "misses";
  if ((SLEEVELESS_CHART_AUDIENCES as readonly string[]).includes(s)) return s;
  return "";
}

/**
 * Chart group for sizing UI: always prefer design (`style.recipientCategory`), then saved `fit.sizingChart`.
 * Stale `fit.sizingChart` must not override the design page choice.
 */
export function getSleevelessChartAudience(pattern: SleevelessPatternRecord): string {
  const st = pattern.style;
  const ft = pattern.fit;
  const fromStyle = normalizeSleevelessAudience(st.recipientCategory);
  if (fromStyle) return fromStyle;
  return normalizeSleevelessAudience(ft.sizingChart);
}

/**
 * Coerce a partially-valid or legacy-shaped stored object into a full record without dropping sections.
 * Prevents "invalid shape" from triggering a full legacy re-migration that would wipe `kbm_current_pattern`.
 */
function coerceSleevelessPatternRecord(parsed: Record<string, unknown>): SleevelessPatternRecord | null {
  const pt = parsed.patternType;
  if (pt !== undefined && pt !== null && pt !== "sleeveless") return null;

  const id =
    typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : generatePatternId();
  const version = typeof parsed.version === "number" && Number.isFinite(parsed.version) ? parsed.version : 1;
  const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : nowIso();

  return {
    id,
    patternType: "sleeveless",
    status: "draft",
    version,
    createdAt,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
    style: isRecord(parsed.style) ? parsed.style : {},
    fit: isRecord(parsed.fit) ? parsed.fit : {},
    yarnGauge: isRecord(parsed.yarnGauge) ? parsed.yarnGauge : {},
    measurements: isRecord(parsed.measurements) ? parsed.measurements : {},
    machine: isRecord(parsed.machine) ? parsed.machine : {},
    calculations: isRecord(parsed.calculations) ? parsed.calculations : {},
    instructions: isRecord(parsed.instructions) ? parsed.instructions : {},
  };
}

const DEBUG_PATTERN =
  typeof import.meta !== "undefined" && import.meta.env !== undefined && Boolean(import.meta.env.DEV);

function dbg(...args: unknown[]) {
  if (DEBUG_PATTERN) console.info("[patternStorage]", ...args);
}

/** Map legacy flat `sleeveless-garment-config` shape into section objects. */
function migrateLegacyFlat(legacy: Record<string, unknown>): Partial<SleevelessPatternRecord> {
  const style: Record<string, unknown> = {};
  const fit: Record<string, unknown> = {};
  const yarnGauge: Record<string, unknown> = {};
  const machine: Record<string, unknown> = {};

  let kf = legacy.knitFor;
  if (kf === "women") kf = "misses";
  if (typeof kf === "string") {
    style.recipientCategory = kf;
    fit.sizingChart = kf;
  }

  const shape = legacy.shape;
  if (shape === "straight" || shape === "aline" || shape === "gathered") {
    style.bodyShape = shape === "gathered" ? "straight" : shape;
  }

  if (legacy.length === "top" || legacy.length === "tunic" || legacy.length === "dress") {
    style.length = legacy.length;
  }
  if (legacy.frontStyle === "closed" || legacy.frontStyle === "open") {
    style.frontStyle = legacy.frontStyle;
  }
  if (legacy.neckline === "round" || legacy.neckline === "v") {
    style.neckline = legacy.neckline;
  }

  if (legacy.size !== undefined && legacy.size !== null && String(legacy.size) !== "") {
    fit.selectedSize = String(legacy.size);
  }

  let ease = legacy.fitPreference ?? legacy.fit;
  if (ease === "close" || ease === "standard" || ease === "relaxed") {
    fit.easeChoice = ease;
    fit.fitChoice = ease;
  }

  if (typeof legacy.yarnNotes === "string") {
    yarnGauge.yarnName = legacy.yarnNotes;
  }
  if (typeof legacy.yarnWeight === "string" && legacy.yarnWeight !== "") {
    yarnGauge.yarnWeight = legacy.yarnWeight;
  }
  if (legacy.gaugeStitchesPerInch !== undefined && legacy.gaugeStitchesPerInch !== null) {
    yarnGauge.stitchGauge = String(legacy.gaugeStitchesPerInch);
  }
  if (legacy.gaugeRowsPerInch !== undefined && legacy.gaugeRowsPerInch !== null) {
    yarnGauge.rowGauge = String(legacy.gaugeRowsPerInch);
  }
  yarnGauge.gaugeUnits = "per_inch";

  if (legacy.availableNeedles !== undefined && legacy.availableNeedles !== null && String(legacy.availableNeedles) !== "") {
    machine.availableNeedles = String(legacy.availableNeedles);
  }

  if (typeof legacy.fitAdjustmentsSummary === "string") {
    fit.fineTuneAdjustments = { summaryLine: legacy.fitAdjustmentsSummary };
  }

  return { style, fit, yarnGauge, machine };
}

function readLegacyFlatBestEffort(): Record<string, unknown> | null {
  if (typeof localStorage === "undefined") return null;
  for (const key of LEGACY_STORAGE_CANDIDATES) {
    const o = parseJsonObject(localStorage.getItem(key));
    if (o) return o;
  }
  return null;
}

function persistCanonical(pattern: SleevelessPatternRecord): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PATTERN_STORAGE_KEY, JSON.stringify(pattern));
  } catch {
    /* quota */
  }
}

/**
 * Writes the legacy flat JSON shape still expected by any stale scripts / bookmarks.
 * Keeps knitFor, yarnNotes, gauge* field names aligned with previous builders.
 */
export function mirrorLegacyGarmentConfigFlat(pattern: SleevelessPatternRecord): void {
  if (typeof localStorage === "undefined") return;
  const style = pattern.style;
  const fit = pattern.fit;
  const yarn = pattern.yarnGauge;
  const machine = pattern.machine;

  const recipientCategory = typeof style.recipientCategory === "string" ? style.recipientCategory : "";
  const bodyShape =
    style.bodyShape === "aline" || style.bodyShape === "straight" ? style.bodyShape : "straight";

  const ease =
    typeof fit.easeChoice === "string"
      ? fit.easeChoice
      : typeof fit.fitChoice === "string"
        ? fit.fitChoice
        : "";

  const yarnName =
    typeof yarn.yarnName === "string"
      ? yarn.yarnName
      : typeof yarn.yarnNotes === "string"
        ? yarn.yarnNotes
        : "";

  const flat: Record<string, unknown> = {
    knitFor: recipientCategory,
    shape: bodyShape,
    length: typeof style.length === "string" ? style.length : "top",
    frontStyle: typeof style.frontStyle === "string" ? style.frontStyle : "closed",
    neckline: typeof style.neckline === "string" ? style.neckline : "round",
    size: typeof fit.selectedSize === "string" ? fit.selectedSize : "",
    fitPreference:
      ease === "close" || ease === "standard" || ease === "relaxed" ? ease : "",
  };

  if (ease === "close" || ease === "standard" || ease === "relaxed") {
    flat.fit = ease;
  }

  flat.yarnNotes = yarnName;
  flat.yarnWeight = typeof yarn.yarnWeight === "string" ? yarn.yarnWeight : "";
  flat.gaugeStitchesPerInch =
    yarn.stitchGauge !== undefined && yarn.stitchGauge !== null ? String(yarn.stitchGauge) : "";
  flat.gaugeRowsPerInch =
    yarn.rowGauge !== undefined && yarn.rowGauge !== null ? String(yarn.rowGauge) : "";
  flat.availableNeedles =
    machine.availableNeedles !== undefined && machine.availableNeedles !== null
      ? String(machine.availableNeedles)
      : "";

  const adj = fit.fineTuneAdjustments;
  if (isRecord(adj) && typeof adj.summaryLine === "string") {
    flat.fitAdjustmentsSummary = adj.summaryLine;
  }

  try {
    localStorage.setItem(LEGACY_GARMENT_CONFIG_KEY, JSON.stringify(flat));
  } catch {
    /* quota */
  }
}

function mergeSection(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...base, ...patch };
}

/**
 * Returns the current draft pattern, creating one or migrating from legacy storage if needed.
 */
export function getCurrentPattern(): SleevelessPatternRecord {
  if (typeof localStorage === "undefined") {
    return emptyPattern(generatePatternId());
  }

  const raw = localStorage.getItem(PATTERN_STORAGE_KEY);
  const parsed = raw ? parseJsonObject(raw) : null;

  if (parsed) {
    const coerced = coerceSleevelessPatternRecord(parsed);
    if (coerced) {
      if (!looksLikePatternRecord(parsed)) {
        dbg("repairing partial kbm_current_pattern (coerce + persist)");
        persistCanonical(coerced);
        mirrorLegacyGarmentConfigFlat(coerced);
      }
      dbg("loaded pattern id=", coerced.id, "recipient=", coerced.style.recipientCategory, "sizingChart=", coerced.fit.sizingChart);
      return coerced;
    }
  }

  const id = generatePatternId();
  let pattern = emptyPattern(id);

  const legacy = readLegacyFlatBestEffort();
  if (legacy) {
    dbg("migrating legacy flat into kbm_current_pattern");
    const migrated = migrateLegacyFlat(legacy);
    pattern = {
      ...pattern,
      style: mergeSection(pattern.style, migrated.style ?? {}),
      fit: mergeSection(pattern.fit, migrated.fit ?? {}),
      yarnGauge: mergeSection(pattern.yarnGauge, migrated.yarnGauge ?? {}),
      machine: mergeSection(pattern.machine, migrated.machine ?? {}),
      updatedAt: nowIso(),
    };
  }

  persistCanonical(pattern);
  mirrorLegacyGarmentConfigFlat(pattern);
  return pattern;
}

export type PatternPartial = Partial<
  Omit<SleevelessPatternRecord, "style" | "fit" | "yarnGauge" | "measurements" | "machine" | "calculations" | "instructions">
> & {
  style?: Record<string, unknown>;
  fit?: Record<string, unknown>;
  yarnGauge?: Record<string, unknown>;
  measurements?: Record<string, unknown>;
  machine?: Record<string, unknown>;
  calculations?: Record<string, unknown>;
  instructions?: Record<string, unknown>;
};

export function saveCurrentPattern(partialData: PatternPartial): SleevelessPatternRecord {
  const current = getCurrentPattern();
  const next: SleevelessPatternRecord = {
    ...current,
    updatedAt: nowIso(),
    style: partialData.style ? mergeSection(current.style, partialData.style) : current.style,
    fit: partialData.fit ? mergeSection(current.fit, partialData.fit) : current.fit,
    yarnGauge: partialData.yarnGauge
      ? mergeSection(current.yarnGauge, partialData.yarnGauge)
      : current.yarnGauge,
    measurements: partialData.measurements
      ? mergeSection(current.measurements, partialData.measurements)
      : current.measurements,
    machine: partialData.machine ? mergeSection(current.machine, partialData.machine) : current.machine,
    calculations: partialData.calculations
      ? mergeSection(current.calculations, partialData.calculations)
      : current.calculations,
    instructions: partialData.instructions
      ? mergeSection(current.instructions, partialData.instructions)
      : current.instructions,
  };

  if (partialData.status !== undefined) next.status = partialData.status;
  if (partialData.version !== undefined) next.version = partialData.version;

  persistCanonical(next);
  mirrorLegacyGarmentConfigFlat(next);
  return next;
}

export function updatePatternSection(
  sectionName: PatternSectionName,
  sectionData: Record<string, unknown>,
): SleevelessPatternRecord {
  const current = getCurrentPattern();
  const mergedSection = mergeSection(
    current[sectionName] as Record<string, unknown>,
    sectionData,
  );
  return saveCurrentPattern({ [sectionName]: mergedSection } as PatternPartial);
}

export function clearCurrentPattern(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PATTERN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Formatted JSON string for export / future dashboard sync. */
export function exportCurrentPatternJson(): string {
  const p = getCurrentPattern();
  return JSON.stringify(p, null, 2);
}

export type SaveStatusCallback = (message: string) => void;

let saveStatusTimer: ReturnType<typeof setTimeout> | null = null;

/** Shows a short save confirmation; clears after a moment so it stays unobtrusive. */
export function notifyPatternSaved(setLabel: SaveStatusCallback, message = "Saved just now"): void {
  setLabel(message);
  if (saveStatusTimer) clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(() => {
    setLabel("");
    saveStatusTimer = null;
  }, 2200);
}
