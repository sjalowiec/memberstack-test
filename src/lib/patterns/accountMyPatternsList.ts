/**
 * Saved patterns list on /account — load, open, sort, and delete saved projects.
 */
import { listCustomPatternProjects } from "./customPatternProjectClient";
import type { CustomPatternProject, CustomPatternProjectSummary } from "./customPatternProjectTypes";
import { deleteSavedCustomPatternProject } from "./deleteSavedCustomPatternProject";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";
import {
  copySavedCustomPatternProjectById,
  renameSavedCustomPatternProject,
} from "./savedCustomPatternManageActions";
import {
  canCopySavedCustomPatternForAccess,
  SAVED_CUSTOM_PATTERN_COPY_DISABLED_TEXT,
  syncSavedCustomPatternCopyAccessForAccess,
} from "./savedCustomPatternCopyAccess";
import {
  memberstackReadinessSnapshot,
  nextAccountListRender,
  perfEnd,
  perfMark,
  perfStart,
} from "./savedPatternsPerfLog";
import {
  extractSavedPatternGauge,
  formatSavedPatternGauge,
} from "./savedPatternGaugeDisplay";
import {
  isSleevelessPatternDeleteProtected,
  SLEEVELESS_FREE_PATTERN_DELETE_BLOCKED_TEXT,
} from "./sleevelessPatternDeleteGuard";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import { offerPatternEditingUnlockModal } from "./patternEditingUnlockModal";
import {
  canEditSleevelessPatternSettings,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";

const SIGN_IN_REQUIRED_ERROR = "Sign in to save Custom Pattern projects.";
/** Tooltip shown when Edit is disabled for a free claimed / downgraded knitter. */
export const SAVED_CUSTOM_PATTERN_EDIT_DISABLED_TEXT =
  "Pattern editing is included with membership. You can still view, print, and rename this pattern.";
const EMPTY_LIST_MESSAGE =
  "You do not have any saved patterns yet. Create your first pattern to get started.";
export const DELETE_SAVED_PATTERN_CONFIRM_MESSAGE = "Delete this saved pattern?";
export const RENAME_SAVED_PATTERN_PROMPT_MESSAGE = "Rename this saved pattern:";

function toProjectSummary(project: CustomPatternProject): CustomPatternProjectSummary {
  const gauge = extractSavedPatternGauge(project.pattern?.yarnGauge);
  return {
    id: project.id,
    name: project.name,
    family: project.family,
    source: project.source,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    version: project.version,
    ...(gauge ? { gauge } : {}),
  };
}

type SortColumn = "name" | "updatedAt";
type SortDirection = "asc" | "desc";

type ListState = {
  projects: CustomPatternProjectSummary[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  /** Resolved Sleeveless access; gates which Delete buttons are protected. Null until resolved. */
  access: SleevelessUserAccess | null;
};

const listStateByRoot = new WeakMap<HTMLElement, ListState>();

function formatUpdatedAt(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      dateStyle: "long",
    });
  } catch {
    return iso;
  }
}

function setStatus(root: HTMLElement, message: string, isError = false): void {
  const el = root.querySelector("[data-kbm-my-patterns-status]");
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.hidden = false;
  el.classList.toggle("account-my-patterns__status--error", isError);
}

function hideStatus(root: HTMLElement): void {
  const el = root.querySelector("[data-kbm-my-patterns-status]");
  if (el instanceof HTMLElement) el.hidden = true;
}

function formatProjectType(project: CustomPatternProjectSummary): string {
  // User-facing pattern type only — internal workflow source (Express / Custom Build) is not shown.
  const familyLabels: Record<string, string> = {
    sleeveless: "Sleeveless",
  };
  const family = project.family ? (familyLabels[project.family] ?? project.family) : "";
  return family || "—";
}

