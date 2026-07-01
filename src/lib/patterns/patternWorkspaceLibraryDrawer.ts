/**
 * Saved-pattern library drawer beside pattern workspace tabs.
 * View/open only — does not replace account dashboard or inline save panels.
 */
import { listCustomPatternProjects } from "./customPatternProjectClient";
import type { CustomPatternProjectSummary } from "./customPatternProjectTypes";
import { readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";
import { copySavedCustomPatternProjectById } from "./savedCustomPatternManageActions";
import {
  canCopySavedCustomPatternForAccess,
  SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT,
  syncSavedCustomPatternCopyAccessForAccess,
} from "./savedCustomPatternCopyAccess";
import { SAVED_CUSTOM_PATTERN_EDIT_DISABLED_TEXT } from "./accountMyPatternsList";
import {
  canEditSleevelessPatternSettings,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import { offerPatternEditingUnlockModal } from "./patternEditingUnlockModal";
import { formatSavedPatternGauge } from "./savedPatternGaugeDisplay";

const SIGN_IN_REQUIRED_ERROR = "Sign in to save Custom Pattern projects.";
export const PATTERN_WORKSPACE_LIBRARY_DRAWER_OPEN_CLASS =
  "pattern-workspace-library-drawer-open";

export function formatCustomPatternProjectType(project: CustomPatternProjectSummary): string {
  // User-facing pattern type only — internal workflow source (Express / Custom Build) is not shown.
  const familyLabels: Record<string, string> = {
    sleeveless: "Sleeveless",
  };
  const family = project.family ? (familyLabels[project.family] ?? project.family) : "";
  return family || "—";
}

export function formatCustomPatternProjectUpdatedAt(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

/**
 * Compact drawer meta line, e.g. `"Sleeveless • 7 sts / 11 rows • May 31, 2026"`.
 * Gauge is shown when available and omitted (rather than blanked) when missing.
 */
export function buildCustomPatternProjectMetaLine(project: CustomPatternProjectSummary): string {
  const parts = [formatCustomPatternProjectType(project)];
  if (project.gauge) {
    parts.push(formatSavedPatternGauge(project.gauge));
  }
  const stamp = formatCustomPatternProjectUpdatedAt(project.updatedAt);
  if (stamp) parts.push(stamp);
  return parts.filter(Boolean).join(" • ");
}

/** Drawer card lines — gauge on its own row for easier scanning. */
export function buildCustomPatternProjectDrawerLines(project: CustomPatternProjectSummary): {
  contextLine: string;
  gaugeLine: string;
} {
  const contextParts = [formatCustomPatternProjectType(project)];
  const stamp = formatCustomPatternProjectUpdatedAt(project.updatedAt);
  if (stamp) contextParts.push(stamp);
  return {
    contextLine: contextParts.filter(Boolean).join(" • "),
    gaugeLine: formatSavedPatternGauge(project.gauge),
  };
}

export function formatPatternCopiedDrawerMessage(projectName: string): string {
  const trimmed = projectName.trim();
  if (trimmed) {
    return `Pattern copied. “${trimmed}” is ready to edit.`;
  }
  return "Pattern copied. Your new copy is ready to edit.";
}

let lastCopiedProjectIdInDrawer: string | null = null;
let lastResolvedLibraryAccess: SleevelessUserAccess | null = null;

function syncLibraryOpenAccess(
  openButton: HTMLButtonElement | null | undefined,
  access: SleevelessUserAccess | null,
): boolean {
  if (!(openButton instanceof HTMLButtonElement)) return false;
  const canEdit = access ? canEditSleevelessPatternSettings(access) : false;
  openButton.disabled = false;
  openButton.classList.toggle("is-disabled", !canEdit);
  if (canEdit) {
    openButton.removeAttribute("aria-disabled");
    openButton.removeAttribute("title");
  } else {
    openButton.setAttribute("aria-disabled", "true");
    openButton.setAttribute("title", SAVED_CUSTOM_PATTERN_EDIT_DISABLED_TEXT);
  }
  return canEdit;
}

function syncLibraryItemAccess(
  openButton: HTMLButtonElement | null | undefined,
  copyButton: HTMLButtonElement | null | undefined,
  access: SleevelessUserAccess | null,
): void {
  syncLibraryOpenAccess(openButton, access);
  syncSavedCustomPatternCopyAccessForAccess(copyButton, access);
}

function clearDrawerCopyHighlight(): void {
  lastCopiedProjectIdInDrawer = null;
}

/** Test hook — reset drawer copy highlight state between tests. */
export function resetPatternWorkspaceLibraryDrawerSessionState(): void {
  clearDrawerCopyHighlight();
  lastResolvedLibraryAccess = null;
}

function setDrawerStatus(root: HTMLElement, message: string, isError = false): void {
  const el = root.querySelector("[data-pattern-workspace-library-status]");
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.hidden = !message;
  el.classList.toggle("pattern-workspace-library__status--error", isError);
}

function setDrawerLibraryEmptyState(root: HTMLElement): void {
  const el = root.querySelector("[data-pattern-workspace-library-status]");
  if (!(el instanceof HTMLElement)) return;
  el.replaceChildren();
  el.hidden = false;
  el.classList.remove("pattern-workspace-library__status--error");

  const heading = document.createElement("p");
  heading.className = "pattern-workspace-library__status-heading";
  heading.textContent = "You haven't saved any patterns yet.";

  const body = document.createElement("p");
  body.className = "pattern-workspace-library__status-body";
  body.textContent = "Build your first pattern and it will appear here for easy access.";

  const ctaWrap = document.createElement("div");
  ctaWrap.className = "pattern-workspace-library__status-cta";

  const cta = document.createElement("a");
  cta.className = "kbm-btn kbm-btn-primary pattern-workspace-library__status-btn";
  cta.href = "/patterns";
  cta.textContent = "Build Your First Pattern";

  ctaWrap.append(cta);
  el.append(heading, body, ctaWrap);
}

function setListVisible(root: HTMLElement, visible: boolean): void {
  const list = root.querySelector("[data-pattern-workspace-library-list]");
  if (list instanceof HTMLElement) list.hidden = !visible;
}

function renderLibraryItem(
  root: HTMLElement,
  project: CustomPatternProjectSummary,
  displayName: string,
  options?: { isNewCopy?: boolean },
): void {
  const list = root.querySelector("[data-pattern-workspace-library-list]");
  if (!(list instanceof HTMLElement)) return;

  const activeId = readActiveCustomPatternProjectId();
  const li = document.createElement("li");
  li.className = "pattern-workspace-library__item";

  const card = document.createElement("div");
  card.className = "pattern-workspace-library__item-card";
  card.setAttribute("data-pattern-workspace-library-item-card", "");
  card.dataset.projectId = project.id;
  if (project.id === activeId) {
    card.classList.add("is-active");
  }
  if (options?.isNewCopy) {
    card.classList.add("is-new-copy");
  }

  const body = document.createElement("div");
  body.className = "pattern-workspace-library__item-body";

  const titleRow = document.createElement("div");
  titleRow.className = "pattern-workspace-library__item-title-row";

  const nameEl = document.createElement("span");
  nameEl.className = "pattern-workspace-library__item-name";
  nameEl.textContent = displayName;

  titleRow.append(nameEl);

  if (options?.isNewCopy) {
    const badge = document.createElement("span");
    badge.className = "pattern-workspace-library__item-badge";
    badge.textContent = "New copy";
    titleRow.append(badge);
  }

  const { contextLine, gaugeLine } = buildCustomPatternProjectDrawerLines(project);

  const contextEl = document.createElement("span");
  contextEl.className = "pattern-workspace-library__item-context";
  contextEl.textContent = contextLine;

  const gaugeEl = document.createElement("span");
  gaugeEl.className = "pattern-workspace-library__item-gauge";
  gaugeEl.textContent = gaugeLine;

  body.append(titleRow, contextEl, gaugeEl);

  const actions = document.createElement("div");
  actions.className = "pattern-workspace-library__item-actions";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "pattern-workspace-library__item-action pattern-workspace-library__item-open";
  openBtn.setAttribute("data-pattern-workspace-library-open", "");
  openBtn.dataset.projectId = project.id;
  if (project.id === activeId) openBtn.setAttribute("aria-current", "true");
  openBtn.setAttribute("aria-label", `Open ${displayName}`);
  openBtn.textContent = "Open Pattern";
  openBtn.addEventListener("click", async () => {
    if (openBtn.disabled) return;
    if (!canEditSleevelessPatternSettings(lastResolvedLibraryAccess)) {
      offerPatternEditingUnlockModal(lastResolvedLibraryAccess);
      return;
    }
    await onLibraryProjectOpen(root, project.id, displayName);
  });

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className =
    "pattern-workspace-library__item-action pattern-workspace-library__item-action--secondary pattern-workspace-library__item-copy";
  copyBtn.setAttribute("data-pattern-workspace-library-copy", "");
  copyBtn.dataset.projectId = project.id;
  copyBtn.setAttribute("aria-label", `Copy ${displayName}`);
  copyBtn.textContent = "Copy Pattern";
  copyBtn.addEventListener("click", async () => {
    if (copyBtn.disabled) return;
    if (!canCopySavedCustomPatternForAccess(lastResolvedLibraryAccess)) {
      offerPatternEditingUnlockModal(lastResolvedLibraryAccess);
      return;
    }
    await onLibraryProjectCopy(root, project.id, displayName);
  });
  syncLibraryItemAccess(openBtn, copyBtn, lastResolvedLibraryAccess);

  actions.append(openBtn, copyBtn);
  card.append(body, actions);
  li.append(card);
  list.append(li);
}

async function onLibraryProjectCopy(
  root: HTMLElement,
  projectId: string,
  label: string,
): Promise<void> {
  if (!canCopySavedCustomPatternForAccess(lastResolvedLibraryAccess)) {
    offerPatternEditingUnlockModal(lastResolvedLibraryAccess);
    return;
  }

  setDrawerStatus(root, `Copying “${label}”…`);
  setDrawerActionButtonsDisabled(root, true);

  try {
    const result = await copySavedCustomPatternProjectById(projectId, "sleeveless");
    if (!result.ok) {
      setDrawerStatus(root, result.error, true);
      return;
    }
    lastCopiedProjectIdInDrawer = result.project.id;
    await refreshPatternWorkspaceLibraryList(root, { highlightProjectId: result.project.id });
    setDrawerStatus(root, formatPatternCopiedDrawerMessage(result.project.name ?? ""));
  } catch {
    setDrawerStatus(root, "Could not copy this pattern. Please try again.", true);
  } finally {
    setDrawerActionButtonsDisabled(root, false);
  }
}

function setDrawerActionButtonsDisabled(root: HTMLElement, disabled: boolean): void {
  root.querySelectorAll<HTMLButtonElement>("[data-pattern-workspace-library-open]").forEach((button) => {
    button.disabled = disabled;
    if (!disabled) syncLibraryOpenAccess(button, lastResolvedLibraryAccess);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-pattern-workspace-library-copy]").forEach((button) => {
    button.disabled = disabled;
    if (!disabled) syncSavedCustomPatternCopyAccessForAccess(button, lastResolvedLibraryAccess);
  });
}

async function onLibraryProjectOpen(
  root: HTMLElement,
  projectId: string,
  label: string,
): Promise<void> {
  if (!lastResolvedLibraryAccess || !canEditSleevelessPatternSettings(lastResolvedLibraryAccess)) {
    offerPatternEditingUnlockModal(lastResolvedLibraryAccess);
    return;
  }
  setDrawerStatus(root, `Loading “${label}”…`);
  setDrawerActionButtonsDisabled(root, true);

  try {
    const result = await loadSavedCustomPatternProject(projectId, "open");
    if (!result.ok) {
      setDrawerStatus(root, result.error, true);
      return;
    }
    setDrawerStatus(root, "");
    window.location.assign(result.redirectHref);
  } catch {
    setDrawerStatus(root, "Could not open this pattern. Please try again.", true);
  } finally {
    setDrawerActionButtonsDisabled(root, false);
  }
}

export async function refreshPatternWorkspaceLibraryList(
  root: HTMLElement,
  options?: { highlightProjectId?: string | null },
): Promise<void> {
  setDrawerStatus(root, "Loading your saved patterns…");
  setListVisible(root, false);

  const list = root.querySelector("[data-pattern-workspace-library-list]");
  if (list instanceof HTMLElement) list.replaceChildren();

  const res = await listCustomPatternProjects("sleeveless");
  if (!res.ok) {
    const message =
      res.error === SIGN_IN_REQUIRED_ERROR
        ? "Sign in to view your saved patterns."
        : res.error;
    setDrawerStatus(root, message, res.error !== SIGN_IN_REQUIRED_ERROR);
    return;
  }

  if (res.projects.length === 0) {
    setDrawerLibraryEmptyState(root);
    return;
  }

  lastResolvedLibraryAccess = await resolveSleevelessUserAccessSnapshot();

  const highlightProjectId =
    options?.highlightProjectId !== undefined
      ? options.highlightProjectId
      : lastCopiedProjectIdInDrawer;

  const sorted = [...res.projects].sort((a, b) => {
    if (highlightProjectId) {
      if (a.id === highlightProjectId) return -1;
      if (b.id === highlightProjectId) return 1;
    }
    return String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));
  });
  for (const project of sorted) {
    renderLibraryItem(root, project, project.name || "Untitled pattern", {
      isNewCopy: highlightProjectId !== null && project.id === highlightProjectId,
    });
  }
  setDrawerStatus(root, "");
  setListVisible(root, true);
}

