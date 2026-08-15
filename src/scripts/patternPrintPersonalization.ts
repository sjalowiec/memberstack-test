/**
 * Print personalization: sleeveless uses `kbm_current_pattern.patternProject`;
 * hat pages use the hat print title (not sweater working-draft metadata);
 * other patterns may still use session keys + optional modal.
 */

import {
  isHatPatternPrintPage,
  resolvePatternPrintPersonalizationFields,
} from "../lib/patterns/patternPrintPersonalizationFields";
import { syncPatternTipDismissBeforePrint } from "../lib/patterns/patternTipDismiss";
import {
  getPatternProjectPrintFields,
  migrateLegacyPrintSessionToPatternProject,
  PROJECT_NOTES_MAX_LENGTH,
  resolvePatternPrintDocumentTitle,
  syncPatternProjectToPrintSession,
} from "../lib/patterns/sleevelessPatternProjectMeta";

/** Ensures Ctrl+P / system print also suggest the user pattern name as the PDF filename. */
function syncDocumentTitleForNativePrint(): void {
  if (!document.querySelector("[data-pattern-print-skip-modal]")) return;
  const { title } = readStoredPrintPersonalization();
  const resolved = resolvePatternPrintDocumentTitle(title, document.title);
  if (!resolved || resolved === document.title) return;

  const originalTitle = document.title;
  document.title = resolved;
  const restore = (): void => {
    window.removeEventListener("afterprint", restore);
    if (document.title === resolved) {
      document.title = originalTitle;
    }
  };
  window.addEventListener("afterprint", restore);
  window.setTimeout(restore, 60_000);
}

const STORAGE_TITLE_KEY = "kbm-pattern-print-personalization-title";
const STORAGE_NOTES_KEY = "kbm-pattern-print-personalization-notes";

function truncateProjectNotes(notes: string): string {
  return notes.length <= PROJECT_NOTES_MAX_LENGTH
    ? notes
    : notes.slice(0, PROJECT_NOTES_MAX_LENGTH);
}

export interface PatternPrintTriggerOptions {
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

let listenersBound = false;
let lastTrigger: HTMLElement | null = null;
let pendingOpts: PatternPrintTriggerOptions | undefined;

function getDialog(): HTMLDialogElement | null {
  const el = document.getElementById("pattern-print-personalization-modal");
  return el instanceof HTMLDialogElement ? el : null;
}

function getFields(dialog: HTMLDialogElement): {
  titleInput: HTMLInputElement | null;
  notesInput: HTMLTextAreaElement | null;
  skipBtn: HTMLButtonElement | null;
  addBtn: HTMLButtonElement | null;
} {
  return {
    titleInput: dialog.querySelector("#pattern-print-personalization-title"),
    notesInput: dialog.querySelector("#pattern-print-personalization-notes"),
    skipBtn: dialog.querySelector('[data-pattern-print-personalization-skip]'),
    addBtn: dialog.querySelector('[data-pattern-print-personalization-add]'),
  };
}

function updateProjectNotesCharCount(dialog: HTMLDialogElement): void {
  const { notesInput } = getFields(dialog);
  const counter = dialog.querySelector(".pattern-print-personalization-char-count");
  if (!counter || !(notesInput instanceof HTMLTextAreaElement)) return;
  const len = notesInput.value.length;
  counter.textContent = `${len} / ${PROJECT_NOTES_MAX_LENGTH}`;
}

function readStoredPrintPersonalization(): { title: string; notes: string } {
  if (isHatPatternPrintPage(document)) {
    return resolvePatternPrintPersonalizationFields({
      isHatPatternPage: true,
      sleevelessFields: { title: "", notes: "" },
    });
  }
  migrateLegacyPrintSessionToPatternProject();
  if (document.querySelector("[data-pattern-print-skip-modal]")) {
    const fromProject = getPatternProjectPrintFields();
    syncPatternProjectToPrintSession({
      title: fromProject.title,
      notes: fromProject.notes,
    });
    return resolvePatternPrintPersonalizationFields({
      isHatPatternPage: false,
      sleevelessFields: fromProject,
    });
  }
  try {
    const t = sessionStorage.getItem(STORAGE_TITLE_KEY) ?? "";
    const rawNotes = sessionStorage.getItem(STORAGE_NOTES_KEY) ?? "";
    return { title: t.trim(), notes: truncateProjectNotes(rawNotes) };
  } catch {
    return { title: "", notes: "" };
  }
}

function loadFieldsFromSession(dialog: HTMLDialogElement): void {
  const { titleInput, notesInput } = getFields(dialog);
  try {
    const { title: t, notes: n } = readStoredPrintPersonalization();
    if (titleInput) titleInput.value = t;
    if (notesInput) notesInput.value = n;
    updateProjectNotesCharCount(dialog);
  } catch {
    /* ignore */
  }
}

/**
 * Fills every `[data-pattern-print-personalization-title]` / `[data-pattern-print-personalization-notes]` node.
 * Empty strings hide the slot (`hidden`) so it takes no space on screen or in print.
 */
export function applyPatternPrintPersonalizationToDom(title: string, notes: string): void {
  const trimmedTitle = title.trim();
  const cappedNotes = truncateProjectNotes(notes);

  document.querySelectorAll("[data-pattern-print-personalization-title]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = trimmedTitle;
    if (trimmedTitle) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  });