function compareProjects(
  root: HTMLElement,
  a: CustomPatternProjectSummary,
  b: CustomPatternProjectSummary,
): number {
  const state = listStateByRoot.get(root);
  if (!state) return 0;

  const { sortColumn, sortDirection } = state;
  let cmp = 0;
  if (sortColumn === "name") {
    const nameA = (a.name || "Untitled pattern").toLocaleLowerCase();
    const nameB = (b.name || "Untitled pattern").toLocaleLowerCase();
    cmp = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  } else {
    cmp = String(a.updatedAt ?? "").localeCompare(String(b.updatedAt ?? ""));
  }
  return sortDirection === "asc" ? cmp : -cmp;
}

function sortedProjects(
  root: HTMLElement,
  projects: CustomPatternProjectSummary[],
): CustomPatternProjectSummary[] {
  return [...projects].sort((a, b) => compareProjects(root, a, b));
}

function setListVisible(root: HTMLElement, visible: boolean): void {
  const wrap = root.querySelector("[data-kbm-my-patterns-list-wrap]");
  if (wrap instanceof HTMLElement) wrap.hidden = !visible;
}

/** Shows/hides the empty-state "Create a Pattern" call to action. */
function setEmptyCtaVisible(root: HTMLElement, visible: boolean): void {
  const cta = root.querySelector("[data-kbm-my-patterns-empty-cta]");
  if (cta instanceof HTMLElement) cta.hidden = !visible;
}

function updateSortHeaders(root: HTMLElement): void {
  const state = listStateByRoot.get(root);
  if (!state) return;

  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-sort]").forEach((btn) => {
    const column = btn.getAttribute("data-kbm-my-patterns-sort") as SortColumn | null;
    const indicator = btn.querySelector(".account-my-patterns__sort-indicator");
    const active = column === state.sortColumn;
    const ariaSort = active
      ? state.sortDirection === "asc"
        ? "ascending"
        : "descending"
      : "none";
    btn.setAttribute("aria-sort", ariaSort);
    btn.classList.toggle("account-my-patterns__sort--active", active);
    if (indicator instanceof HTMLElement) {
      indicator.textContent = active ? (state.sortDirection === "asc" ? "↑" : "↓") : "";
    }
  });
}

const ROW_ACTION_SELECTORS = [
  "[data-kbm-my-patterns-view]",
  "[data-kbm-my-patterns-edit]",
  "[data-kbm-my-patterns-copy]",
  "[data-kbm-my-patterns-rename]",
  "[data-kbm-my-patterns-delete]",
] as const;

function lockMyPatternsListInteraction(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-kbm-my-patterns-row]").forEach((row) => {
    row.setAttribute("aria-disabled", "true");
    row.tabIndex = -1;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-sort]").forEach((b) => {
    b.disabled = true;
  });
  for (const selector of ROW_ACTION_SELECTORS) {
    root.querySelectorAll<HTMLButtonElement>(selector).forEach((b) => {
      b.disabled = true;
    });
  }
}

function releaseMyPatternsListInteraction(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-kbm-my-patterns-row]").forEach((row) => {
    row.removeAttribute("aria-disabled");
    row.tabIndex = 0;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-sort]").forEach((b) => {
    b.disabled = false;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-view]").forEach((b) => {
    b.disabled = false;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-rename]").forEach((b) => {
    b.disabled = false;
  });
  // Delete stays gated: a free user's protected pattern must remain non-deletable after unlock.
  syncMyPatternsDeleteAccess(root);
  // Edit + Copy stay gated by entitlement even after the list unlocks (view-only users).
  syncMyPatternsEditAccess(root);
  syncMyPatternsCopyAccess(root);
}

/** Resolved access for this list, or null until it resolves (or if resolution failed). */
function listAccess(root: HTMLElement): SleevelessUserAccess | null {
  return listStateByRoot.get(root)?.access ?? null;
}

/**
 * Whether the current knitter may edit a saved pattern's settings (Express Setup, measurements,
 * gauge, regenerate). Until access resolves we default to locked so free users are not briefly
 * unlocked.
 */
function canEditSavedPatternFromList(root: HTMLElement): boolean {
  const access = listAccess(root);
  return access ? canEditSleevelessPatternSettings(access) : false;
}

