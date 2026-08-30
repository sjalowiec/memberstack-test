/**
 * Canonical Basic Sock draft (independent of the Sweater pattern record).
 *
 * Hat-style local blob: `kbm_socks_draft`. Extensible later (Fancy / Swan) without
 * modeling those constructions now — this version only knows Basic Sock fields.
 */

export const SOCK_DRAFT_STORAGE_KEY = "kbm_socks_draft";
export const SOCK_DRAFT_VERSION = 1 as const;

/** User-facing Pattern System name. */
export const SOCK_PATTERN_SYSTEM_DISPLAY_NAME = "Socks";
/** User-facing name of the first Socks construction. */
export const BASIC_SOCK_PATTERN_NAME = "Basic Socks";

export type SockDraftUnit = "inches" | "cm";

export type SockConstructionDirection = "cuff-to-toe" | "toe-up";

export type SockGaugeSlot = { stitch: string; row: string };

export const SOCK_CONSTRUCTION_DIRECTIONS = ["cuff-to-toe", "toe-up"] as const;

export type SockDraft = {
  version: typeof SOCK_DRAFT_VERSION;
  /** Construction identity for this pattern family (`socks`, matching PatternSystemId). */
  patternType: "socks";
  /** Pattern system key — do not reuse sleeveless/sweater identities. */
  patternSystem: "socks";
  unit: SockDraftUnit;
  /** Chart size id, `"custom"`, or empty before a size is chosen. */
  sizeSel: string;
  constructionDirection: SockConstructionDirection | "";
  /**
   * Finished measurements in the active display unit.
   * Chart sizes prefill these; Perfect Fit later customizes the same fields.
   */
  footCircumference: string;
  footLength: string;
  legCircumference: string;
  legLength: string;
  gaugeSlots: {
    inches: SockGaugeSlot;
    cm: SockGaugeSlot;
  };
  /**
   * Working needles available on the machine (shared field name with Hat / sweater).
   * Empty string when never entered.
   */
  availableNeedles: string;
  updatedAt: string;
};

export function emptySockGaugeSlots(): SockDraft["gaugeSlots"] {
  return {
    inches: { stitch: "", row: "" },
    cm: { stitch: "", row: "" },
  };
}

export function createEmptySockDraft(partial?: Partial<SockDraft>): SockDraft {
  return {
    version: SOCK_DRAFT_VERSION,
    patternType: "socks",
    patternSystem: "socks",
    unit: "inches",
    sizeSel: "",
    constructionDirection: "",
    footCircumference: "",
    footLength: "",
    legCircumference: "",
    legLength: "",
    gaugeSlots: emptySockGaugeSlots(),
    availableNeedles: "",
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function safeParseJson(raw: string | null): unknown {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeUnit(raw: unknown): SockDraftUnit {
  return raw === "cm" ? "cm" : "inches";
}

function normalizeConstructionDirection(raw: unknown): SockConstructionDirection | "" {
  return raw === "cuff-to-toe" || raw === "toe-up" ? raw : "";
}

function normalizeString(raw: unknown): string {
  return typeof raw === "string" ? raw : raw == null ? "" : String(raw);
}

function normalizeGaugeSlots(raw: unknown): SockDraft["gaugeSlots"] {
  const empty = emptySockGaugeSlots();
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const readSlot = (slot: unknown): SockGaugeSlot => {
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

/** Validate / coerce an unknown object into a SockDraft, or null. */
export function coerceSockDraft(raw: unknown): SockDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.patternType != null && o.patternType !== "socks" && o.patternType !== "sock") return null;
  if (o.patternSystem != null && o.patternSystem !== "socks") return null;

  return createEmptySockDraft({
    unit: normalizeUnit(o.unit),
    sizeSel: normalizeString(o.sizeSel),
    constructionDirection: normalizeConstructionDirection(o.constructionDirection),
    footCircumference: normalizeString(o.footCircumference),
    footLength: normalizeString(o.footLength),
    legCircumference: normalizeString(o.legCircumference),
    legLength: normalizeString(o.legLength),
    gaugeSlots: normalizeGaugeSlots(o.gaugeSlots),
    availableNeedles: normalizeString(o.availableNeedles),
    updatedAt:
      typeof o.updatedAt === "string" && o.updatedAt
        ? o.updatedAt
        : new Date().toISOString(),
  });
}

export function readSockDraft(
  storage: Pick<Storage, "getItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): SockDraft | null {
  return coerceSockDraft(safeParseJson(storage.getItem(SOCK_DRAFT_STORAGE_KEY)));
}

export function writeSockDraft(
  draft: SockDraft,
  storage: Pick<Storage, "setItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { setItem: () => undefined },
): void {
  const next: SockDraft = {
    ...draft,
    version: SOCK_DRAFT_VERSION,
    patternType: "socks",
    patternSystem: "socks",
    updatedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(SOCK_DRAFT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function clearSockDraftStorage(
  storage: Pick<Storage, "removeItem"> = typeof localStorage !== "undefined"
    ? localStorage
    : { removeItem: () => undefined },
): void {
  try {
    storage.removeItem(SOCK_DRAFT_STORAGE_KEY);
  } catch {
    /* private mode / quota */
  }
}

export function syncSockDraft(
  fields: Omit<SockDraft, "version" | "patternType" | "patternSystem" | "updatedAt">,
  storage?: Pick<Storage, "getItem" | "setItem">,
): SockDraft {
  const prev = readSockDraft(storage);
  const draft = createEmptySockDraft({
    ...prev,
    ...fields,
  });
  writeSockDraft(draft, storage);
  return draft;
}
