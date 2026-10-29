/**
 * Private My Notes for one saved pattern.
 * Print/project notes stay on `pattern.patternProject.notes` and are not used here.
 *
 * Keep MEMBER_NOTES_MAX_LENGTH in sync with netlify/functions/lib/custom-pattern-projects-store.js.
 */
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { readSockActiveProjectId as readStockingActiveProjectId } from "./christmasStocking/sockSavedProject";
import { readHatActiveProjectId } from "./hat/hatSavedProject";
import { pathnameFromHref } from "./savedPatternViewRoute";
import { readSavedPatternProjectIdFromUrl } from "./savedPatternViewUrl";
import { readSockActiveProjectId } from "./sock/sockSavedProject";

export const MEMBER_NOTES_MAX_LENGTH = 8000;

export type SavedPatternMemberNotesTarget = {
  projectId: string;
  family: "sleeveless";
};

export type SavedPatternMemberNotesActiveIds = {
  hat: string;
  socks: string;
  stocking: string;
  sweater: string;
};

export type MemberNotesLoadResult =
  | { ok: true; notes: string }
  | { ok: false; error: string };

export type MemberNotesFeedback = {
  /** Text that should stay in the editor. */
  draft: string;
  /** Last notes known to be stored. Null until a load succeeds. */
  stored: string | null;
  message: string;
  canSave: boolean;
  tone: "neutral" | "error" | "saved";
};

type NotesViewKind = "hat" | "socks" | "stocking" | "sweater";

function notesViewKind(pathname: string): NotesViewKind | null {
  if (/^\/patterns\/hat\/pattern\/?$/.test(pathname)) return "hat";
  if (/^\/patterns\/socks\/pattern\/?$/.test(pathname)) return "socks";
  if (/^\/patterns\/christmas-stocking\/pattern\/?$/.test(pathname)) return "stocking";
  if (
    /^\/patterns\/(?:sleeveless|drop-shoulder|set-in-sleeve|sideways-cardigan)\/pattern\/?$/.test(
      pathname,
    )
  ) {
    return "sweater";
  }
  return null;
}

