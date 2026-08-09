/**
 * Saved patterns accordion on /account — load, group by pattern system, open/edit/delete.
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
import { formatSavedPatternGauge } from "./savedPatternGaugeDisplay";
import { resolveSleevelessUserAccessSnapshot } from "./sleevelessPatternSystemAccessClient";
import { offerPatternEditingUnlockModal } from "./patternEditingUnlockModal";
import {
  canEditPatternSettingsForSystem,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import {
  freePatternDeleteBlockedText,
  isPatternDeleteProtectedForSystem,
} from "./sleevelessPatternDeleteGuard";
import {
  DELETE_SAVED_PATTERN_CONFIRM_MESSAGE,
  promptSavedPatternDeleteConfirmation,
} from "./savedPatternDeleteConfirmation";
import {
  PATTERN_SYSTEM_IDS,
  patternSystemDisplayName,
  type PatternSystemId,
} from "./patternSystemId";

const SIGN_IN_REQUIRED_ERROR = "Sign in to save Custom Pattern projects.";
/** Tooltip shown when Edit is disabled for a free claimed / downgraded knitter. */
export const SAVED_CUSTOM_PATTERN_EDIT_DISABLED_TEXT =
  "Pattern editing is included with membership. You can still view, print, and knit from this pattern.";
export { DELETE_SAVED_PATTERN_CONFIRM_MESSAGE };
const EMPTY_LIST_MESSAGE =
  "You do not have any saved patterns yet. Create your first pattern to get started.";

/** Max patterns shown inside each open pattern-system group on the account dashboard. */
export const ACCOUNT_MY_PATTERNS_GROUP_PREVIEW_LIMIT = 3;

const ACCOUNT_MY_PATTERNS_ACCORDION_NAME = "account-my-patterns-groups";

export type AccountMyPatternsGroup = {
  patternSystem: PatternSystemId;
  label: string;
  /** Newest-first within the group. */
  projects: CustomPatternProjectSummary[];
  newestUpdatedAt: string;
};

type ListState = {
  projects: CustomPatternProjectSummary[];
  /** Resolved access; gates Edit and free-pattern Delete protection. Null until resolved. */
  access: SleevelessUserAccess | null;
};

const listStateByRoot = new WeakMap<HTMLElement, ListState>();

/** Resolve a saved pattern's canonical system for dashboard grouping. */
export function resolveAccountMyPatternsSystem(
  project: Pick<CustomPatternProjectSummary, "patternSystem">,
): PatternSystemId {
  const raw = project.patternSystem?.trim();
  if (raw && (PATTERN_SYSTEM_IDS as readonly string[]).includes(raw)) {
    return raw as PatternSystemId;
  }
  return "sleeveless";
}

export function formatAccountMyPatternsCountLabel(count: number): string {
  return count === 1 ? "1 pattern" : `${count} patterns`;
}

/**
 * Groups saved patterns by canonical pattern system.
 * Only systems with real projects are returned; groups are newest-first by latest project update.
 */
export function buildAccountMyPatternsGroups(
  projects: readonly CustomPatternProjectSummary[],
): AccountMyPatternsGroup[] {
  const bySystem = new Map<PatternSystemId, CustomPatternProjectSummary[]>();
  for (const project of projects) {
    const system = resolveAccountMyPatternsSystem(project);
    const list = bySystem.get(system);
    if (list) list.push(project);
    else bySystem.set(system, [project]);
  }

  const groups: AccountMyPatternsGroup[] = [];
  for (const [patternSystem, list] of bySystem) {
    const sorted = [...list].sort((a, b) =>
      String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
    );
    groups.push({
      patternSystem,
      label: patternSystemDisplayName(patternSystem),
      projects: sorted,
      newestUpdatedAt: sorted[0]?.updatedAt ?? "",
    });
  }

  groups.sort((a, b) => String(b.newestUpdatedAt).localeCompare(String(a.newestUpdatedAt)));
  return groups;
}

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

function projectPatternSystem(project: CustomPatternProjectSummary): PatternSystemId {
  return resolveAccountMyPatternsSystem(project);
}

