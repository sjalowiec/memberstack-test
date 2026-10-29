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
