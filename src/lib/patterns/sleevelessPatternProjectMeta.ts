/**
 * Pattern name + project notes for sleeveless working draft, print, and saved Custom Pattern projects.
 * Canonical store: `kbm_current_pattern.patternProject` ({@link SleevelessPatternProjectMeta}).
 */
import {
  getCurrentPattern,
  getSleevelessChartAudience,
  saveCurrentPattern,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  type SleevelessPatternRecord,
} from "./patternStorage";
import { resolveSleevelessGarmentKind } from "./resolveSleevelessGarmentKind";
import { readCustomBuildWizardGarmentType } from "./sleevelessCustomBuildWizardNeckline";

export const PROJECT_NOTES_MAX_LENGTH = 300;

/** Fired when Express/Custom review context is ready — refresh auto title if needed. */
export const SLEEVELESS_REVIEW_CONTEXT_READY_EVENT = "kbm:sleeveless-review-context-ready";

const LEGACY_PRINT_TITLE_KEY = "kbm-pattern-print-personalization-title";
const LEGACY_PRINT_NOTES_KEY = "kbm-pattern-print-personalization-notes";

export interface SleevelessPatternProjectMeta {
  title: string;
  notes: string;
  /** When true, auto-generated titles are not applied over the user's title. */
  titleCustomized?: boolean;
}

export type SleevelessPatternTitleContext = {
  who?: string;
  neckline?: string;
  garmentStyle?: "pullover" | "cardigan";
  chartAudience?: string;
  selectedSize?: string;
};

/** Leading family name in auto-generated pattern titles (e.g. Sleeveless, Set-In Sleeve). */
export const SLEEVELESS_PATTERN_FAMILY_NAME = "Sleeveless";

function truncateNotes(notes: string): string {
  return notes.length <= PROJECT_NOTES_MAX_LENGTH
    ? notes
    : notes.slice(0, PROJECT_NOTES_MAX_LENGTH);
}

function normalizeMeta(raw: unknown): SleevelessPatternProjectMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { title: "", notes: "" };
  }
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const notes = truncateNotes(typeof o.notes === "string" ? o.notes : "");
  const titleCustomized = o.titleCustomized === true;
  return { title, notes, ...(titleCustomized ? { titleCustomized: true } : {}) };
}

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

function possessiveAudienceLabel(who: string, chartAudience?: string): string {
  const w = who.trim().toLowerCase();
  if (w === "women" || w === "woman") return "Women's";
  if (w === "men" || w === "man") return "Men's";
  if (w === "kids" || w === "kid" || w === "child") return "Child's";
  if (w === "baby") return "Baby's";

  const aud = String(chartAudience ?? "").trim().toLowerCase();
  if (aud === "men") return "Men's";
  if (aud === "kids") return "Child's";
  if (aud === "baby") return "Baby's";
  if (aud === "misses" || aud === "plus") return "Women's";
  return "Sleeveless";
}

function necklineTitlePart(neckline: string): string {
  const n = neckline.trim().toLowerCase();
  if (n === "v-neck" || n === "v") return "V-Neck";
  return "Round Neck";
}

function garmentTitlePart(garmentStyle: string | undefined): string {
  return garmentStyle === "cardigan" ? "Cardigan" : "Pullover";
}

/** User-facing default pattern name from design selections. */
export function buildDefaultSleevelessPatternTitle(
  ctx: SleevelessPatternTitleContext,
  patternFamily: string = SLEEVELESS_PATTERN_FAMILY_NAME,
): string {
  const audience = possessiveAudienceLabel(ctx.who ?? "", ctx.chartAudience);
  const neck = necklineTitlePart(ctx.neckline ?? "round");
  const garment = garmentTitlePart(ctx.garmentStyle);
  const size = String(ctx.selectedSize ?? "").trim();
  const audienceSize = size ? `${audience} Size ${size}` : audience;
  return `${patternFamily} ${garment} - ${audienceSize} ${neck}`;
}

