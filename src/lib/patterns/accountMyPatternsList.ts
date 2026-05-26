/**
 * Saved patterns list on /account — load, open, sort, and delete saved projects.
 */
import { listCustomPatternProjects } from "./customPatternProjectClient";
import type { CustomPatternProjectSummary } from "./customPatternProjectTypes";
import { deleteSavedCustomPatternProject } from "./deleteSavedCustomPatternProject";
import { loadSavedCustomPatternProject } from "./loadSavedCustomPatternProject";
import {
  memberstackReadinessSnapshot,
  nextAccountListRender,
  perfEnd,
  perfMark,
  perfStart,
} from "./savedPatternsPerfLog";

const SIGN_IN_REQUIRED_ERROR = "Sign in to save Custom Pattern projects.";
const EMPTY_LIST_MESSAGE =
  "You do not have any saved patterns yet. Save a project from the sleeveless Custom Build design step.";
export const DELETE_SAVED_PATTERN_CONFIRM_MESSAGE = "Delete this saved pattern?";

type SortColumn = "name" | "updatedAt";
type SortDirection = "asc" | "desc";

type ListState = {
  projects: CustomPatternProjectSummary[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
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
  const familyLabels: Record<string, string> = {
    sleeveless: "Sleeveless",
  };
  const sourceLabels: Record<string, string> = {
    express: "Express",
    "custom-build": "Custom Build",
  };
  const family = project.family ? (familyLabels[project.family] ?? project.family) : "";
  const source = project.source ? (sourceLabels[project.source] ?? project.source) : "";
  if (family && source) return `${family} · ${source}`;
  return family || source || "—";
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

function lockMyPatternsListInteraction(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-kbm-my-patterns-row]").forEach((row) => {
    row.setAttribute("aria-disabled", "true");
    row.tabIndex = -1;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-sort]").forEach((b) => {
    b.disabled = true;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-delete]").forEach((b) => {
    b.disabled = true;
  });
}

function releaseMyPatternsListInteraction(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-kbm-my-patterns-row]").forEach((row) => {
    row.removeAttribute("aria-disabled");
    row.tabIndex = 0;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-sort]").forEach((b) => {
    b.disabled = false;
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-delete]").forEach((b) => {
    b.disabled = false;
  });
}

function showEmptyListState(root: HTMLElement): void {
  listStateByRoot.delete(root);
  const tbody = root.querySelector("[data-kbm-my-patterns-list]");
  if (tbody instanceof HTMLElement) tbody.replaceChildren();
  setListVisible(root, false);
  setStatus(root, EMPTY_LIST_MESSAGE);
}

async function onProjectOpen(root: HTMLElement, projectId: string, label: string): Promise<void> {
  const actionStart = perfStart();
  perfMark("6-account-list-action start", { action: "open", projectId, label });
  setStatus(root, `Loading “${label}”…`);
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
    console.error("[kbm] Failed to open saved pattern from My Patterns.", error);
    setStatus(root, "Could not open this pattern. Please try again.", true);
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
  const confirmed = window.confirm(DELETE_SAVED_PATTERN_CONFIRM_MESSAGE);
  if (!confirmed) return;

  const actionStart = perfStart();
  perfMark("6-account-list-action start", { action: "delete", projectId, label });
  setStatus(root, `Deleting “${label}”…`);
  lockMyPatternsListInteraction(root);

  try {
    const deleteStart = perfStart();
    const result = await deleteSavedCustomPatternProject(projectId, "sleeveless");
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

function wireProjectRow(
  root: HTMLElement,
  tr: HTMLTableRowElement,
  project: CustomPatternProjectSummary,
  displayName: string,
): void {
  tr.className = "account-my-patterns__row";
  tr.setAttribute("data-kbm-my-patterns-row", "");
  tr.tabIndex = 0;
  tr.setAttribute("aria-label", `Open ${displayName}`);

  const open = (): void => {
    if (tr.getAttribute("aria-disabled") === "true") return;
    void onProjectOpen(root, project.id, displayName);
  };

  tr.addEventListener("click", open);
  tr.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
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

  const updatedCell = document.createElement("td");
  updatedCell.className = "account-my-patterns__cell--updated account-my-patterns__updated";
  updatedCell.setAttribute("data-label", "Last updated");
  const stamp = formatUpdatedAt(project.updatedAt);
  updatedCell.textContent = stamp || "—";

  const actionsCell = document.createElement("td");
  actionsCell.className = "account-my-patterns__cell--actions";
  actionsCell.setAttribute("data-label", "Actions");
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "account-my-patterns__delete";
  delBtn.setAttribute("data-kbm-my-patterns-delete", "");
  delBtn.dataset.projectId = project.id;
  delBtn.setAttribute("aria-label", `Delete ${displayName}`);
  const trash = document.createElement("i");
  trash.className = "fa-solid fa-trash";
  trash.setAttribute("aria-hidden", "true");
  delBtn.append(trash);
  delBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (delBtn.disabled) return;
    void onProjectDelete(root, project.id, displayName);
  });
  actionsCell.append(delBtn);

  tr.append(nameCell, typeCell, updatedCell, actionsCell);
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
        ? "Sign in to view and open your saved patterns."
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
    perfEnd("5-saved-patterns-dom-render", domStart, { renderNumber, projectCount: 0, fullRebuild: true });
    perfEnd("1-account-page-init total", initStart, { renderNumber, outcome: "empty-list" });
    return;
  }

  hideStatus(root);

  listStateByRoot.set(root, {
    projects: res.projects,
    sortColumn: "updatedAt",
    sortDirection: "desc",
  });
  wireSortHeaders(root);
  renderProjectList(root);
  setListVisible(root, true);
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
