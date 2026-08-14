/**
 * Canonical Hat Pattern Builder draft (Phase A).
 *
 * Migrates fragmented legacy localStorage keys into one `kbm_hat_draft` blob so
 * Phase B can move Build → Summary → Pattern without losing choices.
 */

import { canonicalHatFitStyle } from "./hatMath";

export const HAT_DRAFT_STORAGE_KEY = "kbm_hat_draft";
export const HAT_DRAFT_VERSION = 1 as const;

/** Legacy keys written by the single-page hat builder. */
export const LEGACY_HAT_SIZE_STORAGE_KEY = "hat-builder-hat-size";
export const LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY = "hat-builder-pattern-inputs";
export const LEGACY_HAT_GAUGE_SLOTS_KEY = "hat-builder-gauge-slots";
export const LEGACY_HAT_UNIT_KEY = "hat-unit";
export const LEGACY_HAT_SHOW_TIPS_KEY = "hat-show-tips";

export type HatDraftUnit = "inches" | "cm";

export type HatGaugeSlot = { stitch: string; row: string };

export type HatDraft = {
  version: typeof HAT_DRAFT_VERSION;
  /** Stable identity for future cloud save (`patternType: "hat"`). */
  patternType: "hat";
  /** Pattern system key — do not reuse sleeveless/sweater identities. */
  patternSystem: "hat";
  unit: HatDraftUnit;
  sizeSel: string;
  customCircumference: string;
  brimType: string;
  brimLength: string;
  crownShaping: string;
  fit: string;
  customHatLength: string;
  gaugeSlots: {
    inches: HatGaugeSlot;
    cm: HatGaugeSlot;
  };
  /**
   * Working needles available on the machine (shared field name with sweater builders).
   * Empty string when never entered — older drafts omit this key and coerce to "".
   */
  availableNeedles: string;
  showTips: boolean;
  /** Set when draft was created/updated from legacy keys. */
  migratedFromLegacy?: boolean;
  updatedAt: string;
};

export function emptyHatGaugeSlots(): HatDraft["gaugeSlots"] {
  return {
    inches: { stitch: "", row: "" },
    cm: { stitch: "", row: "" },
  };
}