export function inferSleevelessPatternTitleContext(
  pattern: SleevelessPatternRecord = getCurrentPattern(),
): SleevelessPatternTitleContext {
  const ls = readExpressValues();
  const style = pattern.style ?? {};
  const who = ls.who?.trim() || "";

  let neckline = ls.neckline?.trim() ?? "";
  if (!neckline) {
    const canon = String(style.neckline ?? "").trim().toLowerCase();
    if (canon === "v") neckline = "v-neck";
    else if (canon === "round") neckline = "round";
  }

  const garmentStyle = resolveSleevelessGarmentKind({
    wizardGarmentType: readCustomBuildWizardGarmentType(),
    canonicalStyle: style as Record<string, unknown>,
    expressValues: ls,
  }).garmentStyle;

  const fit = pattern.fit ?? {};
  const selectedSize =
    ls.selectedSize?.trim() ||
    (typeof fit.selectedSize === "string" ? fit.selectedSize.trim() : "");

  return {
    who,
    neckline,
    garmentStyle,
    chartAudience: getSleevelessChartAudience(pattern),
    ...(selectedSize ? { selectedSize } : {}),
  };
}

export function getPatternProjectMeta(
  pattern: SleevelessPatternRecord = getCurrentPattern(),
): SleevelessPatternProjectMeta {
  migrateLegacyPrintSessionToPatternProject(pattern);
  return normalizeMeta(getCurrentPattern().patternProject);
}

export function savePatternProjectMeta(
  patch: Partial<SleevelessPatternProjectMeta>,
  pattern: SleevelessPatternRecord = getCurrentPattern(),
): SleevelessPatternProjectMeta {
  const current = getPatternProjectMeta(pattern);
  const next: SleevelessPatternProjectMeta = {
    title: patch.title !== undefined ? patch.title : current.title,
    notes: patch.notes !== undefined ? truncateNotes(patch.notes) : current.notes,
    titleCustomized:
      patch.titleCustomized !== undefined ? patch.titleCustomized : current.titleCustomized,
  };
  if (!next.titleCustomized) delete next.titleCustomized;
  saveCurrentPattern({ patternProject: next });
  syncPatternProjectToPrintSession(next);
  return next;
}

/** Applies auto title when the user has not customized the name. */
export function refreshAutoPatternProjectTitle(
  ctx: SleevelessPatternTitleContext = inferSleevelessPatternTitleContext(),
): SleevelessPatternProjectMeta {
  const current = getPatternProjectMeta();
  if (current.titleCustomized) return current;
  const title = buildDefaultSleevelessPatternTitle(ctx);
  return savePatternProjectMeta({ title, titleCustomized: false });
}

export function getPatternProjectPrintFields(): { title: string; notes: string } {
  const meta = getPatternProjectMeta();
  return { title: meta.title.trim(), notes: meta.notes };
}

export const SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK =
  "Sleeveless sweater · Pattern instructions";

/** Online pattern tab heading from saved project title, or generic fallback. */
export function getSleevelessPatternOnlineHeading(
  meta: SleevelessPatternProjectMeta,
  fallback: string = SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
): string {
  const title = meta.title.trim();
  return title || fallback;
}

/**
 * Single-line collapsed preview: line breaks and runs of whitespace become one space.
 * Plain text only — use with `textContent`, not HTML.
 */
export function formatPatternProjectNotesPreview(notes: string): string {
  return notes
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

/** Online pattern tab notes body, or null when empty. Preserves internal line breaks. */
export function getSleevelessPatternOnlineNotesText(meta: SleevelessPatternProjectMeta): string | null {
  if (!meta.notes.trim()) return null;
  return meta.notes;
}

export function syncPatternProjectToPrintSession(
  meta: SleevelessPatternProjectMeta = getPatternProjectMeta(),
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(LEGACY_PRINT_TITLE_KEY, meta.title.trim());
    sessionStorage.setItem(LEGACY_PRINT_NOTES_KEY, meta.notes);
  } catch {
    /* ignore */
  }
}

/** One-time migration from session-only print keys into the working draft. */
export function migrateLegacyPrintSessionToPatternProject(
  pattern: SleevelessPatternRecord = getCurrentPattern(),
): void {
  const existing = normalizeMeta(pattern.patternProject);
  if (existing.title.trim() || existing.notes.trim()) return;
  if (typeof sessionStorage === "undefined") return;
  try {
    const sessionTitle = sessionStorage.getItem(LEGACY_PRINT_TITLE_KEY)?.trim() ?? "";
    const sessionNotes = truncateNotes(sessionStorage.getItem(LEGACY_PRINT_NOTES_KEY) ?? "");
    if (!sessionTitle && !sessionNotes.trim()) return;
    saveCurrentPattern({
      patternProject: {
        title: sessionTitle,
        notes: sessionNotes,
        ...(sessionTitle ? { titleCustomized: true } : {}),
      },
    });
  } catch {
    /* ignore */
  }
}
