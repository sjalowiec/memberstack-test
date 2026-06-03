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
  canCopySavedCustomPattern,
  SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT,
  syncSavedCustomPatternCopyAccess,
} from "./savedCustomPatternCopyAccess";
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

function setDrawerStatus(root: HTMLElement, message: string, isError = false): void {
  const el = root.querySelector("[data-pattern-workspace-library-status]");
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.hidden = !message;
  el.classList.toggle("pattern-workspace-library__status--error", isError);
}

function setListVisible(root: HTMLElement, visible: boolean): void {
  const list = root.querySelector("[data-pattern-workspace-library-list]");
  if (list instanceof HTMLElement) list.hidden = !visible;
}

function renderLibraryItem(
  root: HTMLElement,
  project: CustomPatternProjectSummary,
  displayName: string,
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

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pattern-workspace-library__item-btn";
  btn.setAttribute("data-pattern-workspace-library-item", "");
  btn.dataset.projectId = project.id;
  if (project.id === activeId) btn.setAttribute("aria-current", "true");
  btn.setAttribute("aria-label", `Open ${displayName}`);

  const nameEl = document.createElement("span");
  nameEl.className = "pattern-workspace-library__item-name";
  nameEl.textContent = displayName;

  const metaEl = document.createElement("span");
  metaEl.className = "pattern-workspace-library__item-meta";
  metaEl.textContent = buildCustomPatternProjectMetaLine(project);

  btn.append(nameEl, metaEl);
  btn.addEventListener("click", async () => {
    if (btn.disabled) return;
    await onLibraryProjectOpen(root, project.id, displayName, btn);
  });

  const actions = document.createElement("div");
  actions.className = "pattern-workspace-library__item-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "pattern-workspace-library__item-action pattern-workspace-library__item-copy";
  copyBtn.setAttribute("data-pattern-workspace-library-copy", "");
  copyBtn.dataset.projectId = project.id;
  copyBtn.setAttribute("aria-label", `Copy ${displayName}`);
  copyBtn.textContent = "Copy Pattern";
  copyBtn.addEventListener("click", async () => {
    if (copyBtn.disabled) return;
    await onLibraryProjectCopy(root, project.id, displayName);
  });
  // Visible for everyone; disabled + grayed (helper tooltip) for free / non-owner users.
  syncSavedCustomPatternCopyAccess(copyBtn);

  actions.append(copyBtn);
  card.append(btn, actions);
  li.append(card);
  list.append(li);
}

async function onLibraryProjectCopy(
  root: HTMLElement,
  projectId: string,
  label: string,
): Promise<void> {
  if (!canCopySavedCustomPattern()) {
    setDrawerStatus(root, SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT, true);
    return;
  }

  setDrawerStatus(root, `Copying “${label}”…`);
  const copyButtons = root.querySelectorAll<HTMLButtonElement>("[data-pattern-workspace-library-copy]");
  copyButtons.forEach((b) => {
    b.disabled = true;
  });

  try {
    const result = await copySavedCustomPatternProjectById(projectId, "sleeveless");
    if (!result.ok) {
      setDrawerStatus(root, result.error, true);
      return;
    }
    await refreshPatternWorkspaceLibraryList(root);
    setDrawerStatus(root, `Created “${result.project.name}”.`);
  } catch {
    setDrawerStatus(root, "Could not copy this pattern. Please try again.", true);
  } finally {
    root
      .querySelectorAll<HTMLButtonElement>("[data-pattern-workspace-library-copy]")
      .forEach((b) => syncSavedCustomPatternCopyAccess(b));
  }
}

async function onLibraryProjectOpen(
  root: HTMLElement,
  projectId: string,
  label: string,
  trigger: HTMLButtonElement,
): Promise<void> {
  setDrawerStatus(root, `Loading “${label}”…`);
  const openItems = root.querySelectorAll<HTMLButtonElement>("[data-pattern-workspace-library-item]");
  openItems.forEach((item) => {
    item.disabled = true;
  });

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
    openItems.forEach((item) => {
      item.disabled = false;
    });
    trigger.disabled = false;
  }
}

export async function refreshPatternWorkspaceLibraryList(root: HTMLElement): Promise<void> {
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
    setDrawerStatus(
      root,
      "No saved patterns yet. Save a project from Create or Customize to see it here.",
    );
    return;
  }

  const sorted = [...res.projects].sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
  for (const project of sorted) {
    renderLibraryItem(root, project, project.name || "Untitled pattern");
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