/** Trimmed plain text. Non-strings and blank notes become "". */
export function normalizeMemberNotes(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

export function memberNotesFromProject(project: { memberNotes?: unknown } | null | undefined): string {
  const notes = normalizeMemberNotes(project?.memberNotes);
  return notes.length <= MEMBER_NOTES_MAX_LENGTH ? notes : notes.slice(0, MEMBER_NOTES_MAX_LENGTH);
}

export function savedPatternHasMemberNotes(notes: string): boolean {
  return normalizeMemberNotes(notes).length > 0;
}

type PrintMemberNotesSection = {
  querySelector(selector: string): { textContent: string | null } | null;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
};

/**
 * Put saved My Notes into the print document, next to At a Glance.
 * Blank notes hide the section. Line breaks stay in the text.
 */
export function applySavedMemberNotesToPrint(
  notes: string,
  root: { querySelectorAll(selector: string): Iterable<PrintMemberNotesSection> },
): void {
  if (typeof root.querySelectorAll !== "function") return;
  const text = normalizeMemberNotes(notes).slice(0, MEMBER_NOTES_MAX_LENGTH);
  for (const section of root.querySelectorAll("[data-pattern-print-member-notes]")) {
    const body = section.querySelector("[data-pattern-print-member-notes-body]");
    if (body) body.textContent = text;
    if (text) section.removeAttribute("hidden");
    else section.setAttribute("hidden", "");
  }
}

let prepareMemberNotesForPrint: (() => void) | null = null;

/** The saved-pattern page registers the loader for its current notes. */
export function setSavedMemberNotesPrintPrep(prepare: (() => void) | null): void {
  prepareMemberNotesForPrint = prepare;
}

/** Copy the saved notes into the print document before the PDF is generated. */
export function prepareSavedMemberNotesForPrint(): void {
  prepareMemberNotesForPrint?.();
}

const MEMBER_NOTES_DATE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Local calendar date, such as Oct 29, 2026. */
export function formatMemberNotesDate(date: Date): string {
  const month = MEMBER_NOTES_DATE_MONTHS[date.getMonth()];
  if (!month || Number.isNaN(date.getTime())) return "";
  return `${month} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Insert a date at the selection. Replaces selected text and keeps everything else.
 * Returns the original value when the result would pass the notes limit.
 */
export function insertMemberNotesDate(input: {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  dateText: string;
  maxLength?: number;
}): { value: string; selectionStart: number; selectionEnd: number; inserted: boolean } {
  const maxLength = input.maxLength ?? MEMBER_NOTES_MAX_LENGTH;
  const value = input.value;
  const length = value.length;
  let start = input.selectionStart ?? length;
  let end = input.selectionEnd ?? start;
  if (!Number.isFinite(start) || start < 0) start = 0;
  if (!Number.isFinite(end) || end < 0) end = 0;
  if (start > length) start = length;
  if (end > length) end = length;
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  if (!input.dateText) {
    return { value, selectionStart: start, selectionEnd: end, inserted: false };
  }
  const next = `${value.slice(0, start)}${input.dateText}${value.slice(end)}`;
  if (next.length > maxLength) {
    return { value, selectionStart: start, selectionEnd: end, inserted: false };
  }
  const cursor = start + input.dateText.length;
  return { value: next, selectionStart: cursor, selectionEnd: cursor, inserted: true };
}

/**
 * Saved pattern view that these notes belong to.
 * The URL `project` id wins. Otherwise the active id for that pattern type is used.
 * Hat, socks, and stocking ids are never borrowed from a sweater session.
 * Returns null on builders, the beta preview, and unsaved views.
 */
export function resolveSavedPatternMemberNotesTarget(
  href: string,
  activeIds: SavedPatternMemberNotesActiveIds,
): SavedPatternMemberNotesTarget | null {
  const kind = notesViewKind(pathnameFromHref(href));
  if (!kind) return null;
  const fromUrl = readSavedPatternProjectIdFromUrl(href);
  const fallback =
    kind === "hat"
      ? activeIds.hat
      : kind === "socks"
        ? activeIds.socks
        : kind === "stocking"
          ? activeIds.stocking
          : activeIds.sweater;
  const projectId = (fromUrl || fallback).trim();
  if (!projectId) return null;
  return { projectId, family: "sleeveless" };
}

export function readSavedPatternMemberNotesTarget(
  href: string | undefined = typeof window !== "undefined" ? window.location?.href : undefined,
): SavedPatternMemberNotesTarget | null {
  if (!href) return null;
  return resolveSavedPatternMemberNotesTarget(href, {
    hat: readHatActiveProjectId(),
    socks: readSockActiveProjectId(),
    stocking: readStockingActiveProjectId(),
    sweater: readActiveCustomPatternProjectId(),
  });
}

function loadErrorMessage(error: string, hadStoredNotes: boolean): string {
  const detail = error.trim() || "Could not load notes.";
  if (hadStoredNotes) {
    return `${detail} Showing the notes from this visit.`;
  }
  return `${detail} Save stays off until the saved notes load.`;
}

export function saveFailureMessage(error: string): string {
  const detail = error.trim() || "Could not save notes.";
  return detail.endsWith("Your text is still here.") ? detail : `${detail} Your text is still here.`;
}

/** Apply a load result. A failed load never replaces the draft. */
export function memberNotesFeedbackAfterLoad(input: {
  draft: string;
  previousStored: string | null;
  result: MemberNotesLoadResult;
}): MemberNotesFeedback {
  if (!input.result.ok) {
    return {
      draft: input.draft,
      stored: input.previousStored,
      canSave: input.previousStored !== null,
      tone: "error",
      message: loadErrorMessage(input.result.error, input.previousStored !== null),
    };
  }
  const notes = memberNotesFromProject({ memberNotes: input.result.notes });
  return {
    draft: notes,
    stored: notes,
    canSave: true,
    tone: "neutral",
    message: "",
  };
}

/**
 * Apply a save result. Failure keeps the current draft, including text typed
 * after the save started.
 */
export function memberNotesFeedbackAfterSave(input: {
  draftAtSave: string;
  draftNow: string;
  previousStored: string | null;
  result: MemberNotesLoadResult;
}): MemberNotesFeedback {
  if (!input.result.ok) {
    return {
      draft: input.draftNow,
      stored: input.previousStored,
      canSave: input.previousStored !== null,
      tone: "error",
      message: saveFailureMessage(input.result.error),
    };
  }
  const notes = memberNotesFromProject({ memberNotes: input.result.notes });
  const keptTyping = input.draftNow !== input.draftAtSave;
  return {
    draft: keptTyping ? input.draftNow : notes,
    stored: notes,
    canSave: true,
    tone: "saved",
    message: "Saved.",
  };
}
