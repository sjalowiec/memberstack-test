/**
 * Explains that Drop Shoulder armhole depth is derived from Upper Arm.
 * Reuses the pattern-workspace-new-pattern dialog/overlay (no new modal system).
 */

export const DROP_SHOULDER_ARMHOLE_DEPTH_HELP_TITLE = "Want to change the armhole depth?";
export const DROP_SHOULDER_ARMHOLE_DEPTH_HELP_BODY =
  "For a Drop Shoulder sweater, the armhole depth is calculated from the Upper Arm measurement. Change the Upper Arm measurement to adjust the armhole depth.";
export const DROP_SHOULDER_ARMHOLE_DEPTH_HELP_EDIT_LABEL = "Edit Upper Arm Measurement";

export const DROP_SHOULDER_ARMHOLE_DEPTH_HELP_OVERLAY_ID =
  "ds-armhole-depth-help-overlay";

export type DropShoulderArmholeDepthHelpChoice = "edit-upper-arm" | "dismiss";

function buildDropShoulderArmholeDepthHelpPanelHtml(): string {
  return `
    <div
      class="pattern-workspace-new-pattern-dialog__panel"
      data-ds-armhole-depth-help-panel
    >
      <div class="pattern-workspace-new-pattern-dialog__content">
        <h2
          id="ds-armhole-depth-help-title"
          class="pattern-workspace-new-pattern-dialog__title"
          data-ds-armhole-depth-help-title
        >
          ${DROP_SHOULDER_ARMHOLE_DEPTH_HELP_TITLE}
        </h2>
        <p
          class="pattern-workspace-new-pattern-dialog__message"
          data-ds-armhole-depth-help-body
        >
          ${DROP_SHOULDER_ARMHOLE_DEPTH_HELP_BODY}
        </p>
      </div>
      <div class="pattern-workspace-new-pattern-dialog__actions">
        <button
          type="button"
          class="pattern-workspace-new-pattern-dialog__btn pattern-workspace-new-pattern-dialog__btn--primary"
          data-ds-armhole-depth-help-edit
        >
          ${DROP_SHOULDER_ARMHOLE_DEPTH_HELP_EDIT_LABEL}
        </button>
      </div>
    </div>
  `;
}

function getHelpPanel(host: ParentNode): HTMLElement | null {
  const panel = host.querySelector("[data-ds-armhole-depth-help-panel]");
  if (!panel || typeof panel !== "object") return null;
  return panel as HTMLElement;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return Boolean(value) && typeof value === "object" && "hidden" in (value as object);
}

function ensureDropShoulderArmholeDepthHelpOverlay(doc: Document): HTMLElement {
  let overlay = doc.getElementById(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_OVERLAY_ID);
  if (!isHtmlElement(overlay)) {
    overlay = doc.createElement("div");
    overlay.id = DROP_SHOULDER_ARMHOLE_DEPTH_HELP_OVERLAY_ID;
    overlay.className = "pattern-workspace-new-pattern-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ds-armhole-depth-help-title");
    overlay.setAttribute("data-ds-armhole-depth-help", "");
    overlay.hidden = true;
    overlay.innerHTML = `
      <button
        type="button"
        class="pattern-workspace-new-pattern-overlay__backdrop"
        data-ds-armhole-depth-help-backdrop
        aria-label="Close"
      ></button>
      <div class="pattern-workspace-new-pattern-dialog pattern-workspace-new-pattern-dialog--overlay">
        ${buildDropShoulderArmholeDepthHelpPanelHtml()}
      </div>
    `;
    doc.body.appendChild(overlay);
  }
  return overlay;
}

function bindChoiceHandlers(
  panel: ParentNode,
  onChoice: (choice: DropShoulderArmholeDepthHelpChoice) => void,
): () => void {
  const editBtn = panel.querySelector("[data-ds-armhole-depth-help-edit]");

  const onEdit = (): void => onChoice("edit-upper-arm");
  editBtn?.addEventListener("click", onEdit);

  return () => {
    editBtn?.removeEventListener("click", onEdit);
  };
}

function resolvePromptDocument(root?: ParentNode): Document | null {
  if (typeof document === "undefined") return null;
  if (!root || root === document) return document;
  const owner = (root as { ownerDocument?: Document | null }).ownerDocument;
  return owner ?? document;
}

export function isDropShoulderArmholeDepthHelpOpen(doc: Document = document): boolean {
  const overlay = doc.getElementById(DROP_SHOULDER_ARMHOLE_DEPTH_HELP_OVERLAY_ID);
  if (!overlay || typeof overlay !== "object" || !("hidden" in overlay)) return false;
  return (overlay as HTMLElement).hidden === false;
}

/**
 * Shows the armhole-depth explanation. Resolves when the user picks an action
 * or dismisses (Escape / backdrop).
 */
export function promptDropShoulderArmholeDepthHelp(
  root?: ParentNode,
): Promise<DropShoulderArmholeDepthHelpChoice> {
  const doc = resolvePromptDocument(root);

  if (!doc) {
    return Promise.resolve("dismiss");
  }

  const overlay = ensureDropShoulderArmholeDepthHelpOverlay(doc);
  const panel = getHelpPanel(overlay);
  if (!panel) {
    return Promise.resolve("dismiss");
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (choice: DropShoulderArmholeDepthHelpChoice): void => {
      if (settled) return;
      settled = true;
      unbindChoices();
      backdrop?.removeEventListener("click", onDismiss);
      doc.removeEventListener("keydown", onKeyDown);
      overlay.hidden = true;
      doc.body.classList.remove("pattern-workspace-new-pattern-overlay-open");
      resolve(choice);
    };

    const onDismiss = (): void => finish("dismiss");
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    };

    const unbindChoices = bindChoiceHandlers(panel, finish);
    const backdrop = overlay.querySelector("[data-ds-armhole-depth-help-backdrop]");
    backdrop?.addEventListener("click", onDismiss);
    doc.addEventListener("keydown", onKeyDown);

    overlay.hidden = false;
    doc.body.classList.add("pattern-workspace-new-pattern-overlay-open");

    const editBtn = panel.querySelector<HTMLButtonElement>("[data-ds-armhole-depth-help-edit]");
    editBtn?.focus();
  });
}
