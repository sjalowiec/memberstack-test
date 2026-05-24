/**
 * Editable pattern name + project notes on unified sleeveless review (`/patterns/sleeveless/review`).
 */

import { canCustomizePattern } from "../lib/patterns/sleevelessPatternAccessGate";
import { getCurrentPattern } from "../lib/patterns/patternStorage";
import { smartSaveCustomPatternProject } from "../lib/patterns/customPatternSavedProjectsPanel";
import {
  buildChangePatternChoicesHref,
  initChangePatternChoicesLinks,
  navigateToChangePatternChoices,
} from "../lib/patterns/restoreSleevelessExpressBuilderFromPattern";
import {
  getPatternProjectMeta,
  PROJECT_NOTES_MAX_LENGTH,
  refreshAutoPatternProjectTitle,
  savePatternProjectMeta,
  SLEEVELESS_REVIEW_CONTEXT_READY_EVENT,
  type SleevelessPatternProjectMeta,
  type SleevelessPatternTitleContext,
} from "../lib/patterns/sleevelessPatternProjectMeta";
import { consumeCustomizeProjectFieldHash } from "../lib/patterns/sleevelessCustomizeProjectFieldNav";

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
const FIELD_FOCUS_HIGHLIGHT_MS = 2200;

let beginNotesEditForFocus: (() => void) | null = null;

function flashCustomizeFieldHighlight(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.add("sleeveless-customize-field-highlight");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  window.setTimeout(() => {
    el.classList.remove("sleeveless-customize-field-highlight");
  }, FIELD_FOCUS_HIGHLIGHT_MS);
}

/** Scroll to and focus title or notes on the Customize (review) page. */
export function focusSleevelessCustomizeProjectField(target: "title" | "notes"): void {
  const root = getHeaderRoot();
  if (!root || !canCustomizePattern()) return;

  if (target === "title") {
    const titleInput = root.querySelector<HTMLInputElement>("[data-sleeveless-pattern-project-title]");
    const wrap = root.querySelector(".sleeveless-review-project-header__title-input-wrap");
    titleInput?.focus({ preventScroll: true });
    flashCustomizeFieldHighlight(
      wrap instanceof HTMLElement ? wrap : titleInput instanceof HTMLElement ? titleInput : null,
    );
    return;
  }

  beginNotesEditForFocus?.();
  const panel = root.querySelector("[data-sleeveless-pattern-project-notes-panel]");
  const notesInput = root.querySelector<HTMLTextAreaElement>("[data-sleeveless-pattern-project-notes]");
  notesInput?.focus({ preventScroll: true });
  flashCustomizeFieldHighlight(panel instanceof HTMLElement ? panel : notesInput);
}

function bindSectionHeadTrigger(el: HTMLElement | null, onActivate: () => void): void {
  if (!el) return;
  el.addEventListener("click", onActivate);
  el.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    onActivate();
  });
}

function stripSectionHeadTrigger(el: HTMLElement | null): void {
  if (!el) return;
  el.removeAttribute("role");
  el.removeAttribute("tabindex");
  el.removeAttribute("title");
  el.removeAttribute("aria-label");
  el.removeAttribute("aria-expanded");
}

function getHeaderRoot(): HTMLElement | null {
  const el = document.querySelector("[data-sleeveless-review-project-header]");
  return el instanceof HTMLElement ? el : null;
}

type NotesUiMode = "empty" | "view" | "edit";

