/**
 * Optional print personalization (modal → sessionStorage → print-only title/notes slots).
 * Not part of builder/pattern data — session scope only.
 */

const STORAGE_TITLE_KEY = "kbm-pattern-print-personalization-title";
const STORAGE_NOTES_KEY = "kbm-pattern-print-personalization-notes";

const PROJECT_NOTES_MAX_LENGTH = 300;

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

function loadFieldsFromSession(dialog: HTMLDialogElement): void {
  const { titleInput, notesInput } = getFields(dialog);
  try {
    const t = sessionStorage.getItem(STORAGE_TITLE_KEY) ?? "";
    let n = sessionStorage.getItem(STORAGE_NOTES_KEY) ?? "";
    const truncated = truncateProjectNotes(n);
    if (truncated !== n) {
      try {
        sessionStorage.setItem(STORAGE_NOTES_KEY, truncated);
      } catch {
        /* ignore */
      }
      n = truncated;
    }
    if (titleInput) titleInput.value = t;
    if (notesInput) notesInput.value = truncated;
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

/** Restores title/notes slots from sessionStorage (e.g. after navigation or dynamic print HTML inject). */
export function hydratePatternPrintPersonalizationSlotsFromSession(): void {
  try {
    const t = sessionStorage.getItem(STORAGE_TITLE_KEY) ?? "";
    const rawNotes = sessionStorage.getItem(STORAGE_NOTES_KEY) ?? "";
    const n = truncateProjectNotes(rawNotes);
    if (n !== rawNotes) {
      try {
        sessionStorage.setItem(STORAGE_NOTES_KEY, n);
      } catch {
        /* ignore */
      }
    }
    applyPatternPrintPersonalizationToDom(t, n);
  } catch {
    /* ignore */
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    hydratePatternPrintPersonalizationSlotsFromSession();
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
    try {
      opts?.onBeforePrint?.();
      window.print();
    } finally {
      opts?.onAfterPrint?.();
    }
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
    try {
      opts?.onBeforePrint?.();
      window.print();
    } finally {
      opts?.onAfterPrint?.();
    }
  });

  /** Escape closes without printing — drop deferred callbacks. */
  dialog.addEventListener("cancel", () => {
    pendingOpts = undefined;
  });
}

/**
 * Opens the optional modal when present; otherwise prints immediately.
 */
export function triggerPatternPrint(
  triggerEl: HTMLElement | null,
  opts?: PatternPrintTriggerOptions,
): void {
  bindModalListenersOnce();
  const dialog = getDialog();

  if (!dialog || typeof dialog.showModal !== "function") {
    opts?.onBeforePrint?.();
    try {
      window.print();
    } finally {
      opts?.onAfterPrint?.();
    }
    return;
  }

  lastTrigger = triggerEl;
  pendingOpts = opts;
  loadFieldsFromSession(dialog);

  try {
    dialog.showModal();
  } catch {
    opts?.onBeforePrint?.();
    try {
      window.print();
    } finally {
      opts?.onAfterPrint?.();
    }
    return;
  }

  const { titleInput } = getFields(dialog);
  window.requestAnimationFrame(() => {
    titleInput?.focus();
  });
}
