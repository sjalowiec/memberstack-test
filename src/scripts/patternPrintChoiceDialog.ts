/**
 * Print-pattern choice dialog. Confirming still uses window.print() so the
 * knitter can print or save a PDF.
 */

import {
  PATTERN_PRINT_CHOICE_PDF_NOTE,
  PATTERN_PRINT_CHOICE_REMINDER,
  PATTERN_PRINT_CHOICES,
  PATTERN_PRINT_HIDE_TIPS_HELP,
  PATTERN_PRINT_HIDE_TIPS_LABEL,
  PATTERN_PRINT_PAGE_RANGE_NOTE,
  PATTERN_PRINT_SELECTED_PAGES_HREF,
  PATTERN_PRINT_SELECTED_PAGES_LINK,
  type PatternPrintChoice,
  type PatternPrintSelection,
} from "../lib/patterns/patternPrintChoice";

const DIALOG_ID = "pattern-print-choice-dialog";
const DEFAULT_PATTERN_PRINT_CHOICE: PatternPrintChoice = "instructions";

function escapeDialogText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function dialogHtml(): string {
  const options = PATTERN_PRINT_CHOICES.map((choice) => {
    const checked = choice.id === DEFAULT_PATTERN_PRINT_CHOICE ? " checked" : "";
    return `<label class="pattern-print-choice-dialog__option">
      <input type="radio" name="pattern-print-choice" value="${choice.id}"${checked} />
      <span>
        <span class="pattern-print-choice-dialog__option-title">${escapeDialogText(choice.title)}</span>
        <span class="pattern-print-choice-dialog__option-text">${escapeDialogText(choice.explanation)}</span>
      </span>
    </label>`;
  }).join("");
  return `<form class="pattern-print-choice-dialog__panel" method="dialog">
    <h2 id="pattern-print-choice-title" class="pattern-print-choice-dialog__heading">Print pattern</h2>
    <p class="pattern-print-choice-dialog__lead">${PATTERN_PRINT_CHOICE_PDF_NOTE}</p>
    <div class="pattern-print-choice-dialog__options" role="radiogroup" aria-label="What to print">${options}</div>
    <label class="pattern-print-choice-dialog__tips">
      <input type="checkbox" name="pattern-print-hide-tips" data-pattern-print-hide-tips value="yes" checked />
      <span>
        <span class="pattern-print-choice-dialog__option-title">${PATTERN_PRINT_HIDE_TIPS_LABEL}</span>
        <span class="pattern-print-choice-dialog__option-text">${PATTERN_PRINT_HIDE_TIPS_HELP}</span>
      </span>
    </label>
    <p class="pattern-print-choice-dialog__page-range">${escapeDialogText(PATTERN_PRINT_PAGE_RANGE_NOTE)} <a class="pattern-print-choice-dialog__page-range-link" href="${PATTERN_PRINT_SELECTED_PAGES_HREF}" target="_blank" rel="noopener noreferrer" data-pattern-print-selected-pages>${escapeDialogText(PATTERN_PRINT_SELECTED_PAGES_LINK)}</a></p>
    <p class="pattern-print-choice-dialog__reminder">${PATTERN_PRINT_CHOICE_REMINDER}</p>
    <div class="pattern-print-choice-dialog__actions">
      <button type="button" class="pattern-print-choice-dialog__btn" data-pattern-print-choice-cancel>Cancel</button>
      <button type="submit" class="pattern-print-choice-dialog__btn pattern-print-choice-dialog__btn--primary" data-pattern-print-choice-confirm>Print</button>
    </div>
  </form>`;
}

function ensureDialog(): HTMLDialogElement | null {
  const existing = document.getElementById(DIALOG_ID);
  if (existing instanceof HTMLDialogElement) {
    if (
      existing.querySelector("[data-pattern-print-hide-tips]") &&
      existing.querySelector("[data-pattern-print-selected-pages]")
    ) {
      return existing;
    }
    existing.remove();
  }
  const dialog = document.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "pattern-print-choice-dialog no-print";
  dialog.setAttribute("aria-labelledby", "pattern-print-choice-title");
  dialog.innerHTML = dialogHtml();
  document.body.append(dialog);
  return dialog;
}

/** Every open starts on Instructions only, with Pattern Tips hidden. */
function resetDialogDefaults(dialog: HTMLDialogElement): void {
  for (const input of dialog.querySelectorAll<HTMLInputElement>('input[name="pattern-print-choice"]')) {
    input.checked = input.value === DEFAULT_PATTERN_PRINT_CHOICE;
  }
  const hideTips = dialog.querySelector<HTMLInputElement>("[data-pattern-print-hide-tips]");
  if (hideTips) hideTips.checked = true;
}

function selectedChoice(dialog: HTMLDialogElement): PatternPrintChoice {
  const selected = dialog.querySelector<HTMLInputElement>('input[name="pattern-print-choice"]:checked');
  const value = selected?.value;
  if (value === "instructions" || value === "charts" || value === "both") return value;
  return "both";
}

function selectedIncludeTips(dialog: HTMLDialogElement): boolean {
  const box = dialog.querySelector<HTMLInputElement>("[data-pattern-print-hide-tips]");
  // Checked means hide tips. Unchecked prints the tip content. Charts stay charts-only.
  return box?.checked !== true;
}

/**
 * Resolves with the knitter's choice, or null when they cancel.
 * Falls through to the full instructions-plus-charts print when the dialog cannot open.
 */
export function openPatternPrintChoiceDialog(
  triggerEl: HTMLElement | null,
): Promise<PatternPrintSelection | null> {
  const dialog = ensureDialog();
  if (!dialog || typeof dialog.showModal !== "function") {
    return Promise.resolve({ choice: "both", includeTips: false });
  }

  return new Promise((resolve) => {
    resetDialogDefaults(dialog);
    let settled = false;
    const finish = (selection: PatternPrintSelection | null) => {
      if (settled) return;
      settled = true;
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("cancel", onCancel);
      confirmBtn?.removeEventListener("click", onConfirm);
      cancelBtn?.removeEventListener("click", onCancelClick);
      if (dialog.open) dialog.close();
      triggerEl?.focus?.();
      resolve(selection);
    };
    const onConfirm = (event: Event) => {
      event.preventDefault();
      finish({ choice: selectedChoice(dialog), includeTips: selectedIncludeTips(dialog) });
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
      finish({ choice: "both", includeTips: false });
      return;
    }
    window.requestAnimationFrame(() => {
      dialog.querySelector<HTMLInputElement>('input[name="pattern-print-choice"]:checked')?.focus();
    });
  });
}
