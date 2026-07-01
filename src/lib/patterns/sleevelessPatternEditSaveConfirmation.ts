/**
 * Post-save confirmation for Edit Pattern ? Save Changes on the pattern workspace.
 */

export const EDIT_PATTERN_SAVE_CONFIRMATION_TITLE = "Pattern saved";
export const EDIT_PATTERN_SAVE_CONFIRMATION_BODY = "Your changes have been saved.";
export const EDIT_PATTERN_SAVE_CONFIRMATION_VIEW_LABEL = "View Updated Pattern";
export const EDIT_PATTERN_SAVE_CONFIRMATION_KEEP_EDITING_LABEL = "Keep Editing";

export type EditPatternSaveConfirmationChoice = "view" | "keep-editing";

export const EDIT_PATTERN_SAVE_CONFIRMATION_OVERLAY_ID = "sl-edit-save-confirmation-overlay";

function buildEditPatternSaveConfirmationPanelHtml(): string {
  return `
    <div
      class="pattern-workspace-new-pattern-dialog__panel"
      data-sl-edit-save-confirmation-panel
    >
      <div class="pattern-workspace-new-pattern-dialog__content">
        <h2
          id="sl-edit-save-confirmation-title"
          class="pattern-workspace-new-pattern-dialog__title"
          data-sl-edit-save-confirmation-title
        >
          ${EDIT_PATTERN_SAVE_CONFIRMATION_TITLE}
        </h2>
        <p
          class="pattern-workspace-new-pattern-dialog__message"
          data-sl-edit-save-confirmation-body
        >
          ${EDIT_PATTERN_SAVE_CONFIRMATION_BODY}
        </p>
      </div>
      <div class="pattern-workspace-new-pattern-dialog__actions">
        <button
          type="button"
          class="pattern-workspace-new-pattern-dialog__btn pattern-workspace-new-pattern-dialog__btn--primary"
          data-sl-edit-save-confirmation-view
          data-testid="button-edit-save-view-pattern"
        >
          ${EDIT_PATTERN_SAVE_CONFIRMATION_VIEW_LABEL}
        </button>
        <button
          type="button"
          class="pattern-workspace-new-pattern-dialog__btn pattern-workspace-new-pattern-dialog__btn--secondary"
          data-sl-edit-save-confirmation-keep-editing
          data-testid="button-edit-save-keep-editing"
        >
          ${EDIT_PATTERN_SAVE_CONFIRMATION_KEEP_EDITING_LABEL}
        </button>
      </div>
    </div>
  `;
}

function getConfirmationPanel(host: ParentNode): HTMLElement | null {
  const panel = host.querySelector("[data-sl-edit-save-confirmation-panel]");
  if (!panel || typeof panel !== "object") return null;
  return panel as HTMLElement;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return Boolean(value) && typeof value === "object" && "hidden" in (value as object);
}

function ensureEditPatternSaveConfirmationOverlay(doc: Document): HTMLElement {
  let overlay = doc.getElementById(EDIT_PATTERN_SAVE_CONFIRMATION_OVERLAY_ID);
  if (!isHtmlElement(overlay)) {
    overlay = doc.createElement("div");
    overlay.id = EDIT_PATTERN_SAVE_CONFIRMATION_OVERLAY_ID;
    overlay.className = "pattern-workspace-new-pattern-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "sl-edit-save-confirmation-title");
    overlay.setAttribute("data-sl-edit-save-confirmation", "");
    overlay.hidden = true;
    overlay.innerHTML = `
      <button
        type="button"
        class="pattern-workspace-new-pattern-overlay__backdrop"
        data-sl-edit-save-confirmation-backdrop
        aria-label="Keep editing"
      ></button>
      <div class="pattern-workspace-new-pattern-dialog pattern-workspace-new-pattern-dialog--overlay">
        ${buildEditPatternSaveConfirmationPanelHtml()}
      </div>
    `;
    doc.body.appendChild(overlay);
  }
  return overlay;
}

function bindChoiceHandlers(
  panel: ParentNode,
  onChoice: (choice: EditPatternSaveConfirmationChoice) => void,
): () => void {
  const viewBtn = panel.querySelector("[data-sl-edit-save-confirmation-view]");
  const keepEditingBtn = panel.querySelector("[data-sl-edit-save-confirmation-keep-editing]");

  const onView = (): void => onChoice("view");
  const onKeepEditing = (): void => onChoice("keep-editing");

  viewBtn?.addEventListener("click", onView);
  keepEditingBtn?.addEventListener("click", onKeepEditing);

  return () => {
    viewBtn?.removeEventListener("click", onView);
    keepEditingBtn?.removeEventListener("click", onKeepEditing);
  };
}

function resolvePromptDocument(root?: ParentNode): Document | null {
  if (typeof document === "undefined") return null;
  if (!root || root === document) return document;
  const owner = (root as { ownerDocument?: Document | null }).ownerDocument;
  return owner ?? document;
}

export function isEditPatternSaveConfirmationOpen(doc: Document = document): boolean {
  const overlay = doc.getElementById(EDIT_PATTERN_SAVE_CONFIRMATION_OVERLAY_ID);
  if (!overlay || typeof overlay !== "object" || !("hidden" in overlay)) return false;
  return (overlay as HTMLElement).hidden === false;
}

/**
 * Shows the post-save confirmation modal. Resolves when the user picks an action.
 * Does not perform save ù call only after a successful save completes.
 */
export function promptEditPatternSaveConfirmation(
  root?: ParentNode,
): Promise<EditPatternSaveConfirmationChoice> {
  const doc = resolvePromptDocument(root);

  if (!doc) {
    return Promise.resolve("view");
  }

  const overlay = ensureEditPatternSaveConfirmationOverlay(doc);
  const panel = getConfirmationPanel(overlay);
  if (!panel) {
    return Promise.resolve("view");
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (choice: EditPatternSaveConfirmationChoice): void => {
      if (settled) return;
      settled = true;
      unbindChoices();
      backdrop?.removeEventListener("click", onKeepEditing);
      doc.removeEventListener("keydown", onKeyDown);
      overlay.hidden = true;
      doc.body.classList.remove("pattern-workspace-new-pattern-overlay-open");
      resolve(choice);
    };

    const onKeepEditing = (): void => finish("keep-editing");
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onKeepEditing();
    };

    const unbindChoices = bindChoiceHandlers(panel, finish);
    const backdrop = overlay.querySelector("[data-sl-edit-save-confirmation-backdrop]");
    backdrop?.addEventListener("click", onKeepEditing);
    doc.addEventListener("keydown", onKeyDown);

    overlay.hidden = false;
    doc.body.classList.add("pattern-workspace-new-pattern-overlay-open");

    const viewBtn = panel.querySelector<HTMLButtonElement>("[data-sl-edit-save-confirmation-view]");
    viewBtn?.focus();
  });
}
