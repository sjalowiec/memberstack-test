/**
 * Editable pattern name + project notes on unified sleeveless review (`/patterns/sleeveless/review`).
 */

import { canCustomizePattern } from "../lib/patterns/sleevelessPatternAccessGate";
import {
  formatPatternProjectNotesPreview,
  getPatternProjectMeta,
  PROJECT_NOTES_MAX_LENGTH,
  refreshAutoPatternProjectTitle,
  savePatternProjectMeta,
  SLEEVELESS_REVIEW_CONTEXT_READY_EVENT,
  type SleevelessPatternProjectMeta,
  type SleevelessPatternTitleContext,
} from "../lib/patterns/sleevelessPatternProjectMeta";

const DEFAULT_READ_ONLY_TITLE = "Sleeveless Sweater";

/** Display title for free/quick users (custom or auto-generated). */
export function readOnlyPatternTitleFromMeta(
  meta: Pick<SleevelessPatternProjectMeta, "title">,
  fallback = DEFAULT_READ_ONLY_TITLE,
): string {
  return meta.title.trim() || fallback;
}

/** When false, hide the entire notes block on the unified review page. */
export function shouldShowReadOnlyProjectNotes(notes: string): boolean {
  return notes.trim().length > 0;
}

const NOTES_SAVED_FLASH_MS = 2200;

function getHeaderRoot(): HTMLElement | null {
  const el = document.querySelector("[data-sleeveless-review-project-header]");
  return el instanceof HTMLElement ? el : null;
}

type NotesUiMode = "empty" | "collapsed" | "expanded";

function setNotesUiMode(root: HTMLElement, mode: NotesUiMode, notes = ""): void {
  const addBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-add]");
  const collapsed = root.querySelector("[data-sleeveless-pattern-project-notes-collapsed]");
  const panel = root.querySelector("[data-sleeveless-pattern-project-notes-panel]");
  const preview = root.querySelector("[data-sleeveless-pattern-project-notes-preview]");
  const editBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-edit]");

  const hasNotes = notes.trim().length > 0;
  const resolved: NotesUiMode = mode === "empty" && hasNotes ? "collapsed" : mode;

  if (addBtn) {
    addBtn.hidden = resolved !== "empty";
    addBtn.setAttribute("aria-expanded", resolved === "expanded" ? "true" : "false");
  }
  if (collapsed instanceof HTMLElement) {
    collapsed.hidden = resolved !== "collapsed";
  }
  if (panel instanceof HTMLElement) {
    panel.hidden = resolved !== "expanded";
  }
  if (preview instanceof HTMLElement) {
    const line = formatPatternProjectNotesPreview(notes);
    preview.textContent = line;
    if (line) preview.setAttribute("title", line);
    else preview.removeAttribute("title");
  }
  if (editBtn) editBtn.setAttribute("aria-expanded", resolved === "expanded" ? "true" : "false");
}

function updateNotesCharCount(root: HTMLElement, len: number): void {
  const counter = root.querySelector("[data-sleeveless-pattern-project-notes-count]");
  if (counter instanceof HTMLElement) {
    counter.textContent = `${len} / ${PROJECT_NOTES_MAX_LENGTH}`;
  }
}

function hideNotesSavedStatus(root: HTMLElement): void {
  const saved = root.querySelector("[data-sleeveless-pattern-project-notes-saved]");
  if (saved instanceof HTMLElement) saved.hidden = true;
}

function flashNotesSavedStatus(root: HTMLElement): void {
  const saved = root.querySelector("[data-sleeveless-pattern-project-notes-saved]");
  if (!(saved instanceof HTMLElement)) return;
  saved.hidden = false;
  window.setTimeout(() => {
    if (saved.isConnected) saved.hidden = true;
  }, NOTES_SAVED_FLASH_MS);
}

function normalizeNotesInput(notesInput: HTMLTextAreaElement): string {
  const notes = notesInput.value.slice(0, PROJECT_NOTES_MAX_LENGTH);
  if (notes !== notesInput.value) notesInput.value = notes;
  return notes;
}

function replaceTitleLabelWithHeading(nameBlock: Element): void {
  const label = nameBlock.querySelector("label");
  if (!(label instanceof HTMLElement)) return;

  label.querySelector(".sleeveless-review-project-header__edit-icon")?.remove();

  const heading = document.createElement("p");
  heading.className = "sleeveless-review-project-header__label";
  heading.textContent = label.querySelector("span")?.textContent?.trim() || "Pattern name";
  label.replaceWith(heading);
}

