/**
 * Brief success dialog after the first free pattern is auto-saved.
 * Keeps the knitter in the pattern workflow with optional My Patterns drawer access.
 */
import {
  patternSystemDisplayName,
  type PatternSystemId,
} from "./patternSystemId";
import { buildAutoSaveSuccessMessage } from "./patternAutoSaveFirstFree";

export const PATTERN_AUTO_SAVE_SUCCESS_DIALOG_SELECTOR = "[data-pattern-auto-save-success-dialog]";
export const PATTERN_AUTO_SAVE_SUCCESS_MESSAGE_SELECTOR =
  "[data-pattern-auto-save-success-message]";
export const PATTERN_AUTO_SAVE_OPEN_LIBRARY_SELECTOR = "[data-pattern-auto-save-open-library]";
export const PATTERN_AUTO_SAVE_CONTINUE_SELECTOR = "[data-pattern-auto-save-continue]";

const BOUND_ATTR = "data-pattern-auto-save-success-bound";

export type PatternAutoSaveSuccessDialogOptions = {
  patternSystem: PatternSystemId;
  projectName?: string;
  root?: ParentNode;
  /** Called when "Open My Patterns" is chosen - wire to library drawer opener. */
  onOpenLibrary?: () => void;
};

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

function getDialog(root?: ParentNode): HTMLDialogElement | null {
  if (typeof document === "undefined") return null;
  const scopes: ParentNode[] = [];
  if (root && typeof root.querySelector === "function") scopes.push(root);
  if (typeof document.querySelector === "function") scopes.push(document);
  for (const scope of scopes) {
    const el = scope.querySelector(PATTERN_AUTO_SAVE_SUCCESS_DIALOG_SELECTOR);
    if (isDialogElement(el)) return el;
  }
  return null;
}

/** Wire dismiss / action controls once per dialog instance. */
export function initPatternAutoSaveSuccessDialog(root: ParentNode = document): void {
  const dialog = getDialog(root);
  if (!dialog || dialog.getAttribute(BOUND_ATTR) === "true") return;
  dialog.setAttribute(BOUND_ATTR, "true");

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  dialog.querySelectorAll(PATTERN_AUTO_SAVE_CONTINUE_SELECTOR).forEach((el) => {
    el.addEventListener("click", close);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
}

/** Shows the auto-save success dialog. Returns true when shown. */
export function showPatternAutoSaveSuccessDialog(
  options: PatternAutoSaveSuccessDialogOptions,
): boolean {
  const dialog = getDialog(options.root);
  if (!dialog || typeof dialog.showModal !== "function") return false;

  const messageEl = dialog.querySelector(PATTERN_AUTO_SAVE_SUCCESS_MESSAGE_SELECTOR);
  if (messageEl) {
    messageEl.textContent = buildAutoSaveSuccessMessage(options.patternSystem);
  }

  const openLibraryBtn = dialog.querySelector(PATTERN_AUTO_SAVE_OPEN_LIBRARY_SELECTOR);
  if (openLibraryBtn instanceof HTMLButtonElement) {
    openLibraryBtn.textContent = "Open My Patterns";
    openLibraryBtn.onclick = () => {
      dialog.close();
      options.onOpenLibrary?.();
      const trigger = document.querySelector<HTMLButtonElement>(
        "[data-pattern-workspace-library-trigger]",
      );
      trigger?.click();
    };
  }

  dialog.showModal();
  return true;
}

export { patternSystemDisplayName };