function setNotesUiMode(root: HTMLElement, mode: NotesUiMode, notes = ""): void {
  const notesHeader = root.querySelector<HTMLElement>("[data-sleeveless-pattern-project-notes-header]");
  const viewBlock = root.querySelector("[data-sleeveless-pattern-project-notes-view]");
  const panel = root.querySelector("[data-sleeveless-pattern-project-notes-panel]");
  const staticText = root.querySelector("[data-sleeveless-pattern-project-notes-static]");

  const hasNotes = notes.trim().length > 0;
  let resolved: NotesUiMode = mode;
  if (mode === "empty" && hasNotes) resolved = "view";
  if (mode === "view" && !hasNotes) resolved = "empty";

  if (notesHeader instanceof HTMLElement) {
    notesHeader.hidden = resolved === "edit";
  }
  if (viewBlock instanceof HTMLElement) {
    viewBlock.hidden = resolved !== "view";
  }
  if (panel instanceof HTMLElement) {
    panel.hidden = resolved !== "edit";
  }
  if (staticText instanceof HTMLElement) {
    staticText.textContent = notes;
  }
  if (notesHeader) {
    notesHeader.setAttribute("aria-expanded", resolved === "edit" ? "true" : "false");
  }
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

function setCloudSaveStatus(root: HTMLElement, message: string, isError = false): void {
  const el = root.querySelector("[data-cb-project-status]");
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.classList.toggle("cb-project-status--error", isError);
}

function persistTitleFromInput(titleInput: HTMLInputElement | null): string {
  if (!titleInput) return "";
  const trimmed = titleInput.value.trim();
  if (trimmed !== titleInput.value) titleInput.value = trimmed;
  savePatternProjectMeta({
    title: trimmed,
    titleCustomized: true,
  });
  return trimmed;
}

function applyReadOnlyProjectHeader(root: HTMLElement): void {
  root.classList.add("sleeveless-review-project-header--read-only");

  const notesBlock = root.querySelector(".sleeveless-review-project-header__notes");

  refreshAutoPatternProjectTitle();
  const meta = getPatternProjectMeta();
  const title = readOnlyPatternTitleFromMeta(meta);

  const display = root.querySelector("[data-sleeveless-pattern-project-title-display]");
  if (display instanceof HTMLElement) {
    display.textContent = title;
  }

  stripSectionHeadTrigger(root.querySelector("[data-sleeveless-pattern-project-notes-header]"));

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
  const cloudSaveBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-cloud-save]");
  const notesInput = root.querySelector<HTMLTextAreaElement>("[data-sleeveless-pattern-project-notes]");
  const notesEditTrigger = root.querySelector<HTMLElement>("[data-sleeveless-pattern-project-notes-edit]");
  const saveBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-save]");
  const cancelBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-cancel]");
  const deleteBtn = root.querySelector<HTMLButtonElement>("[data-sleeveless-pattern-project-notes-delete]");

  let notesEditBaseline = "";

  const applyTitleToInput = (): void => {
    refreshAutoPatternProjectTitle();
    const meta = getPatternProjectMeta();
    const displayTitle = readOnlyPatternTitleFromMeta(meta);
    if (titleInput) titleInput.value = displayTitle;
  };

  const applyMetaToFields = (): void => {
    const meta = getPatternProjectMeta();
    applyTitleToInput();
    if (notesInput) {
      notesInput.value = meta.notes;
      updateNotesCharCount(root, meta.notes.length);
    }
    setNotesUiMode(root, meta.notes.trim() ? "view" : "empty", meta.notes);
  };

  applyMetaToFields();

  titleInput?.addEventListener("blur", () => {
    if (!titleInput?.value.trim()) return;
    persistTitleFromInput(titleInput);
  });

  cloudSaveBtn?.addEventListener("click", async () => {
    const name = persistTitleFromInput(titleInput);
    if (!name) {
      setCloudSaveStatus(root, "Enter a pattern name before saving.", true);
      titleInput?.focus();
      return;
    }
    cloudSaveBtn.disabled = true;
    const res = await smartSaveCustomPatternProject({
      resolveName: () => name,
      onStatus: (message, isError) => setCloudSaveStatus(root, message, isError),
    });
    cloudSaveBtn.disabled = false;
    if (!res.ok) {
      setCloudSaveStatus(root, res.error, true);
      return;
    }
    if (titleInput) titleInput.value = res.project.name;
    persistTitleFromInput(titleInput);
    setCloudSaveStatus(
      root,
      res.created ? `Saved “${res.project.name}”.` : `Updated “${res.project.name}”.`,
    );
  });

  const beginNotesEdit = (): void => {
    notesEditBaseline = getPatternProjectMeta().notes;
    if (notesInput) {
      notesInput.value = notesEditBaseline;
      updateNotesCharCount(root, notesEditBaseline.length);
    }
    hideNotesSavedStatus(root);
    setNotesUiMode(root, "edit", notesEditBaseline);
    notesInput?.focus();
  };

  const finishNotesEdit = (notes: string, showSaved = false): void => {
    if (showSaved) flashNotesSavedStatus(root);
    setNotesUiMode(root, notes.trim() ? "view" : "empty", notes);
  };

  const persistNotesFromInput = (): string => {
    if (!notesInput) return "";
    const notes = normalizeNotesInput(notesInput);
    updateNotesCharCount(root, notes.length);
    savePatternProjectMeta({ notes });
    return notes;
  };

  beginNotesEditForFocus = beginNotesEdit;
  bindSectionHeadTrigger(notesEditTrigger, beginNotesEdit);

  saveBtn?.addEventListener("click", () => {
    if (!notesInput) return;
    const notes = persistNotesFromInput();
    finishNotesEdit(notes, true);
  });

  cancelBtn?.addEventListener("click", () => {
    if (!notesInput) return;
    notesInput.value = notesEditBaseline;
    updateNotesCharCount(root, notesEditBaseline.length);
    hideNotesSavedStatus(root);
    finishNotesEdit(notesEditBaseline, false);
  });

  deleteBtn?.addEventListener("click", () => {
    if (!notesInput) return;
    notesInput.value = "";
    updateNotesCharCount(root, 0);
    savePatternProjectMeta({ notes: "" });
    hideNotesSavedStatus(root);
    finishNotesEdit("", false);
  });

  notesInput?.addEventListener("input", () => {
    if (!notesInput) return;
    hideNotesSavedStatus(root);
    const notes = normalizeNotesInput(notesInput);
    updateNotesCharCount(root, notes.length);
  });

  document.addEventListener(SLEEVELESS_REVIEW_CONTEXT_READY_EVENT, (ev) => {
    const detail =
      ev instanceof CustomEvent && ev.detail && typeof ev.detail === "object"
        ? (ev.detail as SleevelessPatternTitleContext)
        : undefined;
    const meta = refreshAutoPatternProjectTitle(detail);
    const displayTitle = readOnlyPatternTitleFromMeta(meta);
    if (titleInput && !meta.titleCustomized) {
      titleInput.value = displayTitle;
    }
    if (notesInput) {
      notesInput.value = meta.notes;
      updateNotesCharCount(root, meta.notes.length);
      const panel = root.querySelector("[data-sleeveless-pattern-project-notes-panel]");
      const editing = panel instanceof HTMLElement && !panel.hidden;
      setNotesUiMode(
        root,
        meta.notes.trim() ? (editing ? "edit" : "view") : editing ? "edit" : "empty",
        meta.notes,
      );
    }
  });
}

function initSleevelessReviewSummaryEdit(): void {
  const row = document.querySelector<HTMLElement>("[data-sleeveless-review-summary-edit]");
  if (!row) return;
  const mode = getCurrentPattern().style?.patternMode;
  const source = mode === "express" ? "express" : "custom-build";
  const href = buildChangePatternChoicesHref(source);
  row.setAttribute("data-href", href);
  row.setAttribute("title", "Change pattern choices");
  row.setAttribute("aria-label", "Change pattern choices");
  bindSectionHeadTrigger(row, () => {
    navigateToChangePatternChoices(href);
  });
}

function applyCustomizeFieldFocusFromNavigation(): void {
  const target = consumeCustomizeProjectFieldHash();
  if (!target) return;
  window.requestAnimationFrame(() => {
    window.setTimeout(() => focusSleevelessCustomizeProjectField(target), 80);
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

  initSleevelessReviewSummaryEdit();
  initChangePatternChoicesLinks();
  applyCustomizeFieldFocusFromNavigation();
}

if (typeof document !== "undefined") {
  const boot = (): void => initSleevelessReviewProjectHeader();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