function setListVisible(root: HTMLElement, visible: boolean): void {
  const wrap = root.querySelector("[data-kbm-my-patterns-list-wrap]");
  if (wrap instanceof HTMLElement) wrap.hidden = !visible;
}

function setEmptyCtaVisible(root: HTMLElement, visible: boolean): void {
  const cta = root.querySelector("[data-kbm-my-patterns-empty-cta]");
  if (cta instanceof HTMLElement) cta.hidden = !visible;
}

function setViewAllVisible(root: HTMLElement, visible: boolean): void {
  const wrap = root.querySelector("[data-kbm-my-patterns-view-all-wrap]");
  if (wrap instanceof HTMLElement) wrap.hidden = !visible;
}

const ROW_ACTION_SELECTORS = [
  "[data-kbm-my-patterns-view]",
  "[data-kbm-my-patterns-edit]",
  "[data-kbm-my-patterns-delete]",
] as const;

function countProjectsForSystem(
  projects: CustomPatternProjectSummary[],
  patternSystem: PatternSystemId,
): number {
  return projects.filter((p) => projectPatternSystem(p) === patternSystem).length;
}

function lockMyPatternsListInteraction(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-kbm-my-patterns-row]").forEach((row) => {
    row.setAttribute("aria-disabled", "true");
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
  });
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-view]").forEach((b) => {
    b.disabled = false;
  });
  syncMyPatternsEditAccess(root);
  syncMyPatternsDeleteAccess(root);
}

function isProtectedDeleteTarget(root: HTMLElement, projectId: string): boolean {
  const state = listStateByRoot.get(root);
  if (!state?.access) return false;
  const project = state.projects.find((p) => p.id === projectId);
  const patternSystem = project ? projectPatternSystem(project) : "sleeveless";
  return isPatternDeleteProtectedForSystem({
    access: state.access,
    projectId,
    patternSystem,
    totalSavedCountForSystem: countProjectsForSystem(state.projects, patternSystem),
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
      const project = listStateByRoot.get(root)?.projects.find((p) => p.id === projectId);
      const system = project ? projectPatternSystem(project) : "sleeveless";
      btn.setAttribute("title", freePatternDeleteBlockedText(system));
    } else {
      btn.removeAttribute("aria-disabled");
      btn.removeAttribute("title");
    }
  });
}

function showEmptyListState(root: HTMLElement): void {
  listStateByRoot.delete(root);
  const container = root.querySelector("[data-kbm-my-patterns-list]");
  if (container instanceof HTMLElement) container.replaceChildren();
  setListVisible(root, false);
  setViewAllVisible(root, false);
  setStatus(root, EMPTY_LIST_MESSAGE);
  setEmptyCtaVisible(root, true);
}

/** Keep the global My Patterns drawer list in sync when it is already on the page. */
function refreshOpenPatternLibraryDrawer(): void {
  const doc = typeof document !== "undefined" ? document : null;
  if (!doc || typeof doc.querySelector !== "function") return;
  const drawer = doc.querySelector("[data-pattern-workspace-library-drawer]");
  if (!(drawer instanceof HTMLElement)) return;
  void import("./patternWorkspaceLibraryDrawer").then(({ refreshPatternWorkspaceLibraryList }) => {
    void refreshPatternWorkspaceLibraryList(drawer);
  });
}

function listAccess(root: HTMLElement): SleevelessUserAccess | null {
  return listStateByRoot.get(root)?.access ?? null;
}

function canEditSavedPatternFromList(
  root: HTMLElement,
  patternSystem: PatternSystemId = "sleeveless",
): boolean {
  const access = listAccess(root);
  return access ? canEditPatternSettingsForSystem(access, patternSystem) : false;
}