/** Reflects edit-access onto a single Edit button: disabled + grayed + tooltip for view-only users. */
function applyEditAccessToButton(
  btn: HTMLButtonElement | null | undefined,
  access: SleevelessUserAccess | null,
): void {
  if (!btn) return;
  const canEdit = access ? canEditSleevelessPatternSettings(access) : false;
  btn.disabled = false;
  btn.classList.toggle("is-disabled", !canEdit);
  if (canEdit) {
    btn.removeAttribute("aria-disabled");
    btn.removeAttribute("title");
  } else {
    btn.setAttribute("aria-disabled", "true");
    btn.setAttribute("title", SAVED_CUSTOM_PATTERN_EDIT_DISABLED_TEXT);
  }
}

/** Reflects edit-access onto every Edit button (used after the list unlocks post-action). */
function syncMyPatternsEditAccess(root: HTMLElement): void {
  const access = listAccess(root);
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-edit]").forEach((btn) => {
    applyEditAccessToButton(btn, access);
  });
}

/** Reflects copy-access (from resolved access) onto every Copy button. */
function syncMyPatternsCopyAccess(root: HTMLElement): void {
  const access = listAccess(root);
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-copy]").forEach((btn) => {
    syncSavedCustomPatternCopyAccessForAccess(btn, access);
  });
}

/** Returns true when the given project id is the free user's protected (non-deletable) pattern. */
function isProtectedDeleteTarget(root: HTMLElement, projectId: string): boolean {
  const state = listStateByRoot.get(root);
  if (!state?.access) return false;
  return isSleevelessPatternDeleteProtected({
    access: state.access,
    projectId,
    totalSavedCount: state.projects.length,
  });
}

/**
 * Reflects free-pattern delete protection onto every Delete button: the protected pattern's button
 * is disabled, grayed, and given an explanatory tooltip; all others are enabled. Never hides.
 */
function syncMyPatternsDeleteAccess(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-delete]").forEach((btn) => {
    const projectId = btn.dataset.projectId ?? "";
    const protectedTarget = isProtectedDeleteTarget(root, projectId);
    btn.disabled = protectedTarget;
    btn.classList.toggle("is-disabled", protectedTarget);
    if (protectedTarget) {
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("title", SLEEVELESS_FREE_PATTERN_DELETE_BLOCKED_TEXT);
    } else {
      btn.removeAttribute("aria-disabled");
      btn.removeAttribute("title");
    }
  });
}

function showEmptyListState(root: HTMLElement): void {
  listStateByRoot.delete(root);
  const tbody = root.querySelector("[data-kbm-my-patterns-list]");
  if (tbody instanceof HTMLElement) tbody.replaceChildren();
  setListVisible(root, false);
  setStatus(root, EMPTY_LIST_MESSAGE);
  setEmptyCtaVisible(root, true);
}

async function onProjectView(root: HTMLElement, projectId: string, label: string): Promise<void> {
  const actionStart = perfStart();
  perfMark("6-account-list-action start", { action: "view", projectId, label });
  setStatus(root, `Loading “${label}”…`);
  lockMyPatternsListInteraction(root);

  try {
    const loadStart = perfStart();
    const result = await loadSavedCustomPatternProject(projectId, "view");
    perfEnd("6-account-list-action loadSavedCustomPatternProject", loadStart, {
      action: "view",
      projectId,
      ok: result.ok,
    });
    if (!result.ok) {
      setStatus(root, result.error, true);
      perfEnd("6-account-list-action total", actionStart, { action: "view", ok: false });
      return;
    }

    perfEnd("6-account-list-action total", actionStart, {
      action: "view",
      ok: true,
      redirect: result.redirectHref,
    });
    setStatus(root, "");
    window.location.assign(result.redirectHref);
  } catch (error) {
    console.error("[kbm] Failed to view saved pattern from My Patterns.", error);
    setStatus(root, "Could not open this pattern. Please try again.", true);
    perfEnd("6-account-list-action total", actionStart, { action: "view", ok: false, thrown: true });
  } finally {
    releaseMyPatternsListInteraction(root);
  }
}

