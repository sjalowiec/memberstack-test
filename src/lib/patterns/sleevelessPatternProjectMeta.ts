/**
 * Pattern name + project notes for sleeveless working draft, print, and saved Custom Pattern projects.
 * Canonical store: `kbm_current_pattern.patternProject` ({@link SleevelessPatternProjectMeta}).
 */
import { readActiveCustomPatternProjectLinkedName } from "./customPatternProjectActiveId";
import {
  getCurrentPattern,
  getSleevelessChartAudience,
  saveCurrentPattern,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
  type SleevelessPatternRecord,
} from "./patternStorage";
import { hasAuthoritativeDropShoulderConstruction } from "./patternConstructionIdentity";
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

/** Family name used for drop-shoulder construction patterns. */
export const DROP_SHOULDER_PATTERN_FAMILY_NAME = "Drop Shoulder";

/** True when the pattern's style is a drop-shoulder construction. */
function isDropShoulderPattern(pattern: SleevelessPatternRecord = getCurrentPattern()): boolean {
  return hasAuthoritativeDropShoulderConstruction(
    pattern.style as Record<string, unknown> | undefined,
  );
}

/** Family name for auto-titles, by construction. */
function patternFamilyNameForPattern(pattern: SleevelessPatternRecord = getCurrentPattern()): string {
  return isDropShoulderPattern(pattern)
    ? DROP_SHOULDER_PATTERN_FAMILY_NAME
    : SLEEVELESS_PATTERN_FAMILY_NAME;
}

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

/**
 * Audience prefix for auto-generated default names: "Women's", "Men's", "Kids'", "Baby".
 * Returns "" when the audience cannot be determined (title then falls back to the family name only).
 */
function audiencePrefixLabel(who: string, chartAudience?: string): string {
  const w = who.trim().toLowerCase();
  if (w === "women" || w === "woman" || w === "misses" || w === "plus") return "Women's";
  if (w === "men" || w === "man") return "Men's";
  if (w === "kids" || w === "kid" || w === "child" || w === "children") return "Kids'";
  if (w === "baby" || w === "babies") return "Baby";

  const aud = String(chartAudience ?? "").trim().toLowerCase();
  if (aud === "men") return "Men's";
  if (aud === "kids") return "Kids'";
  if (aud === "baby") return "Baby";
  if (aud === "misses" || aud === "plus" || aud === "women") return "Women's";
  return "";
}

/**
 * User-facing default pattern name from the high-level pattern description only.
 *
 * Uses just the audience/category and the pattern family (e.g. "Women's Drop Shoulder",
 * "Baby Sleeveless"). Editable configuration (neckline, fit, sleeve length, gauge, size,
 * pullover/cardigan) is intentionally excluded so the name stays stable while the pattern is edited.
 */
