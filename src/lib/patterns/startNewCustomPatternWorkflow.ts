/**
 * Start a brand-new sleeveless pattern session (clears active saved-project link).
 */
import {
  buildDropShoulderBuilderNewPatternHref,
  buildSleevelessExpressNewPatternHref,
} from "./patternStorage";
import { dispatchCustomPatternEditingStateChanged } from "./customPatternEditingBannerActions";
import { hasUnsavedCustomPatternChanges } from "./customPatternSavedProjectDirtyState";
import { saveActiveCustomPatternBeforeNavigate } from "./saveActiveCustomPatternBeforeNavigate";
import { startFreshSleevelessExpressPattern } from "./sleevelessExpressFreshStart";
import {
  resolveCanStartNewPatternForSystem,
  resolveNewPatternBlockedCopy,
  showSleevelessNewPatternLockedScreen,
} from "./sleevelessNewPatternAccessGuard";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";
import { resolvePatternSystemForBuilderGate } from "./patternSystemId";

export const PATTERN_WORKSPACE_NEW_PATTERN_UNSAVED_DIALOG_ID =
  "pattern-workspace-new-pattern-unsaved-dialog";
export const PATTERN_WORKSPACE_NEW_PATTERN_UNSAVED_OVERLAY_ID =
  "pattern-workspace-new-pattern-unsaved-overlay";

export const NEW_PATTERN_UNSAVED_TITLE =
  "You have unsaved changes to this pattern.";
export const NEW_PATTERN_UNSAVED_BODY =
  "Would you like to save your edits before starting a new pattern?";

/** @deprecated Use {@link NEW_PATTERN_UNSAVED_TITLE} and {@link NEW_PATTERN_UNSAVED_BODY}. */
export const NEW_PATTERN_UNSAVED_MESSAGE = NEW_PATTERN_UNSAVED_TITLE;

export const NEW_PATTERN_UNSAVED_FALLBACK_HINT =
  "Unsaved edits to this saved pattern may be lost. Choose an action below.";

export type NewPatternUnsavedChoice = "save-and-new" | "discard-and-new" | "cancel";

export type UnsavedChangesDialogLabels = {
  save: string;
  discard: string;
  cancel: string;
};

export type UnsavedChangesDialogCopy = {
  title: string;
  body: string;
  fallbackHint: string;
  labels: UnsavedChangesDialogLabels;
  showFallbackHint: boolean;
};

export type StartNewCustomPatternOutcome = "started" | "cancelled" | "blocked";

export type StartNewCustomPatternWorkflowDeps = {
  /**
   * Optional access gate, run BEFORE anything is cleared or shown. Resolve `false` to block the
   * new-pattern start (e.g. a free user who already claimed their one-time free pattern). When
   * omitted the flow is not gated (legacy callers / tests).
   */
  canStartNew?: () => Promise<boolean> | boolean;
  /** Called when {@link canStartNew} resolves `false` — show the locked / upgrade UI. */
  onBlocked?: () => void;
  hasUnsaved: () => boolean;
  promptUnsaved: () => Promise<NewPatternUnsavedChoice>;
  saveActiveProject: () => Promise<{ ok: true } | { ok: false }>;
  applyFreshSession: () => void;
  navigate: () => void;
};

export function applyStartNewCustomPatternSession(): void {
  startFreshSleevelessExpressPattern();
  dispatchCustomPatternEditingStateChanged();
}

export function navigateToFreshSleevelessPattern(href = buildSleevelessExpressNewPatternHref()): void {
  if (typeof window === "undefined") return;
  window.location.assign(href);
}

export function buildFreshPatternHrefForPage(doc?: Document): string {
  return resolvePatternSystemForBuilderGate(doc) === "drop-shoulder"
    ? buildDropShoulderBuilderNewPatternHref()
    : buildSleevelessExpressNewPatternHref();
}

export function navigateToFreshPatternForPage(doc?: Document): void {
  navigateToFreshSleevelessPattern(buildFreshPatternHrefForPage(doc));
}

/**
 * Clears the saved-project link and working draft, then navigates to Express with `?new=1`.
 * When editing a saved project with unsaved edits, prompts before discarding.
 */