export type PatternWorkspaceLibraryDrawerBindings = {
  drawer: HTMLElement;
  panel: HTMLElement;
  trigger: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  backdrop: HTMLElement;
};

export function resolvePatternWorkspaceLibraryDrawerBindings(
  doc: Document = document,
): PatternWorkspaceLibraryDrawerBindings | null {
  const drawer = doc.querySelector("[data-pattern-workspace-library-drawer]");
  const panel = doc.querySelector("#pattern-workspace-library-drawer-panel");
  const trigger = doc.querySelector("[data-pattern-workspace-library-trigger]");
  const closeBtn = doc.querySelector("[data-pattern-workspace-library-close]");
  const backdrop = doc.querySelector("[data-pattern-workspace-library-backdrop]");

  if (
    !(drawer instanceof HTMLElement) ||
    !(panel instanceof HTMLElement) ||
    !(trigger instanceof HTMLButtonElement) ||
    !(closeBtn instanceof HTMLButtonElement) ||
    !(backdrop instanceof HTMLElement)
  ) {
    return null;
  }

  return { drawer, panel, trigger, closeBtn, backdrop };
}

let lastFocusBeforeOpen: HTMLElement | null = null;

export function openPatternWorkspaceLibraryDrawer(bindings: PatternWorkspaceLibraryDrawerBindings): void {
  const { drawer, panel, trigger } = bindings;
  const doc = drawer.ownerDocument;
  lastFocusBeforeOpen =
    doc.activeElement instanceof HTMLElement ? doc.activeElement : null;

  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  panel.setAttribute("aria-hidden", "false");
  trigger.setAttribute("aria-expanded", "true");
  doc.body.classList.add(PATTERN_WORKSPACE_LIBRARY_DRAWER_OPEN_CLASS);

  void refreshPatternWorkspaceLibraryList(drawer);
  closeBtnFocus(bindings);
}