async function onProjectEdit(root: HTMLElement, projectId: string, label: string): Promise<void> {
  // Guard before loading: a free claimed / downgraded knitter cannot open the editable builder.
  // The Edit button is styled as disabled for them, but guard the handler too for keyboard paths.
  const access = listAccess(root);
  if (!canEditSavedPatternFromList(root)) {
    offerPatternEditingUnlockModal(access);
    return;
  }

  const actionStart = perfStart();
  perfMark("6-account-list-action start", { action: "open", projectId, label });
  setStatus(root, `Opening “${label}” for editing…`);
  lockMyPatternsListInteraction(root);

  try {
    const loadStart = perfStart();
    const result = await loadSavedCustomPatternProject(projectId, "open");
    perfEnd("6-account-list-action loadSavedCustomPatternProject", loadStart, {
      action: "open",
      projectId,
      ok: result.ok,
    });
    if (!result.ok) {
      setStatus(root, result.error, true);
      perfEnd("6-account-list-action total", actionStart, { action: "open", ok: false });
      return;
    }

    perfEnd("6-account-list-action total", actionStart, {
      action: "open",
      ok: true,
      redirect: result.redirectHref,
    });
    setStatus(root, "");
    window.location.assign(result.redirectHref);
  } catch (error) {
    console.error("[kbm] Failed to open saved pattern for editing from My Patterns.", error);
    setStatus(root, "Could not open this pattern for editing. Please try again.", true);
    perfEnd("6-account-list-action total", actionStart, { action: "open", ok: false, thrown: true });
  } finally {
    releaseMyPatternsListInteraction(root);
  }
}

async function onProjectDelete(
  root: HTMLElement,
  projectId: string,
  label: string,
): Promise<void> {
  // Guard before the confirm dialog: a free user's protected pattern can never be deleted.
  if (isProtectedDeleteTarget(root, projectId)) {
    setStatus(root, SLEEVELESS_FREE_PATTERN_DELETE_BLOCKED_TEXT, true);
    return;
  }

  const confirmed = window.confirm(DELETE_SAVED_PATTERN_CONFIRM_MESSAGE);
  if (!confirmed) return;

  const savedCountBeforeDelete = listStateByRoot.get(root)?.projects.length;

  const actionStart = perfStart();
  perfMark("6-account-list-action start", { action: "delete", projectId, label });
  setStatus(root, `Deleting “${label}”…`);
  lockMyPatternsListInteraction(root);

  try {
    const deleteStart = perfStart();
    const result = await deleteSavedCustomPatternProject(projectId, "sleeveless", {
      totalSavedCount: savedCountBeforeDelete,
    });
    perfEnd("6-account-list-action deleteSavedCustomPatternProject", deleteStart, {
      action: "delete",
      projectId,
      ok: result.ok,
    });
    if (!result.ok) {
      setStatus(root, result.error, true);
      perfEnd("6-account-list-action total", actionStart, { action: "delete", ok: false });
      return;
    }

    const state = listStateByRoot.get(root);
    if (!state) {
      perfEnd("6-account-list-action total", actionStart, { action: "delete", ok: true, noState: true });
      return;
    }

    state.projects = state.projects.filter((project) => project.id !== projectId);
    if (state.projects.length === 0) {
      showEmptyListState(root);
      perfEnd("6-account-list-action total", actionStart, {
        action: "delete",
        ok: true,
        outcome: "empty-list",
      });
      return;
    }

    hideStatus(root);
    renderProjectList(root);
    perfEnd("6-account-list-action total", actionStart, {
      action: "delete",
      ok: true,
      remainingCount: state.projects.length,
    });
  } catch (error) {
    console.error("[kbm] Failed to delete saved pattern from My Patterns.", error);
    setStatus(root, "Could not delete this saved pattern. Please try again.", true);
    perfEnd("6-account-list-action total", actionStart, { action: "delete", ok: false, thrown: true });
  } finally {
    releaseMyPatternsListInteraction(root);
  }
}