  document.querySelectorAll("[data-pattern-print-personalization-notes]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = cappedNotes;
    if (cappedNotes.trim()) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  });
}

/** Restores title/notes slots from pattern project or session (e.g. after navigation or dynamic print HTML inject). */
export function hydratePatternPrintPersonalizationSlotsFromSession(): void {
  try {
    const { title, notes } = readStoredPrintPersonalization();
    applyPatternPrintPersonalizationToDom(title, notes);
  } catch {
    /* ignore */
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    hydratePatternPrintPersonalizationSlotsFromSession();
  });
  window.addEventListener("beforeprint", () => {
    syncDocumentTitleForNativePrint();
  });
}

function bindModalListenersOnce(): void {
  if (listenersBound) return;
  const dialog = getDialog();
  if (!dialog) return;

  listenersBound = true;
  const { skipBtn, addBtn, notesInput } = getFields(dialog);

  notesInput?.addEventListener("input", () => updateProjectNotesCharCount(dialog));

  dialog.addEventListener("close", () => {
    lastTrigger?.focus?.();
    lastTrigger = null;
  });

  skipBtn?.addEventListener("click", () => {
    applyPatternPrintPersonalizationToDom("", "");
    const opts = pendingOpts;
    pendingOpts = undefined;
    dialog.close();
    runPatternPrint(opts, "");
  });

  addBtn?.addEventListener("click", () => {
    const titleInput = dialog.querySelector("#pattern-print-personalization-title");
    const notesEl = dialog.querySelector("#pattern-print-personalization-notes");
    const title = titleInput instanceof HTMLInputElement ? titleInput.value : "";
    const notesRaw = notesEl instanceof HTMLTextAreaElement ? notesEl.value : "";
    const notes = truncateProjectNotes(notesRaw);
    try {
      sessionStorage.setItem(STORAGE_TITLE_KEY, title.trim());
      sessionStorage.setItem(STORAGE_NOTES_KEY, notes);
    } catch {
      /* ignore */
    }
    applyPatternPrintPersonalizationToDom(title, notes);
    const opts = pendingOpts;
    pendingOpts = undefined;
    dialog.close();
    runPatternPrint(opts, title.trim());
  });

  /** Escape closes without printing — drop deferred callbacks. */
  dialog.addEventListener("cancel", () => {
    pendingOpts = undefined;
  });
}

/**
 * Opens the optional modal when present; otherwise prints immediately.
 */
function shouldSkipPersonalizationModal(): boolean {
  return Boolean(document.querySelector("[data-pattern-print-skip-modal]"));
}

function syncAllPatternTipDismissBeforePrint(): void {
  document.querySelectorAll("[data-pattern-tip-dismiss-bound]").forEach((scope) => {
    const storageKey = scope.getAttribute("data-pattern-tip-dismiss-bound");
    if (storageKey) {
      syncPatternTipDismissBeforePrint(scope, storageKey);
    }
  });
}

/**
 * Runs window.print(), temporarily setting document.title from the pattern name so
 * browser Save-as-PDF suggests that filename.
 *
 * Important: `window.print()` returns immediately while the print dialog is still open.
 * Restoring `document.title` too early (e.g. a short timeout) makes Chrome/Edge suggest the
 * generic page title for every PDF. Restore only on `afterprint` (with a long fallback).
 *
 * Callers that already set document.title in onBeforePrint (e.g. diy-blanket) are left alone
 * until afterprint, then restored to the title captured at the start of this call.
 */
function runPatternPrint(opts?: PatternPrintTriggerOptions, printTitle = ""): void {
  syncAllPatternTipDismissBeforePrint();
  const originalTitle = document.title;
  let restoreScheduled = false;

  const restoreTitle = (): void => {
    if (!restoreScheduled) return;
    restoreScheduled = false;
    window.removeEventListener("afterprint", restoreTitle);
    if (document.title !== originalTitle) {
      document.title = originalTitle;
    }
  };

  try {
    opts?.onBeforePrint?.();
    if (document.title === originalTitle) {
      const resolved = resolvePatternPrintDocumentTitle(printTitle, originalTitle);
      if (resolved !== originalTitle) {
        document.title = resolved;
      }
    }
    if (document.title !== originalTitle) {
      restoreScheduled = true;
      window.addEventListener("afterprint", restoreTitle);
      // Some environments never fire afterprint; do not restore while the dialog may still be open.
      window.setTimeout(restoreTitle, 60_000);
    }
    window.print();
  } finally {
    opts?.onAfterPrint?.();
  }
}

export function triggerPatternPrint(
  triggerEl: HTMLElement | null,
  opts?: PatternPrintTriggerOptions,
): void {
  bindModalListenersOnce();
  const { title, notes } = readStoredPrintPersonalization();
  applyPatternPrintPersonalizationToDom(title, notes);

  if (shouldSkipPersonalizationModal()) {
    runPatternPrint(opts, title);
    return;
  }

  const dialog = getDialog();

  if (!dialog || typeof dialog.showModal !== "function") {
    runPatternPrint(opts, title);
    return;
  }

  lastTrigger = triggerEl;
  pendingOpts = opts;
  loadFieldsFromSession(dialog);

  try {
    dialog.showModal();
  } catch {
    runPatternPrint(opts, title);
    return;
  }

  const { titleInput } = getFields(dialog);
  window.requestAnimationFrame(() => {
    titleInput?.focus();
  });
}