function applyReadOnlyProjectHeader(root: HTMLElement): void {
  root.classList.add("sleeveless-review-project-header--read-only");

  const nameBlock = root.querySelector(".sleeveless-review-project-header__name");
  const titleInput = root.querySelector<HTMLInputElement>("[data-sleeveless-pattern-project-title]");
  const notesBlock = root.querySelector(".sleeveless-review-project-header__notes");

  refreshAutoPatternProjectTitle();
  const meta = getPatternProjectMeta();
  const title = readOnlyPatternTitleFromMeta(meta);

  if (nameBlock) replaceTitleLabelWithHeading(nameBlock);

  if (titleInput && nameBlock) {
    const display = document.createElement("p");
    display.className = "sleeveless-review-project-header__title-display";
    display.setAttribute("data-sleeveless-pattern-project-title-display", "");
    display.textContent = title;
    titleInput.replaceWith(display);
  }

  const notes = meta.notes;
  const notesReadonly = root.querySelector("[data-sleeveless-pattern-project-notes-readonly]");
  const notesDisplay = root.querySelector("[data-sleeveless-pattern-project-notes-display]");
  if (shouldShowReadOnlyProjectNotes(notes) && notesReadonly instanceof HTMLElement && notesDisplay instanceof HTMLElement) {
    notesDisplay.textContent = notes;
    notesReadonly.removeAttribute("hidden");
  } else {
    notesBlock?.setAttribute("hidden", "");
  }

  document.addEventListener(SLEEVELESS_REVIEW_CONTEXT_READY_EVENT, (ev) => {
    const detail =
      ev instanceof CustomEvent && ev.detail && typeof ev.detail === "object"
        ? (ev.detail as SleevelessPatternTitleContext)
        : undefined;
    const refreshed = refreshAutoPatternProjectTitle(detail);
    const display = root.querySelector("[data-sleeveless-pattern-project-title-display]");
    if (display instanceof HTMLElement && !refreshed.titleCustomized) {
      display.textContent = readOnlyPatternTitleFromMeta(refreshed);
    }
  });
}

function bindEditableHeader(root: HTMLElement): void {
  const titleInput = root.querySelector<HTMLInputElement>("[data-sleeveless-pattern-project-title]");
  const notesInput = root.querySelector<HTMLTextAreaElement>("[data-sleeveless-pattern-project-notes]");
  const addBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-add]");
  const editBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-edit]");
  const saveBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-save]");
  const cancelBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-cancel]");

  let notesEditBaseline = "";

  const beginNotesEdit = (): void => {
    notesEditBaseline = getPatternProjectMeta().notes;
    hideNotesSavedStatus(root);
    setNotesUiMode(root, "expanded", notesInput?.value ?? notesEditBaseline);
    notesInput?.focus();
  };

  const finishNotesEdit = (notes: string, showSaved = false): void => {
    if (showSaved) flashNotesSavedStatus(root);
    setNotesUiMode(root, notes.trim() ? "collapsed" : "empty", notes);
  };

  const persistNotesFromInput = (): string => {
    if (!notesInput) return "";
    const notes = normalizeNotesInput(notesInput);
    updateNotesCharCount(root, notes.length);
    savePatternProjectMeta({ notes });
    return notes;
  };

  const applyMetaToFields = (): void => {
    const meta = getPatternProjectMeta();
    if (titleInput) titleInput.value = meta.title;
    if (notesInput) {
      notesInput.value = meta.notes;
      updateNotesCharCount(root, meta.notes.length);
    }
    setNotesUiMode(root, meta.notes.trim() ? "collapsed" : "empty", meta.notes);
  };

  applyMetaToFields();
  refreshAutoPatternProjectTitle();
  if (titleInput && !titleInput.value.trim()) {
    titleInput.value = getPatternProjectMeta().title;
  }

  titleInput?.addEventListener("input", () => {
    savePatternProjectMeta({
      title: titleInput.value,
      titleCustomized: true,
    });
  });

  titleInput?.addEventListener("blur", () => {
    const trimmed = titleInput.value.trim();
    if (trimmed !== titleInput.value) titleInput.value = trimmed;
    savePatternProjectMeta({
      title: trimmed,
      titleCustomized: true,
    });
  });

  addBtn?.addEventListener("click", beginNotesEdit);
  editBtn?.addEventListener("click", beginNotesEdit);

  saveBtn?.addEventListener("click", () => {
    if (!notesInput) return;
    const notes = persistNotesFromInput();
    finishNotesEdit(notes, true);
  });

  cancelBtn?.addEventListener("click", () => {
    if (!notesInput) return;
    notesInput.value = notesEditBaseline;
    updateNotesCharCount(root, notesEditBaseline.length);
    savePatternProjectMeta({ notes: notesEditBaseline });
    hideNotesSavedStatus(root);
    finishNotesEdit(notesEditBaseline, false);
  });

  notesInput?.addEventListener("input", () => {
    if (!notesInput) return;
    hideNotesSavedStatus(root);
    const notes = normalizeNotesInput(notesInput);
    updateNotesCharCount(root, notes.length);
    savePatternProjectMeta({ notes });
  });

  document.addEventListener(SLEEVELESS_REVIEW_CONTEXT_READY_EVENT, (ev) => {
    const detail =
      ev instanceof CustomEvent && ev.detail && typeof ev.detail === "object"
        ? (ev.detail as SleevelessPatternTitleContext)
        : undefined;
    const meta = refreshAutoPatternProjectTitle(detail);
    if (titleInput && !meta.titleCustomized) {
      titleInput.value = meta.title;
    }
    if (notesInput) {
      updateNotesCharCount(root, meta.notes.length);
      const panel = root.querySelector("[data-sleeveless-pattern-project-notes-panel]");
      const expanded = panel instanceof HTMLElement && !panel.hidden;
      setNotesUiMode(
        root,
        meta.notes.trim() ? (expanded ? "expanded" : "collapsed") : "empty",
        meta.notes,
      );
    }
  });
}

export function initSleevelessReviewProjectHeader(): void {
  const root = getHeaderRoot();
  if (!root) return;

  if (canCustomizePattern()) {
    bindEditableHeader(root);
  } else {
    applyReadOnlyProjectHeader(root);
  }
}

if (typeof document !== "undefined") {
  const boot = (): void => initSleevelessReviewProjectHeader();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