async function onProjectCopy(
  root: HTMLElement,
  projectId: string,
  label: string,
): Promise<void> {
  const access = listAccess(root);
  if (!canCopySavedCustomPatternForAccess(access)) {
    offerPatternEditingUnlockModal(access);
    return;
  }

  const actionStart = perfStart();
  perfMark("6-account-list-action start", { action: "copy", projectId, label });
  setStatus(root, `Copying “${label}”…`);
  lockMyPatternsListInteraction(root);

  try {
    const result = await copySavedCustomPatternProjectById(projectId, "sleeveless");
    if (!result.ok) {
      setStatus(root, result.error, true);
      perfEnd("6-account-list-action total", actionStart, { action: "copy", ok: false });
      return;
    }

    const state = listStateByRoot.get(root);
    if (state) {
      state.projects = [...state.projects, toProjectSummary(result.project)];
      renderProjectList(root);
      setListVisible(root, true);
    }
    setStatus(root, `Created “${result.project.name}”.`);
    perfEnd("6-account-list-action total", actionStart, { action: "copy", ok: true });
  } catch (error) {
    console.error("[kbm] Failed to copy saved pattern from My Patterns.", error);
    setStatus(root, "Could not copy this saved pattern. Please try again.", true);
    perfEnd("6-account-list-action total", actionStart, { action: "copy", ok: false, thrown: true });
  } finally {
    releaseMyPatternsListInteraction(root);
  }
}

async function onProjectRename(
  root: HTMLElement,
  projectId: string,
  label: string,
): Promise<void> {
  const next = window.prompt(RENAME_SAVED_PATTERN_PROMPT_MESSAGE, label);
  if (next === null) return;
  const name = next.trim();
  if (!name || name === label) return;

  const actionStart = perfStart();
  perfMark("6-account-list-action start", { action: "rename", projectId, label });
  setStatus(root, `Renaming “${label}”…`);
  lockMyPatternsListInteraction(root);

  try {
    const result = await renameSavedCustomPatternProject(projectId, name, "sleeveless");
    if (!result.ok) {
      setStatus(root, result.error, true);
      perfEnd("6-account-list-action total", actionStart, { action: "rename", ok: false });
      return;
    }

    const state = listStateByRoot.get(root);
    if (state) {
      state.projects = state.projects.map((project) =>
        project.id === projectId
          ? { ...project, name: result.project.name, updatedAt: result.project.updatedAt }
          : project,
      );
      renderProjectList(root);
    }
    setStatus(root, `Renamed to “${result.project.name}”.`);
    perfEnd("6-account-list-action total", actionStart, { action: "rename", ok: true });
  } catch (error) {
    console.error("[kbm] Failed to rename saved pattern from My Patterns.", error);
    setStatus(root, "Could not rename this saved pattern. Please try again.", true);
    perfEnd("6-account-list-action total", actionStart, { action: "rename", ok: false, thrown: true });
  } finally {
    releaseMyPatternsListInteraction(root);
  }
}

function wireProjectRow(
  root: HTMLElement,
  tr: HTMLTableRowElement,
  project: CustomPatternProjectSummary,
  displayName: string,
): void {
  tr.className = "account-my-patterns__row";
  tr.setAttribute("data-kbm-my-patterns-row", "");
  tr.tabIndex = 0;
  tr.setAttribute("aria-label", `View ${displayName}`);

  const view = (): void => {
    if (tr.getAttribute("aria-disabled") === "true") return;
    void onProjectView(root, project.id, displayName);
  };

  tr.addEventListener("click", view);
  tr.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    view();
  });
}