export function closePatternWorkspaceLibraryDrawer(bindings: PatternWorkspaceLibraryDrawerBindings): void {
  const { drawer, panel, trigger } = bindings;
  const doc = drawer.ownerDocument;

  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  panel.setAttribute("aria-hidden", "true");
  trigger.setAttribute("aria-expanded", "false");
  doc.body.classList.remove(PATTERN_WORKSPACE_LIBRARY_DRAWER_OPEN_CLASS);

  if (lastFocusBeforeOpen && doc.contains(lastFocusBeforeOpen)) {
    lastFocusBeforeOpen.focus();
  } else {
    trigger.focus();
  }
  lastFocusBeforeOpen = null;
  clearDrawerCopyHighlight();
}

function closeBtnFocus(bindings: PatternWorkspaceLibraryDrawerBindings): void {
  bindings.closeBtn.focus();
}

export function isPatternWorkspaceLibraryDrawerOpen(
  bindings: PatternWorkspaceLibraryDrawerBindings,
): boolean {
  return bindings.drawer.classList.contains("is-open");
}

export function initPatternWorkspaceLibraryDrawer(doc: Document = document): void {
  const bindings = resolvePatternWorkspaceLibraryDrawerBindings(doc);
  if (!bindings) return;

  const { drawer, trigger, closeBtn, backdrop } = bindings;

  trigger.addEventListener("click", () => {
    if (isPatternWorkspaceLibraryDrawerOpen(bindings)) {
      closePatternWorkspaceLibraryDrawer(bindings);
    } else {
      openPatternWorkspaceLibraryDrawer(bindings);
    }
  });

  closeBtn.addEventListener("click", () => closePatternWorkspaceLibraryDrawer(bindings));
  backdrop.addEventListener("click", () => closePatternWorkspaceLibraryDrawer(bindings));

  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!isPatternWorkspaceLibraryDrawerOpen(bindings)) return;
    event.preventDefault();
    closePatternWorkspaceLibraryDrawer(bindings);
  });
}