export async function runStartNewCustomPatternWorkflow(
  deps: StartNewCustomPatternWorkflowDeps,
): Promise<StartNewCustomPatternOutcome> {
  // Earliest possible gate: block locked free users before any draft state is cleared or any
  // setup question / title / notes field is shown.
  if (deps.canStartNew) {
    const allowed = await deps.canStartNew();
    if (!allowed) {
      deps.onBlocked?.();
      return "blocked";
    }
  }

  if (!deps.hasUnsaved()) {
    deps.applyFreshSession();
    deps.navigate();
    return "started";
  }

  const choice = await deps.promptUnsaved();
  if (choice === "cancel") return "cancelled";

  if (choice === "save-and-new") {
    const saveRes = await deps.saveActiveProject();
    if (!saveRes.ok) return "cancelled";
  }

  deps.applyFreshSession();
  deps.navigate();
  return "started";
}

export function createStartNewCustomPatternWorkflowDeps(options: {
  onAfterFreshSession: () => void;
  /** Override the locked-state handler; defaults to the Express locked / upgrade screen. */
  onBlockedStartNew?: () => void;
  root?: ParentNode;
}): StartNewCustomPatternWorkflowDeps {
  const root = options.root ?? (typeof document !== "undefined" ? document : undefined);
  if (!root) {
    throw new Error("document unavailable");
  }
  const doc = resolveDocumentFromRoot(root);
  return {
    canStartNew: () => resolveCanStartNewPatternForSystem(undefined, doc),
    onBlocked:
      options.onBlockedStartNew ??
      (() => {
        void resolveSleevelessUserAccess().then((access) => {
          const system = resolvePatternSystemForBuilderGate(doc);
          showSleevelessNewPatternLockedScreen(
            root,
            resolveNewPatternBlockedCopy(access, system, doc),
            system,
            access,
          );
        });
      }),
    hasUnsaved: hasUnsavedCustomPatternChanges,
    promptUnsaved: () => promptNewPatternUnsavedChoice(root),
    saveActiveProject: async () => saveActiveCustomPatternBeforeNavigate(root),
    applyFreshSession: applyStartNewCustomPatternSession,
    navigate: options.onAfterFreshSession,
  };
}

export async function startNewCustomPatternFromWorkspace(
  root: ParentNode = document,
): Promise<StartNewCustomPatternOutcome> {
  const doc = resolveDocumentFromRoot(root);
  return runStartNewCustomPatternWorkflow(
    createStartNewCustomPatternWorkflowDeps({
      onAfterFreshSession: () => navigateToFreshPatternForPage(doc),
      root,
    }),
  );
}

/**
 * Express “Start Over” / `data-express-editing-start-new` — same unsaved dialog as workspace New Pattern,
 * then resets the Express wizard UI in place (no navigation).
 */
export async function startNewCustomPatternFromExpress(
  onExpressUiReset: () => void,
  root: ParentNode = document,
): Promise<StartNewCustomPatternOutcome> {
  return runStartNewCustomPatternWorkflow(
    createStartNewCustomPatternWorkflowDeps({
      onAfterFreshSession: onExpressUiReset,
      root,
    }),
  );
}

const NEW_PATTERN_UNSAVED_DIALOG_ICON_HTML = `
  <span class="pattern-workspace-new-pattern-dialog__icon" aria-hidden="true">
    <svg
      class="pattern-workspace-new-pattern-dialog__icon-svg"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.75"></circle>
      <path
        d="M12 7.75v5.25M12 15.5h.01"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      ></path>
    </svg>
  </span>
`;

