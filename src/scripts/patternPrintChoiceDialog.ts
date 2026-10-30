/**
 * Print-pattern choice dialog. Confirming still uses window.print() so the
 * knitter can print or save a PDF.
 */

import {
  PATTERN_PRINT_CHOICE_PDF_NOTE,
  PATTERN_PRINT_CHOICE_REMINDER,
  PATTERN_PRINT_CHOICES,
  type PatternPrintChoice,
} from "../lib/patterns/patternPrintChoice";

const DIALOG_ID = "pattern-print-choice-dialog";

function dialogHtml(): string {
  const options = PATTERN_PRINT_CHOICES.map((choice) => {
    const checked = choice.id === "both" ? " checked" : "";
    return `<label class="pattern-print-choice-dialog__option">
      <input type="radio" name="pattern-print-choice" value="${choice.id}"${checked} />
      <span>
        <span class="pattern-print-choice-dialog__option-title">${choice.title}</span>
        <span class="pattern-print-choice-dialog__option-text">${choice.explanation}</span>
      </span>
    </label>`;
  }).join("");
  return `<form class="pattern-print-choice-dialog__panel" method="dialog">
    <h2 id="pattern-print-choice-title" class="pattern-print-choice-dialog__heading">Print pattern</h2>
    <p class="pattern-print-choice-dialog__lead">${PATTERN_PRINT_CHOICE_PDF_NOTE}</p>
    <div class="pattern-print-choice-dialog__options" role="radiogroup" aria-label="What to print">${options}</div>
    <p class="pattern-print-choice-dialog__reminder">${PATTERN_PRINT_CHOICE_REMINDER}</p>
    <div class="pattern-print-choice-dialog__actions">
      <button type="button" class="pattern-print-choice-dialog__btn" data-pattern-print-choice-cancel>Cancel</button>
      <button type="submit" class="pattern-print-choice-dialog__btn pattern-print-choice-dialog__btn--primary" data-pattern-print-choice-confirm>Print</button>
    </div>
  </form>`;
}

function ensureDialog(): HTMLDialogElement | null {
  const existing = document.getElementById(DIALOG_ID);
  if (existing instanceof HTMLDialogElement) return existing;
  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "pattern-print-choice-dialog no-print";
  dialog.setAttribute("aria-labelledby", "pattern-print-choice-title");
  dialog.innerHTML = dialogHtml();
  document.body.append(dialog);
  return dialog;
}

function selectedChoice(dialog: HTMLDialogElement): PatternPrintChoice {
  const selected = dialog.querySelector<HTMLInputElement>('input[name="pattern-print-choice"]:checked');
  const value = selected?.value;
  if (value === "instructions" || value === "charts" || value === "both") return value;
  return "both";
}

/**
 * Resolves with the knitter's choice, or null when they cancel.
 * Falls through to the full instructions-plus-charts print when the dialog cannot open.
 */
export function openPatternPrintChoiceDialog(triggerEl: HTMLElement | null): Promise<PatternPrintChoice | null> {
  const dialog = ensureDialog();
  if (!dialog || typeof dialog.showModal !== "function") {
    return Promise.resolve("both");
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (choice: PatternPrintChoice | null) => {
      if (settled) return;
      settled = true;
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("cancel", onCancel);
      confirmBtn?.removeEventListener("click", onConfirm);
      cancelBtn?.removeEventListener("click", onCancelClick);
      if (dialog.open) dialog.close();
      triggerEl?.focus?.();
      resolve(choice);
    };
    const onConfirm = (event: Event) => {
      event.preventDefault();
      finish(selectedChoice(dialog));
    };
    const onCancelClick = (event: Event) => {
      event.preventDefault();
      finish(null);
    };
    const onCancel = () => finish(null);
    const onClose = () => finish(null);
    const confirmBtn = dialog.querySelector("[data-pattern-print-choice-confirm]");
    const cancelBtn = dialog.querySelector("[data-pattern-print-choice-cancel]");
    confirmBtn?.addEventListener("click", onConfirm);
    cancelBtn?.addEventListener("click", onCancelClick);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    try {
      dialog.showModal();
    } catch {
      finish("both");
      return;
    }
    window.requestAnimationFrame(() => {
      dialog.querySelector<HTMLInputElement>('input[name="pattern-print-choice"]:checked')?.focus();
    });
  });
}