export function buildDefaultSleevelessPatternTitle(
  ctx: SleevelessPatternTitleContext,
  patternFamily: string = SLEEVELESS_PATTERN_FAMILY_NAME,
): string {
  const audience = audiencePrefixLabel(ctx.who ?? "", ctx.chartAudience);
  return audience ? `${audience} ${patternFamily}` : patternFamily;
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

/**
 * The auto-generated default title (audience + family) for the given/working pattern, ignoring any
 * saved or user-customized title. Used to detect whether a save name is still an auto default so the
 * create flow can apply duplicate numbering regardless of the `titleCustomized` flag.
 */
export function buildDefaultPatternTitleForPattern(
  pattern: SleevelessPatternRecord = getCurrentPattern(),
): string {
  return buildDefaultSleevelessPatternTitle(
    inferSleevelessPatternTitleContext(pattern),
    patternFamilyNameForPattern(pattern),
  ).trim();
}

/**
 * Resolves the pattern name for save/update from working draft state only (no DOM).
 * Falls back to the linked saved-project name, then the auto-generated title from selections.
 */
export function resolvePatternProjectSaveNameFromState(
  pattern: SleevelessPatternRecord = getCurrentPattern(),
): string {
  const meta = getPatternProjectMeta(pattern);
  const draftTitle = meta.title.trim();
  if (draftTitle) return draftTitle;

  const linked = readActiveCustomPatternProjectLinkedName().trim();
  if (linked) return linked;

  return buildDefaultSleevelessPatternTitle(
    inferSleevelessPatternTitleContext(pattern),
    patternFamilyNameForPattern(pattern),
  ).trim();
}

/**
 * Resolves the pattern name for save/update from editable fields, then draft state fallbacks.
 * Used by Edit Pattern → Save Changes and shared saved-project save actions.
 */
export function resolvePatternProjectSaveName(root?: ParentNode): string {
  if (root) {
    const editDrawerTitle = root.querySelector<HTMLInputElement>("#sl-edit-title");
    const fromEditDrawer = editDrawerTitle?.value?.trim() ?? "";
    if (fromEditDrawer) return fromEditDrawer;

    const reviewTitle = root.querySelector<HTMLInputElement>("[data-sleeveless-pattern-project-title]");
    const fromReview = reviewTitle?.value?.trim() ?? "";
    if (fromReview) return fromReview;

    const panelName = root.querySelector<HTMLInputElement>("[data-cb-project-name]");
    const fromPanel = panelName?.value?.trim() ?? "";
    if (fromPanel) return fromPanel;
  }

  return resolvePatternProjectSaveNameFromState();
}

/**
 * Clears project title/notes on the working draft for a brand-new unsaved pattern.
 * Does not touch saved Blob projects or the active saved-project link (clear that separately).
 */
export function resetPatternProjectMetaForNewDraft(): SleevelessPatternProjectMeta {
  const next: SleevelessPatternProjectMeta = { title: "", notes: "", titleCustomized: false };
  saveCurrentPattern({ patternProject: next });
  syncPatternProjectToPrintSession({ title: "", notes: "" });
  return { title: "", notes: "" };
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
  const title = buildDefaultSleevelessPatternTitle(ctx, patternFamilyNameForPattern());
  return savePatternProjectMeta({ title, titleCustomized: false });
}

export function getPatternProjectPrintFields(): { title: string; notes: string } {
  const meta = getPatternProjectMeta();
  return { title: meta.title.trim(), notes: meta.notes };
}

/**
 * Makes a pattern name safe to use as a suggested PDF / Save-as filename.
 * Strips control chars and OS-illegal filename characters; keeps spaces, apostrophes,
 * and other readable characters so member names stay intact.
 */
export function sanitizePatternPrintFilenameTitle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120)
    .trim();
}

/**
 * Document title used for browser Save-as-PDF filename suggestions.
 * Prefers the sanitized pattern/project name; falls back to the page title when empty.
 */
export function resolvePatternPrintDocumentTitle(
  patternTitle: string,
  fallbackDocumentTitle: string,
): string {
  const sanitized = sanitizePatternPrintFilenameTitle(patternTitle);
  return sanitized || fallbackDocumentTitle;
}

export const SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK =
  "Sleeveless sweater · Pattern instructions";

export const DROP_SHOULDER_PATTERN_ONLINE_HEADING_FALLBACK =
  "Drop shoulder sweater · Pattern instructions";

/** Online pattern tab heading from saved project title, or construction-aware generic fallback. */
export function getSleevelessPatternOnlineHeading(
  meta: SleevelessPatternProjectMeta,
  fallback?: string,
): string {
  const title = meta.title.trim();
  if (title) return title;
  if (fallback !== undefined) return fallback;
  return isDropShoulderPattern()
    ? DROP_SHOULDER_PATTERN_ONLINE_HEADING_FALLBACK
    : SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK;
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

/** Clears legacy session-only print title/notes so they are not migrated into a new draft. */
export function clearPatternProjectPrintSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(LEGACY_PRINT_TITLE_KEY);
    sessionStorage.removeItem(LEGACY_PRINT_NOTES_KEY);
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