/** Inner panel markup shared by `<dialog>` and the non-dialog overlay fallback. */
export function buildNewPatternUnsavedDialogPanelHtml(): string {
  return `
    <div class="pattern-workspace-new-pattern-dialog__panel" data-pattern-new-unsaved-panel>
      ${NEW_PATTERN_UNSAVED_DIALOG_ICON_HTML}
      <div class="pattern-workspace-new-pattern-dialog__content">
        <h2
          id="pattern-workspace-new-pattern-unsaved-title"
          class="pattern-workspace-new-pattern-dialog__title"
          data-pattern-new-unsaved-title
        >${NEW_PATTERN_UNSAVED_TITLE}</h2>
        <p class="pattern-workspace-new-pattern-dialog__message" data-pattern-new-unsaved-body>${NEW_PATTERN_UNSAVED_BODY}</p>
        <p
          class="pattern-workspace-new-pattern-dialog__fallback-hint"
          data-pattern-new-unsaved-fallback-hint
          hidden
        >${NEW_PATTERN_UNSAVED_FALLBACK_HINT}</p>
      </div>
      <div class="pattern-workspace-new-pattern-dialog__actions">
        <button
          type="button"
          class="pattern-workspace-new-pattern-dialog__btn pattern-workspace-new-pattern-dialog__btn--primary"
          data-pattern-new-unsaved-save
        >
          Save &amp; Start New
        </button>
        <button
          type="button"
          class="pattern-workspace-new-pattern-dialog__btn pattern-workspace-new-pattern-dialog__btn--secondary"
          data-pattern-new-unsaved-discard
        >
          Start New Without Saving
        </button>
        <button
          type="button"
          class="pattern-workspace-new-pattern-dialog__btn pattern-workspace-new-pattern-dialog__btn--minimal"
          data-pattern-new-unsaved-cancel
        >
          Cancel
        </button>
      </div>
    </div>
  `;
}

export function syncNewPatternUnsavedDialogCopy(panel: ParentNode, options?: { showFallbackHint?: boolean }): void {
  const title = panel.querySelector("[data-pattern-new-unsaved-title]");
  const body = panel.querySelector("[data-pattern-new-unsaved-body]");
  const hint = panel.querySelector("[data-pattern-new-unsaved-fallback-hint]");
  if (title) title.textContent = NEW_PATTERN_UNSAVED_TITLE;
  if (body) body.textContent = NEW_PATTERN_UNSAVED_BODY;
  if (hint instanceof HTMLElement) {
    hint.textContent = NEW_PATTERN_UNSAVED_FALLBACK_HINT;
    hint.hidden = !options?.showFallbackHint;
  }
}

export function syncUnsavedChangesDialogUi(panel: ParentNode, config: UnsavedChangesDialogCopy): void {
  const title = panel.querySelector("[data-pattern-new-unsaved-title]");
  const body = panel.querySelector("[data-pattern-new-unsaved-body]");
  const hint = panel.querySelector("[data-pattern-new-unsaved-fallback-hint]");
  const saveBtn = panel.querySelector("[data-pattern-new-unsaved-save]");
  const discardBtn = panel.querySelector("[data-pattern-new-unsaved-discard]");
  const cancelBtn = panel.querySelector("[data-pattern-new-unsaved-cancel]");

  if (title) title.textContent = config.title;
  if (body) body.textContent = config.body;
  if (hint instanceof HTMLElement) {
    hint.textContent = config.fallbackHint;
    hint.hidden = !config.showFallbackHint;
  }

  if (saveBtn instanceof HTMLElement) saveBtn.textContent = config.labels.save;
  if (discardBtn instanceof HTMLElement) discardBtn.textContent = config.labels.discard;
  if (cancelBtn instanceof HTMLElement) cancelBtn.textContent = config.labels.cancel;
}

function resolveDocumentFromRoot(root: ParentNode): Document {
  if (typeof Document !== "undefined" && root instanceof Document) return root;
  if (typeof HTMLElement !== "undefined" && root instanceof HTMLElement && root.ownerDocument) {
    return root.ownerDocument;
  }
  if (typeof document !== "undefined") return document;
  throw new Error("document unavailable");
}

