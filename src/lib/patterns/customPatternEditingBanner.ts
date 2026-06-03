import {
  readActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import {
  isEditingSavedCustomPatternProject,
  resolveEditingSavedPatternBannerName,
} from "./customPatternEditingUx";
import {
  CB_EDITING_BANNER_CANCEL_SELECTOR,
  CB_EDITING_BANNER_COPY_SELECTOR,
  CB_EDITING_BANNER_STATUS_SELECTOR,
  CB_EDITING_BANNER_UPDATE_SELECTOR,
  CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT,
  exitEditingSavedCustomPattern,
  runCopyActiveSavedCustomPattern,
  runUpdateActiveSavedCustomPattern,
  syncEditingSavedPatternChrome,
} from "./customPatternEditingBannerActions";
import { syncSavedCustomPatternCopyAccess } from "./savedCustomPatternCopyAccess";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { hasUnsavedSavedCustomPatternChanges } from "./customPatternSavedProjectDirtyState";
import { resolveCustomBuildMeasureFlushRoot } from "./sleevelessCustomMeasurementStorage";
import { navigateToPatternWithUnsavedEditsGuard } from "./savedCustomPatternUnsavedViewGuard";
export type CustomPatternEditingBannerState =
  | { show: false; projectName: "" }
  | { show: true; projectName: string };

/** Where the `[data-cb-editing-banner-host]` markup is mounted in the sleeveless workspace. */
export type CustomPatternEditingBannerSurface = "pattern-output" | "editable-workspace";

/**
 * Finished Pattern instructions (`/patterns/sleeveless/pattern/`) omit the banner host.
 * Create, Customize, Foundation, Review, and other editable steps include it.
 */
export function shouldMountCustomPatternEditingBannerHost(
  surface: CustomPatternEditingBannerSurface,
): boolean {
  return surface === "editable-workspace";
}

/** Plain-text body line; the rendered banner uses a clickable “Save” control in place of the word. */
export const CUSTOM_PATTERN_EDITING_BANNER_BODY_TEXT =
  "Changes won't be saved until you click Save.";

export function buildCustomPatternEditingBannerCopy(projectName: string): {
  title: string;
  body: string;
} {
  const name = projectName.trim() || "Sleeveless Sweater";
  return {
    title: `Editing saved pattern: ${name}`,
    body: CUSTOM_PATTERN_EDITING_BANNER_BODY_TEXT,
  };
}

export function getCustomPatternEditingBannerState(): CustomPatternEditingBannerState {
  if (!isEditingSavedCustomPatternProject() || !readActiveCustomPatternProjectId()) {
    return { show: false, projectName: "" };
  }
  const name = resolveEditingSavedPatternBannerName().trim();
  return { show: true, projectName: name || "Sleeveless Sweater" };
}

function setBannerStatus(host: HTMLElement, message: string, isError = false): void {
  const el = host.querySelector(CB_EDITING_BANNER_STATUS_SELECTOR);
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.classList.toggle("cb-editing-banner__status--error", isError);
  el.hidden = !message;
}

export function renderCustomPatternEditingBanner(host: HTMLElement): void {
  const state = getCustomPatternEditingBannerState();
  syncEditingSavedPatternChrome();

  if (!state.show) {
    host.replaceChildren();
    host.setAttribute("hidden", "");
    return;
  }

  host.removeAttribute("hidden");
  host.replaceChildren();

  const copy = buildCustomPatternEditingBannerCopy(state.projectName);
  const wrap = document.createElement("div");
  wrap.className = "cb-editing-banner";
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-live", "polite");

  const layout = document.createElement("div");
  layout.className = "cb-editing-banner__layout";

  const content = document.createElement("div");
  content.className = "cb-editing-banner__content";

  const title = document.createElement("p");
  title.className = "cb-editing-banner__title";
  title.textContent = copy.title;

  const body = document.createElement("p");
  body.className = "cb-editing-banner__body";
  body.append(document.createTextNode("Changes won't be saved until you click "));
  const saveLink = document.createElement("button");
  saveLink.type = "button";
  saveLink.className = "cb-editing-banner__save-link";
  saveLink.setAttribute("data-cb-editing-banner-update", "");
  saveLink.textContent = "Save";
  body.append(saveLink, document.createTextNode("."));

  content.append(title, body);

  const actions = document.createElement("div");
  actions.className = "cb-editing-banner__actions";

  const updateBtn = document.createElement("button");
  updateBtn.type = "button";
  updateBtn.className = "cb-editing-banner__btn cb-editing-banner__btn--save";
  updateBtn.setAttribute("data-cb-editing-banner-update", "");
  updateBtn.title = "Save changes to this saved pattern";
  updateBtn.setAttribute("aria-label", "Save Changes");
  updateBtn.innerHTML =
    '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span>Save Changes</span>';

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "cb-editing-banner__btn cb-editing-banner__btn--copy";
  copyBtn.setAttribute("data-cb-editing-banner-copy", "");
  copyBtn.title = "Save a Copy";
  copyBtn.setAttribute("aria-label", "Save a Copy");
  copyBtn.innerHTML = '<i class="fa-solid fa-copy" aria-hidden="true"></i><span>Save a Copy</span>';
  // Visible for everyone; disabled + grayed (helper tooltip) for free / non-owner users.
  syncSavedCustomPatternCopyAccess(copyBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "cb-editing-banner__icon-btn cb-editing-banner__icon-btn--cancel";
  cancelBtn.setAttribute("data-cb-editing-banner-cancel", "");
  cancelBtn.title = "Stop editing saved pattern";
  cancelBtn.setAttribute("aria-label", "Stop editing saved pattern");
  cancelBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

  actions.append(updateBtn, copyBtn, cancelBtn);
  layout.append(content, actions);
  wrap.append(layout);

  const status = document.createElement("p");
  status.className = "cb-editing-banner__status";
  status.setAttribute("data-cb-editing-banner-status", "");
  status.setAttribute("role", "status");
  status.hidden = true;
  wrap.append(status);

  host.appendChild(wrap);
}

/** Whether `target` activated the banner save action (inline Save or floppy icon). */
export function isCustomPatternEditingBannerUpdateTarget(target: Element): boolean {
  return !!target.closest(CB_EDITING_BANNER_UPDATE_SELECTOR);
}

function setEditingBannerUpdateTriggersDisabled(host: HTMLElement, disabled: boolean): void {
  host.querySelectorAll(CB_EDITING_BANNER_UPDATE_SELECTOR).forEach((el) => {
    if (!("disabled" in el)) return;
    (el as HTMLButtonElement).disabled = disabled;
  });
}

/** Shared save handler for the inline Save control and the floppy-disk button. */
export async function performEditingBannerUpdate(host: HTMLElement): Promise<void> {
  setEditingBannerUpdateTriggersDisabled(host, true);
  try {
    const res = await runUpdateActiveSavedCustomPattern(host.ownerDocument, {
      onStatus: (message, isError) => setBannerStatus(host, message, isError),
    });
    if (res.ok) {
      setBannerStatus(host, `Updated “${res.projectName}”.`);
      renderCustomPatternEditingBanner(host);
    }
  } finally {
    setEditingBannerUpdateTriggersDisabled(host, false);
  }
}

function setEditingBannerCopyTriggersDisabled(host: HTMLElement, disabled: boolean): void {
  host.querySelectorAll(CB_EDITING_BANNER_COPY_SELECTOR).forEach((el) => {
    if (!("disabled" in el)) return;
    (el as HTMLButtonElement).disabled = disabled;
  });
}

/** "Save a Copy" handler — duplicates the open pattern into a new saved project. */
export async function performEditingBannerCopy(host: HTMLElement): Promise<void> {
  setEditingBannerCopyTriggersDisabled(host, true);
  try {
    const res = await runCopyActiveSavedCustomPattern(host.ownerDocument, {
      onStatus: (message, isError) => setBannerStatus(host, message, isError),
    });
    if (res.ok) {
      setBannerStatus(host, `Saved copy “${res.projectName}”.`);
      renderCustomPatternEditingBanner(host);
    }
  } finally {
    setEditingBannerCopyTriggersDisabled(host, false);
  }
}

let bannerHostClickBound = false;

function bindBannerHostActions(host: HTMLElement): void {
  if (bannerHostClickBound) return;
  bannerHostClickBound = true;

  host.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;

    if (t.closest(CB_EDITING_BANNER_CANCEL_SELECTOR)) {
      ev.preventDefault();
      setBannerStatus(host, "");
      exitEditingSavedCustomPattern();
      renderCustomPatternEditingBanner(host);
      return;
    }

    const copyTrigger = t.closest(CB_EDITING_BANNER_COPY_SELECTOR);
    if (copyTrigger) {
      ev.preventDefault();
      if (copyTrigger instanceof HTMLButtonElement && copyTrigger.disabled) return;
      void performEditingBannerCopy(host);
      return;
    }

    if (!isCustomPatternEditingBannerUpdateTarget(t)) return;

    ev.preventDefault();
    void performEditingBannerUpdate(host);
  });
}