export function createEmptyHatDraft(partial?: Partial<HatDraft>): HatDraft {
  return {
    version: HAT_DRAFT_VERSION,
    patternType: "hat",
    patternSystem: "hat",
    unit: "inches",
    sizeSel: "",
    customCircumference: "",
    brimType: "",
    brimLength: "",
    crownShaping: "",
    fit: "",
    customHatLength: "",
    gaugeSlots: emptyHatGaugeSlots(),
    availableNeedles: "",
    showTips: false,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

/** Digits-only needle count string, or "" when missing/invalid shape (never invents a default). */
function normalizeAvailableNeedles(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  return s;
}

function safeParseJson(raw: string | null): unknown {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeCrown(raw: string): string {
  const v = raw.trim();
  if (v === "wedge-4") return "wedge-4-decrease";
  return v;
}

function normalizeUnit(raw: unknown): HatDraftUnit {
  return raw === "cm" ? "cm" : "inches";
}

function normalizeGaugeSlots(raw: unknown): HatDraft["gaugeSlots"] {
  const empty = emptyHatGaugeSlots();
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const readSlot = (slot: unknown): HatGaugeSlot => {
    if (!slot || typeof slot !== "object") return { stitch: "", row: "" };
    const s = slot as Record<string, unknown>;
    return {
      stitch: typeof s.stitch === "string" ? s.stitch : String(s.stitch ?? ""),
      row: typeof s.row === "string" ? s.row : String(s.row ?? ""),
    };
  };
  return {
    inches: readSlot(o.inches),
    cm: readSlot(o.cm),
  };
}

/** Validate / coerce an unknown object into a HatDraft, or null. */
export function coerceHatDraft(raw: unknown): HatDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.patternType != null && o.patternType !== "hat") return null;

  const rawFit = typeof o.fit === "string" ? o.fit : "";
  const fit = canonicalHatFitStyle(rawFit);

  let crownShaping = typeof o.crownShaping === "string" ? normalizeCrown(o.crownShaping) : "";
  if (
    crownShaping &&
    !["gathered", "wedge-4-decrease", "spiral", ""].includes(crownShaping)
  ) {
    crownShaping = "";
  }

  let brimType = typeof o.brimType === "string" ? o.brimType : "";
  if (brimType && brimType !== "rolled" && brimType !== "single" && brimType !== "folded") {
    brimType = "";
  }

  return createEmptyHatDraft({
    unit: normalizeUnit(o.unit),
    sizeSel: typeof o.sizeSel === "string" ? o.sizeSel : "",
    customCircumference:
      typeof o.customCircumference === "string" ? o.customCircumference : "",
    brimType,
    brimLength: typeof o.brimLength === "string" ? o.brimLength : "",
    crownShaping,
    fit,
    customHatLength: typeof o.customHatLength === "string" ? o.customHatLength : "",
    gaugeSlots: normalizeGaugeSlots(o.gaugeSlots),
    availableNeedles: normalizeAvailableNeedles(o.availableNeedles),
    showTips: o.showTips === true,
    migratedFromLegacy: o.migratedFromLegacy === true,
    updatedAt:
      typeof o.updatedAt === "string" && o.updatedAt
        ? o.updatedAt
        : new Date().toISOString(),
  });
}

export function readHatDraft(
  storage: Pick<Storage, "getItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): HatDraft | null {
  return coerceHatDraft(safeParseJson(storage.getItem(HAT_DRAFT_STORAGE_KEY)));
}

export function writeHatDraft(
  draft: HatDraft,
  storage: Pick<Storage, "setItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { setItem: () => undefined },
): void {
  const next: HatDraft = {
    ...draft,
    version: HAT_DRAFT_VERSION,
    patternType: "hat",
    patternSystem: "hat",
    updatedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(HAT_DRAFT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Build a HatDraft from legacy fragmented keys (does not write).
 */
export function buildHatDraftFromLegacyKeys(
  storage: Pick<Storage, "getItem">,
): HatDraft | null {
  const sizeRaw = safeParseJson(storage.getItem(LEGACY_HAT_SIZE_STORAGE_KEY));
  const inputsRaw = safeParseJson(storage.getItem(LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY));
  const gaugeRaw = safeParseJson(storage.getItem(LEGACY_HAT_GAUGE_SLOTS_KEY));
  const unitRaw = storage.getItem(LEGACY_HAT_UNIT_KEY);
  const tipsRaw = storage.getItem(LEGACY_HAT_SHOW_TIPS_KEY);

  const hasAny =
    sizeRaw != null ||
    inputsRaw != null ||
    gaugeRaw != null ||
    (unitRaw != null && unitRaw !== "") ||
    tipsRaw != null;
  if (!hasAny) return null;

  let sizeSel = "";
  let customCircumference = "";
  if (sizeRaw && typeof sizeRaw === "object") {
    const s = sizeRaw as Record<string, unknown>;
    sizeSel = typeof s.sel === "string" ? s.sel : "";
    customCircumference = typeof s.circ === "string" ? s.circ : "";
  }

  let brimType = "";
  let brimLength = "";
  let crownShaping = "";
  let fit = "";
  let customHatLength = "";
  if (inputsRaw && typeof inputsRaw === "object") {
    const i = inputsRaw as Record<string, unknown>;
    brimType = typeof i.brimType === "string" ? i.brimType : "";
    brimLength = typeof i.brimLength === "string" ? i.brimLength : "";
    crownShaping =
      typeof i.crownShaping === "string" ? normalizeCrown(i.crownShaping) : "";
    fit = typeof i.fit === "string" ? i.fit : "";
    customHatLength = typeof i.customHatLength === "string" ? i.customHatLength : "";
  }

  return coerceHatDraft({
    patternType: "hat",
    unit: normalizeUnit(unitRaw),
    sizeSel,
    customCircumference,
    brimType,
    brimLength,
    crownShaping,
    fit,
    customHatLength,
    gaugeSlots: normalizeGaugeSlots(gaugeRaw),
    showTips: tipsRaw === "true",
    migratedFromLegacy: true,
  });
}

/**
 * Prefer existing `kbm_hat_draft`; otherwise migrate legacy keys and persist the draft.
 * Legacy keys are left in place during Phase A so the current page keep working.
 */
export function ensureHatDraftMigrated(
  storage: Pick<Storage, "getItem" | "setItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : {
        getItem: () => null,
        setItem: () => undefined,
      },
): HatDraft | null {
  const existing = readHatDraft(storage);
  if (existing) return existing;
  const migrated = buildHatDraftFromLegacyKeys(storage);
  if (!migrated) return null;
  writeHatDraft(migrated, storage);
  return migrated;
}

const HAT_DRAFT_CLEAR_KEYS = [
  HAT_DRAFT_STORAGE_KEY,
  LEGACY_HAT_SIZE_STORAGE_KEY,
  LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY,
  LEGACY_HAT_GAUGE_SLOTS_KEY,
  LEGACY_HAT_UNIT_KEY,
  LEGACY_HAT_SHOW_TIPS_KEY,
] as const;

/**
 * Remove the canonical hat draft and legacy builder keys so a later migrate cannot
 * resurrect previous choices (used by New Pattern / `?new=1`).
 */
export function clearHatDraftStorage(
  storage: Pick<Storage, "removeItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { removeItem: () => undefined },
): void {
  for (const key of HAT_DRAFT_CLEAR_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* private mode / quota */
    }
  }
}

/**
 * Snapshot current builder field values into the canonical draft (and keep writing legacy keys separately).
 */
export function syncHatDraftFromBuilderFields(
  fields: {
    unit: HatDraftUnit;
    sizeSel: string;
    customCircumference: string;
    brimType: string;
    brimLength: string;
    crownShaping: string;
    fit: string;
    customHatLength: string;
    gaugeSlots: HatDraft["gaugeSlots"];
    availableNeedles: string;
    showTips?: boolean;
  },
  storage?: Pick<Storage, "getItem" | "setItem">,
): HatDraft {
  const prev = readHatDraft(storage);
  const draft = createEmptyHatDraft({
    ...prev,
    ...fields,
    crownShaping: normalizeCrown(fields.crownShaping || ""),
    availableNeedles: normalizeAvailableNeedles(fields.availableNeedles),
    showTips: fields.showTips ?? prev?.showTips ?? false,
    migratedFromLegacy: prev?.migratedFromLegacy,
  });
  writeHatDraft(draft, storage);
  return draft;
}