function bindNewPatternUnsavedChoiceHandlers(
  panel: ParentNode,
  onChoice: (choice: NewPatternUnsavedChoice) => void,
): () => void {
  const saveBtn = panel.querySelector("[data-pattern-new-unsaved-save]");
  const discardBtn = panel.querySelector("[data-pattern-new-unsaved-discard]");
  const cancelBtn = panel.querySelector("[data-pattern-new-unsaved-cancel]");

  const onSave = (): void => {
    onChoice("save-and-new");
  };
  const onDiscard = (): void => onChoice("discard-and-new");
  const onCancel = (): void => onChoice("cancel");

  saveBtn?.addEventListener("click", onSave);
  discardBtn?.addEventListener("click", onDiscard);
  cancelBtn?.addEventListener("click", onCancel);

  return () => {
    saveBtn?.removeEventListener("click", onSave);
    discardBtn?.removeEventListener("click", onDiscard);
    cancelBtn?.removeEventListener("click", onCancel);
  };
}

function getUnsavedDialogPanel(host: ParentNode): HTMLElement | null {
  const panel = host.querySelector("[data-pattern-new-unsaved-panel]");
  return panel instanceof HTMLElement ? panel : null;
}

export function buildUnsavedDialogCopyForNewPattern(options?: {
  showFallbackHint?: boolean;
}): UnsavedChangesDialogCopy {
  return {
    title: NEW_PATTERN_UNSAVED_TITLE,
    body: NEW_PATTERN_UNSAVED_BODY,
    fallbackHint: NEW_PATTERN_UNSAVED_FALLBACK_HINT,
    labels: {
      save: "Save & Start New",
      discard: "Start New Without Saving",
      cancel: "Cancel",
    },
    showFallbackHint: options?.showFallbackHint === true,
  };
}

export type SavedPatternViewUnsavedChoice = "save-and-view" | "view-without-saving" | "cancel";

export function buildUnsavedDialogCopyForViewPattern(options?: {
  showFallbackHint?: boolean;
}): UnsavedChangesDialogCopy {
  return {
    title: "You have unsaved changes to this pattern.",
    body: "Would you like to save your edits before viewing your pattern?",
    fallbackHint: NEW_PATTERN_UNSAVED_FALLBACK_HINT,
    labels: {
      save: "Save & View Pattern",
      discard: "View Without Saving",
      cancel: "Cancel",
    },
    showFallbackHint: options?.showFallbackHint === true,
  };
}

function ensureNewPatternUnsavedDialog(doc: Document): HTMLDialogElement {
  let dialog = doc.getElementById(PATTERN_WORKSPACE_NEW_PATTERN_UNSAVED_DIALOG_ID);
  if (!(dialog instanceof HTMLDialogElement)) {
    dialog = doc.createElement("dialog");
    dialog.id = PATTERN_WORKSPACE_NEW_PATTERN_UNSAVED_DIALOG_ID;
    dialog.className = "pattern-workspace-new-pattern-dialog";
    dialog.setAttribute("aria-labelledby", "pattern-workspace-new-pattern-unsaved-title");
    dialog.innerHTML = buildNewPatternUnsavedDialogPanelHtml();
    doc.body.appendChild(dialog);
  }
  const panel = getUnsavedDialogPanel(dialog);
  if (panel) syncUnsavedChangesDialogUi(panel, buildUnsavedDialogCopyForNewPattern({ showFallbackHint: false }));
  return dialog;
}

function ensureNewPatternUnsavedOverlay(doc: Document): HTMLElement {
  let overlay = doc.getElementById(PATTERN_WORKSPACE_NEW_PATTERN_UNSAVED_OVERLAY_ID);
  if (!(overlay instanceof HTMLElement)) {
    overlay = doc.createElement("div");
    overlay.id = PATTERN_WORKSPACE_NEW_PATTERN_UNSAVED_OVERLAY_ID;
    overlay.className = "pattern-workspace-new-pattern-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pattern-workspace-new-pattern-unsaved-title");
    overlay.hidden = true;
    overlay.innerHTML = `
      <button
        type="button"
        class="pattern-workspace-new-pattern-overlay__backdrop"
        data-pattern-new-unsaved-backdrop
        aria-label="Cancel"
      ></button>
      <div class="pattern-workspace-new-pattern-dialog pattern-workspace-new-pattern-dialog--overlay">
        ${buildNewPatternUnsavedDialogPanelHtml()}
      </div>
    `;
    doc.body.appendChild(overlay);
  }
  const panel = getUnsavedDialogPanel(overlay);
  if (panel) syncUnsavedChangesDialogUi(panel, buildUnsavedDialogCopyForNewPattern({ showFallbackHint: true }));
  return overlay;
}