function applyEditAccessToButton(
  btn: HTMLButtonElement | null | undefined,
  access: SleevelessUserAccess | null,
  patternSystem: PatternSystemId = "sleeveless",
): void {
  if (!btn) return;
  const canEdit = access ? canEditPatternSettingsForSystem(access, patternSystem) : false;
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

function syncMyPatternsEditAccess(root: HTMLElement): void {
  const access = listAccess(root);
  root.querySelectorAll<HTMLButtonElement>("[data-kbm-my-patterns-edit]").forEach((btn) => {
    const system = (btn.dataset.patternSystem as PatternSystemId | undefined) ?? "sleeveless";
    applyEditAccessToButton(btn, access, system);
  });
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
  const state = listStateByRoot.get(root);
  const project = state?.projects.find((p) => p.id === projectId);
  const patternSystem = project ? projectPatternSystem(project) : "sleeveless";
  const access = listAccess(root);
  if (!canEditSavedPatternFromList(root, patternSystem)) {
    offerPatternEditingUnlockModal(access, { patternSystem });
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
    const project = listStateByRoot.get(root)?.projects.find((p) => p.id === projectId);
    const system = project ? projectPatternSystem(project) : "sleeveless";
    setStatus(root, freePatternDeleteBlockedText(system), true);
    return;
  }

  const choice = await promptSavedPatternDeleteConfirmation(root);
  if (choice !== "delete") return;

  const stateBefore = listStateByRoot.get(root);
  const project = stateBefore?.projects.find((p) => p.id === projectId);
  const patternSystem = project ? projectPatternSystem(project) : "sleeveless";
  const savedCountForSystem = stateBefore
    ? countProjectsForSystem(stateBefore.projects, patternSystem)
    : undefined;

  const actionStart = perfStart();
  perfMark("6-account-list-action start", { action: "delete", projectId, label });
  setStatus(root, `Deleting “${label}”…`);
  lockMyPatternsListInteraction(root);

  try {
    const deleteStart = perfStart();
    const result = await deleteSavedCustomPatternProject(projectId, "sleeveless", {
      totalSavedCount: savedCountForSystem,
      patternSystem,
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

    state.projects = state.projects.filter((p) => p.id !== projectId);

    if (state.projects.length === 0) {
      showEmptyListState(root);
      refreshOpenPatternLibraryDrawer();
      perfEnd("6-account-list-action total", actionStart, {
        action: "delete",
        ok: true,
        outcome: "empty-list",
      });
      return;
    }

    hideStatus(root);
    renderProjectList(root);
    refreshOpenPatternLibraryDrawer();
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

function renderPatternEntry(
  root: HTMLElement,
  listEl: HTMLElement,
  project: CustomPatternProjectSummary,
): void {
  const displayName = project.name || "Untitled pattern";
  const patternSystem = projectPatternSystem(project);

  const item = document.createElement("li");
  item.className = "account-my-patterns__item";
  item.setAttribute("data-kbm-my-patterns-row", "");
  item.dataset.patternSystem = patternSystem;

  const main = document.createElement("div");
  main.className = "account-my-patterns__item-main";

  const nameEl = document.createElement("p");
  nameEl.className = "account-my-patterns__pattern-name";
  nameEl.textContent = displayName;

  const meta = document.createElement("p");
  meta.className = "account-my-patterns__meta";

  const gaugeEl = document.createElement("span");
  gaugeEl.className = "account-my-patterns__gauge";
  gaugeEl.textContent = formatSavedPatternGauge(project.gauge);
  if (!project.gauge) gaugeEl.classList.add("account-my-patterns__gauge--empty");

  const sep = document.createElement("span");
  sep.setAttribute("aria-hidden", "true");
  sep.textContent = " · ";

  const updatedEl = document.createElement("span");
  updatedEl.className = "account-my-patterns__updated";
  const stamp = formatUpdatedAt(project.updatedAt);
  updatedEl.textContent = stamp ? `Updated ${stamp}` : "Updated —";

  meta.append(gaugeEl, sep, updatedEl);
  main.append(nameEl, meta);

  const actions = document.createElement("div");
  actions.className = "account-my-patterns__actions";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "account-my-patterns__action account-my-patterns__action--view";
  openBtn.setAttribute("data-kbm-my-patterns-view", "");
  openBtn.dataset.projectId = project.id;
  openBtn.setAttribute("aria-label", `Open ${displayName}`);
  openBtn.textContent = "Open";
  openBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (openBtn.disabled) return;
    void onProjectView(root, project.id, displayName);
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "account-my-patterns__action account-my-patterns__action--edit";
  editBtn.setAttribute("data-kbm-my-patterns-edit", "");
  editBtn.dataset.projectId = project.id;
  editBtn.dataset.patternSystem = patternSystem;
  editBtn.setAttribute("aria-label", `Edit ${displayName}`);
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (editBtn.disabled) return;
    void onProjectEdit(root, project.id, displayName);
  });
  applyEditAccessToButton(editBtn, listAccess(root), patternSystem);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className =
    "account-my-patterns__action account-my-patterns__action--delete account-my-patterns__delete";
  deleteBtn.setAttribute("data-kbm-my-patterns-delete", "");
  deleteBtn.dataset.projectId = project.id;
  deleteBtn.setAttribute("aria-label", `Delete ${displayName}`);
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", (event) => {
    event?.stopPropagation?.();
    if (deleteBtn.disabled) return;
    void onProjectDelete(root, project.id, displayName);
  });

  actions.append(openBtn, editBtn, deleteBtn);
  item.append(main, actions);
  listEl.append(item);
}

function wireExclusiveAccordionGroups(root: HTMLElement): void {
  const groups = [
    ...root.querySelectorAll<HTMLDetailsElement>("[data-kbm-my-patterns-group]"),
  ];
  for (const details of groups) {
    if (details.dataset.kbmMyPatternsGroupBound === "1") continue;
    details.dataset.kbmMyPatternsGroupBound = "1";
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      for (const other of groups) {
        if (other !== details && other.open) other.open = false;
      }
    });
  }
}

