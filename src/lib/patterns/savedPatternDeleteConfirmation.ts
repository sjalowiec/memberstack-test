/**
 * Shared confirm dialog for deleting a saved Custom Pattern from My Patterns surfaces.
 * Reuses pattern-workspace-new-pattern dialog/overlay button styles.
 */

export const DELETE_SAVED_PATTERN_CONFIRM_MESSAGE =
  "Delete this pattern? This cannot be undone.";
export const DELETE_SAVED_PATTERN_CONFIRM_TITLE = "Delete this pattern?";
export const DELETE_SAVED_PATTERN_CONFIRM_BODY = "This cannot be undone.";
export const DELETE_SAVED_PATTERN_CONFIRM_CANCEL_LABEL = "Cancel";
export const DELETE_SAVED_PATTERN_CONFIRM_DELETE_LABEL = "Delete Pattern";

export const SAVED_PATTERN_DELETE_CONFIRMATION_OVERLAY_ID =
  "kbm-saved-pattern-delete-confirmation-overlay";

export type SavedPatternDeleteConfirmationChoice = "cancel" | "delete";

function buildSavedPatternDeleteConfirmationPanelHtml(): string {
  return `
    <div
      class="pattern-workspace-new-pattern-dialog__panel"
      data-saved-pattern-delete-confirmation-panel
    >
      <div class="pattern-workspace-new-pattern-dialog__content">
        <h2
          id="kbm-saved-pattern-delete-confirmation-title"
          class="pattern-workspace-new-pattern-dialog__title"
          data-saved-pattern-delete-confirmation-title
        >
          ${DELETE_SAVED_PATTERN_CONFIRM_TITLE}
        </h2>
        <p
          class="pattern-workspace-new-pattern-dialog__message"
          data-saved-pattern-delete-confirmation-body
        >
          ${DELETE_SAVED_PATTERN_CONFIRM_BODY}
        </p>
      </div>
      <div class="pattern-workspace-new-pattern-dialog__actions">
        <button
          type="button"
          class="pattern-workspace-new-pattern-dialog__btn pattern-workspace-new-pattern-dialog__btn--primary"
          data-saved-pattern-delete-confirmation-delete
          data-testid="button-saved-pattern-delete-confirm"
        >
          ${DELETE_SAVED_PATTERN_CONFIRM_DELETE_LABEL}
        </button>
        <button
          type="button"
          class="pattern-workspace-new-pattern-dialog__btn pattern-workspace-new-pattern-dialog__btn--secondary"
          data-saved-pattern-delete-confirmation-cancel
          data-testid="button-saved-pattern-delete-cancel"
        >
          ${DELETE_SAVED_PATTERN_CONFIRM_CANCEL_LABEL}
        </button>
      </div>
    </div>
  `;
}

function getConfirmationPanel(host: ParentNode): HTMLElement | null {
  const panel = host.querySelector("[data-saved-pattern-delete-confirmation-panel]");
  if (!panel || typeof panel !== "object") return null;
  return panel as HTMLElement;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return Boolean(value) && typeof value === "object" && "hidden" in (value as object);
}

function ensureSavedPatternDeleteConfirmationOverlay(doc: Document): HTMLElement {
  let overlay = doc.getElementById(SAVED_PATTERN_DELETE_CONFIRMATION_OVERLAY_ID);
  if (!isHtmlElement(overlay)) {
    overlay = doc.createElement("div");
    overlay.id = SAVED_PATTERN_DELETE_CONFIRMATION_OVERLAY_ID;
    overlay.className = "pattern-workspace-new-pattern-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "kbm-saved-pattern-delete-confirmation-title");
    overlay.setAttribute("data-saved-pattern-delete-confirmation", "");
    overlay.hidden = true;
    overlay.innerHTML = `
      <button
        type="button"
        class="pattern-workspace-new-pattern-overlay__backdrop"
        data-saved-pattern-delete-confirmation-backdrop
        aria-label="Cancel"
      ></button>
      <div class="pattern-workspace-new-pattern-dialog pattern-workspace-new-pattern-dialog--overlay">
        ${buildSavedPatternDeleteConfirmationPanelHtml()}
      </div>
    `;
    doc.body.appendChild(overlay);
  }
  return overlay;
}

function bindChoiceHandlers(
  panel: ParentNode,
  onChoice: (choice: SavedPatternDeleteConfirmationChoice) => void,
): () => void {
  const deleteBtn = panel.querySelector("[data-saved-pattern-delete-confirmation-delete]");
  const cancelBtn = panel.querySelector("[data-saved-pattern-delete-confirmation-cancel]");

  const onDelete = (): void => onChoice("delete");
  const onCancel = (): void => onChoice("cancel");

  deleteBtn?.addEventListener("click", onDelete);
  cancelBtn?.addEventListener("click", onCancel);

  return () => {
    deleteBtn?.removeEventListener("click", onDelete);
    cancelBtn?.removeEventListener("click", onCancel);
  };
}

function resolvePromptDocument(root?: ParentNode): Document | null {
  if (typeof document === "undefined") return null;
  if (!root || root === document) return document;
  const owner = (root as { ownerDocument?: Document | null }).ownerDocument;
  return owner ?? document;
}

export function isSavedPatternDeleteConfirmationOpen(doc: Document = document): boolean {
  const overlay = doc.getElementById(SAVED_PATTERN_DELETE_CONFIRMATION_OVERLAY_ID);
  if (!overlay || typeof overlay !== "object" || !("hidden" in overlay)) return false;
  return (overlay as HTMLElement).hidden === false;
}

/**
 * Shows the delete confirmation modal. Resolves when the user picks an action.
 * Does not delete — call only to gate a subsequent deleteSavedCustomPatternProject call.
 */
export function promptSavedPatternDeleteConfirmation(
  root?: ParentNode,
): Promise<SavedPatternDeleteConfirmationChoice> {
  const doc = resolvePromptDocument(root);

  if (!doc) {
    return Promise.resolve("cancel");
  }

  const overlay = ensureSavedPatternDeleteConfirmationOverlay(doc);
  const panel = getConfirmationPanel(overlay);
  if (!panel) {
    return Promise.resolve("cancel");
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (choice: SavedPatternDeleteConfirmationChoice): void => {
      if (settled) return;
      settled = true;
      unbindChoices();
      backdrop?.removeEventListener("click", onCancel);
      doc.removeEventListener("keydown", onKeyDown);
      overlay.hidden = true;
      doc.body.classList.remove("pattern-workspace-new-pattern-overlay-open");
      resolve(choice);
    };

    const onCancel = (): void => finish("cancel");
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };

    const unbindChoices = bindChoiceHandlers(panel, finish);
    const backdrop = overlay.querySelector("[data-saved-pattern-delete-confirmation-backdrop]");
    backdrop?.addEventListener("click", onCancel);
    doc.addEventListener("keydown", onKeyDown);

    overlay.hidden = false;
    doc.body.classList.add("pattern-workspace-new-pattern-overlay-open");

    const cancelBtn = panel.querySelector<HTMLButtonElement>(
      "[data-saved-pattern-delete-confirmation-cancel]",
    );
    cancelBtn?.focus();
  });
}