function renderProjectRow(root: HTMLElement, project: CustomPatternProjectSummary): void {
  const tbody = root.querySelector("[data-kbm-my-patterns-list]");
  if (!(tbody instanceof HTMLElement)) return;

  const tr = document.createElement("tr");
  const displayName = project.name || "Untitled pattern";
  wireProjectRow(root, tr, project, displayName);

  const nameCell = document.createElement("td");
  nameCell.className = "account-my-patterns__cell--name";
  nameCell.setAttribute("data-label", "Pattern name");
  const nameEl = document.createElement("span");
  nameEl.className = "account-my-patterns__pattern-name";
  nameEl.textContent = displayName;
  nameCell.append(nameEl);

  const typeCell = document.createElement("td");
  typeCell.className = "account-my-patterns__cell--type account-my-patterns__type";
  typeCell.setAttribute("data-label", "Type");
  typeCell.textContent = formatProjectType(project);

  const gaugeCell = document.createElement("td");
  gaugeCell.className = "account-my-patterns__cell--gauge account-my-patterns__gauge";
  gaugeCell.setAttribute("data-label", "Gauge");
  gaugeCell.textContent = formatSavedPatternGauge(project.gauge);
  if (!project.gauge) {
    gaugeCell.classList.add("account-my-patterns__gauge--empty");
  }

  const updatedCell = document.createElement("td");
  updatedCell.className = "account-my-patterns__cell--updated account-my-patterns__updated";
  updatedCell.setAttribute("data-label", "Last updated");
  const stamp = formatUpdatedAt(project.updatedAt);
  updatedCell.textContent = stamp || "—";

  const actionsCell = document.createElement("td");
  actionsCell.className = "account-my-patterns__cell--actions";
  actionsCell.setAttribute("data-label", "Actions");

  const actionsGroup = document.createElement("div");
  actionsGroup.className = "account-my-patterns__actions";

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.className = "account-my-patterns__action account-my-patterns__action--view";
  viewBtn.setAttribute("data-kbm-my-patterns-view", "");
  viewBtn.dataset.projectId = project.id;
  viewBtn.setAttribute("aria-label", `View ${displayName}`);
  viewBtn.textContent = "View Pattern";
  viewBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (viewBtn.disabled) return;
    void onProjectView(root, project.id, displayName);
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "account-my-patterns__action account-my-patterns__action--edit";
  editBtn.setAttribute("data-kbm-my-patterns-edit", "");
  editBtn.dataset.projectId = project.id;
  editBtn.setAttribute("aria-label", `Edit ${displayName}`);
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (editBtn.disabled) return;
    void onProjectEdit(root, project.id, displayName);
  });

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "account-my-patterns__action account-my-patterns__action--copy";
  copyBtn.setAttribute("data-kbm-my-patterns-copy", "");
  copyBtn.dataset.projectId = project.id;
  copyBtn.setAttribute("aria-label", `Copy ${displayName}`);
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (copyBtn.disabled) return;
    void onProjectCopy(root, project.id, displayName);
  });
  // Edit + Copy are visible for everyone; disabled + grayed (with tooltip) for view-only knitters
  // (free user who already claimed, or downgraded member) based on the resolved access snapshot.
  const rowAccess = listAccess(root);
  applyEditAccessToButton(editBtn, rowAccess);
  syncSavedCustomPatternCopyAccessForAccess(copyBtn, rowAccess);

  const editCopyPair = document.createElement("div");
  editCopyPair.className = "account-my-patterns__action-pair";
  editCopyPair.append(editBtn, copyBtn);

  const renameBtn = document.createElement("button");
  renameBtn.type = "button";
  renameBtn.className = "account-my-patterns__action account-my-patterns__action--rename";
  renameBtn.setAttribute("data-kbm-my-patterns-rename", "");
  renameBtn.dataset.projectId = project.id;
  renameBtn.setAttribute("aria-label", `Rename ${displayName}`);
  renameBtn.textContent = "Rename";
  renameBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (renameBtn.disabled) return;
    void onProjectRename(root, project.id, displayName);
  });

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "account-my-patterns__action account-my-patterns__action--delete account-my-patterns__delete";
  delBtn.setAttribute("data-kbm-my-patterns-delete", "");
  delBtn.dataset.projectId = project.id;
  delBtn.setAttribute("aria-label", `Delete ${displayName}`);
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (delBtn.disabled) return;
    void onProjectDelete(root, project.id, displayName);
  });

  actionsGroup.append(viewBtn, editCopyPair, renameBtn, delBtn);
  actionsCell.append(actionsGroup);

  tr.append(nameCell, typeCell, gaugeCell, updatedCell, actionsCell);
  tbody.append(tr);
}