export function initCustomPatternEditingBanner(root: ParentNode = document): () => void {
  const host = root.querySelector?.("[data-cb-editing-banner-host]");
  if (!(host instanceof HTMLElement)) return () => {};

  bindBannerHostActions(host);

  let raf = 0;
  const schedule = (): void => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      renderCustomPatternEditingBanner(host);
    });
  };

  schedule();

  const onStorage = (ev: StorageEvent): void => {
    if (!ev.key) return;
    if (ev.key.startsWith("kbm_custom_pattern_active_project_") || ev.key === "kbm_current_pattern") {
      schedule();
    }
  };

  const onInput = (ev: Event): void => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    if (
      t.closest?.("[data-cb-project-name]") ||
      t.closest?.("[data-sleeveless-pattern-project-title]") ||
      t.closest?.("[data-sleeveless-edit-customize='title']")
    ) {
      schedule();
    }
  };

  const onEditingStateChanged = (): void => schedule();

  window.addEventListener("storage", onStorage);
  document.addEventListener("input", onInput, true);
  document.addEventListener("change", onInput, true);
  document.addEventListener(CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT, onEditingStateChanged);

  const onClick = (ev: Event): void => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    if (!isEditingSavedCustomPatternProject()) return;

    const flushRoot = resolveCustomBuildMeasureFlushRoot(document);
    prepareCustomBuildPatternGeneration({ root: flushRoot });
    if (!hasUnsavedSavedCustomPatternChanges()) return;

    const link = t.closest("a");
    if (!(link instanceof HTMLAnchorElement)) return;
    const href = link.getAttribute("href")?.trim() ?? "";
    if (!href) return;

    // Workspace tabs + other “view pattern” links should not implicitly save.
    // We only guard navigations to the pattern reading pages.
    const isPatternNav =
      link.getAttribute("data-tab") === "pattern" ||
      href.startsWith("/patterns/sleeveless/pattern") ||
      href.startsWith("/patterns/sleeveless/pattern/");
    if (!isPatternNav) return;

    ev.preventDefault();
    void navigateToPatternWithUnsavedEditsGuard({ href: link.href, root: host.ownerDocument });
  };

  document.addEventListener("click", onClick, true);

  return () => {
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("change", onInput, true);
    document.removeEventListener(CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT, onEditingStateChanged);
    document.removeEventListener("click", onClick, true);
    if (raf) window.cancelAnimationFrame(raf);
    document.documentElement.classList.remove("kbm-editing-saved-pattern");
  };
}