function canShowNativeDialog(dialog: HTMLDialogElement): boolean {
  return typeof dialog.showModal === "function";
}

function promptWithNativeDialog(dialog: HTMLDialogElement): Promise<NewPatternUnsavedChoice> {
  const panel = getUnsavedDialogPanel(dialog);
  if (!panel) return Promise.resolve("cancel");

  return new Promise((resolve) => {
    let settled = false;

    const finish = (choice: NewPatternUnsavedChoice): void => {
      if (settled) return;
      settled = true;
      unbindChoices();
      dialog.removeEventListener("cancel", onDialogCancel);
      if (dialog.open) dialog.close();
      resolve(choice);
    };

    const onDialogCancel = (event: Event): void => {
      event.preventDefault();
      finish("cancel");
    };

    const unbindChoices = bindNewPatternUnsavedChoiceHandlers(panel, finish);
    dialog.addEventListener("cancel", onDialogCancel);
    dialog.showModal();
  });
}

function promptWithOverlay(overlay: HTMLElement): Promise<NewPatternUnsavedChoice> {
  const panel = getUnsavedDialogPanel(overlay);
  if (!panel) return Promise.resolve("cancel");

  const doc = overlay.ownerDocument;

  return new Promise((resolve) => {
    let settled = false;
    const backdrop = overlay.querySelector("[data-pattern-new-unsaved-backdrop]");

    const finish = (choice: NewPatternUnsavedChoice): void => {
      if (settled) return;
      settled = true;
      unbindChoices();
      backdrop?.removeEventListener("click", onBackdrop);
      doc.removeEventListener("keydown", onKeydown);
      overlay.hidden = true;
      doc.body.classList.remove("pattern-workspace-new-pattern-overlay-open");
      resolve(choice);
    };

    const onBackdrop = (): void => finish("cancel");
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish("cancel");
      }
    };

    const unbindChoices = bindNewPatternUnsavedChoiceHandlers(panel, finish);
    backdrop?.addEventListener("click", onBackdrop);
    doc.addEventListener("keydown", onKeydown);

    overlay.hidden = false;
    doc.body.classList.add("pattern-workspace-new-pattern-overlay-open");
    panel.querySelector<HTMLButtonElement>("[data-pattern-new-unsaved-save]")?.focus();
  });
}

export function promptNewPatternUnsavedChoice(
  root: ParentNode,
): Promise<NewPatternUnsavedChoice> {
  const doc = resolveDocumentFromRoot(root);
  const dialog = ensureNewPatternUnsavedDialog(doc);

  if (canShowNativeDialog(dialog)) {
    return promptWithNativeDialog(dialog);
  }

  return promptWithOverlay(ensureNewPatternUnsavedOverlay(doc));
}

export async function promptSavedPatternViewUnsavedChoice(
  root: ParentNode,
): Promise<SavedPatternViewUnsavedChoice> {
  const doc = resolveDocumentFromRoot(root);
  const dialog = ensureNewPatternUnsavedDialog(doc);

  const panel = getUnsavedDialogPanel(dialog);
  if (panel) syncUnsavedChangesDialogUi(panel, buildUnsavedDialogCopyForViewPattern({ showFallbackHint: false }));

  if (canShowNativeDialog(dialog)) {
    const base = await promptWithNativeDialog(dialog);
    if (base === "save-and-new") return "save-and-view";
    if (base === "discard-and-new") return "view-without-saving";
    return "cancel";
  }

  const overlay = ensureNewPatternUnsavedOverlay(doc);
  const overlayPanel = getUnsavedDialogPanel(overlay);
  if (overlayPanel) syncUnsavedChangesDialogUi(overlayPanel, buildUnsavedDialogCopyForViewPattern({ showFallbackHint: true }));

  const base = await promptWithOverlay(overlay);
  if (base === "save-and-new") return "save-and-view";
  if (base === "discard-and-new") return "view-without-saving";
  return "cancel";
}