export function renderProjectList(root: HTMLElement): void {
  const state = listStateByRoot.get(root);
  const tbody = root.querySelector("[data-kbm-my-patterns-list]");
  if (!state || !(tbody instanceof HTMLElement)) return;

  tbody.replaceChildren();
  for (const project of sortedProjects(root, state.projects)) {
    renderProjectRow(root, project);
  }
  syncMyPatternsDeleteAccess(root);
  updateSortHeaders(root);
}

function wireSortHeaders(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-sort]").forEach((btn) => {
    if (btn.dataset.kbmMyPatternsSortBound === "1") return;
    btn.dataset.kbmMyPatternsSortBound = "1";
    btn.addEventListener("click", () => {
      const state = listStateByRoot.get(root);
      const column = btn.getAttribute("data-kbm-my-patterns-sort") as SortColumn | null;
      if (!state || !column) return;

      if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortColumn = column;
        state.sortDirection = column === "name" ? "asc" : "desc";
      }
      renderProjectList(root);
    });
  });
}

export async function initAccountMyPatternsList(root: HTMLElement): Promise<void> {
  const renderNumber = nextAccountListRender();
  const initStart = perfStart();
  perfMark("1-account-page-init start", {
    renderNumber,
    ...memberstackReadinessSnapshot(),
  });

  setStatus(root, "Loading your saved patterns…");
  setListVisible(root, false);
  setEmptyCtaVisible(root, false);

  const listStart = perfStart();
  const res = await listCustomPatternProjects("sleeveless");
  perfEnd("1-account-page-init listCustomPatternProjects", listStart, {
    renderNumber,
    ok: res.ok,
    projectCount: res.ok ? res.projects.length : 0,
  });
  if (!res.ok) {
    const message =
      res.error === SIGN_IN_REQUIRED_ERROR
        ? "Sign in to view your saved patterns."
        : res.error;
    setStatus(root, message, res.error !== SIGN_IN_REQUIRED_ERROR);
    perfEnd("1-account-page-init total", initStart, {
      renderNumber,
      outcome: res.error === SIGN_IN_REQUIRED_ERROR ? "auth-none" : "list-error",
    });
    return;
  }

  const domStart = perfStart();
  if (res.projects.length === 0) {
    setStatus(root, EMPTY_LIST_MESSAGE);
    setEmptyCtaVisible(root, true);
    perfEnd("5-saved-patterns-dom-render", domStart, { renderNumber, projectCount: 0, fullRebuild: true });
    perfEnd("1-account-page-init total", initStart, { renderNumber, outcome: "empty-list" });
    return;
  }

  hideStatus(root);

  // Resolve entitlement so the free user's protected pattern renders with a disabled Delete button.
  // Use the snapshot resolver so we do NOT prime the shared access cache (which would change the
  // unrelated Copy gate's open-by-default behavior on this page).
  let access: SleevelessUserAccess | null = null;
  try {
    access = await resolveSleevelessUserAccessSnapshot();
  } catch {
    access = null;
  }

  listStateByRoot.set(root, {
    projects: res.projects,
    sortColumn: "updatedAt",
    sortDirection: "desc",
    access,
  });
  wireSortHeaders(root);
  renderProjectList(root);
  setListVisible(root, true);
  setEmptyCtaVisible(root, false);
  perfEnd("5-saved-patterns-dom-render", domStart, {
    renderNumber,
    projectCount: res.projects.length,
    fullRebuild: true,
  });
  perfEnd("1-account-page-init total", initStart, {
    renderNumber,
    outcome: "rendered",
    projectCount: res.projects.length,
  });
}

export function bootAccountMyPatternsList(doc: Document = document): void {
  const bootStart = perfStart();
  const root = doc.querySelector("[data-kbm-my-patterns]");
  perfMark("1-account-page bootMyPatterns", {
    rootFound: root instanceof HTMLElement,
    ...memberstackReadinessSnapshot(),
  });
  if (!(root instanceof HTMLElement)) {
    perfEnd("1-account-page bootMyPatterns (no root)", bootStart, { rootFound: false });
    return;
  }
  perfEnd("1-account-page bootMyPatterns", bootStart, { rootFound: true });
  void initAccountMyPatternsList(root);
}