function renderPatternGroup(
  root: HTMLElement,
  container: HTMLElement,
  group: AccountMyPatternsGroup,
): void {
  const details = document.createElement("details");
  details.className = "account-my-patterns__group";
  details.setAttribute("data-kbm-my-patterns-group", "");
  details.dataset.patternSystem = group.patternSystem;
  details.setAttribute("name", ACCOUNT_MY_PATTERNS_ACCORDION_NAME);
  details.open = false;

  const summary = document.createElement("summary");
  summary.className = "account-my-patterns__group-summary";
  const label = document.createElement("span");
  label.className = "account-my-patterns__group-label";
  label.textContent = `${group.label} · ${formatAccountMyPatternsCountLabel(group.projects.length)}`;
  summary.append(label);

  const list = document.createElement("ul");
  list.className = "account-my-patterns__group-body";
  list.setAttribute("data-kbm-my-patterns-group-list", "");

  const preview = group.projects.slice(0, ACCOUNT_MY_PATTERNS_GROUP_PREVIEW_LIMIT);
  for (const project of preview) {
    renderPatternEntry(root, list, project);
  }

  details.append(summary, list);
  container.append(details);
}

export function renderProjectList(root: HTMLElement): void {
  const state = listStateByRoot.get(root);
  const container = root.querySelector("[data-kbm-my-patterns-list]");
  if (!state || !(container instanceof HTMLElement)) return;

  const groups = buildAccountMyPatternsGroups(state.projects);

  container.replaceChildren();
  for (const group of groups) {
    renderPatternGroup(root, container, group);
  }
  wireExclusiveAccordionGroups(root);
  syncMyPatternsEditAccess(root);
  syncMyPatternsDeleteAccess(root);
  setViewAllVisible(root, state.projects.length > 0);
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
  setViewAllVisible(root, false);

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
    setViewAllVisible(root, false);
    perfEnd("5-saved-patterns-dom-render", domStart, { renderNumber, projectCount: 0, fullRebuild: true });
    perfEnd("1-account-page-init total", initStart, { renderNumber, outcome: "empty-list" });
    return;
  }

  hideStatus(root);

  // Snapshot access for Edit gating without priming the shared access cache.
  let access: SleevelessUserAccess | null = null;
  try {
    access = await resolveSleevelessUserAccessSnapshot();
  } catch {
    access = null;
  }

  listStateByRoot.set(root, {
    projects: res.projects,
    access,
  });
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
