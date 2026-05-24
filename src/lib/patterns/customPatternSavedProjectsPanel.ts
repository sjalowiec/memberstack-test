/**
 * Save / update / load panel for saved Custom Pattern projects (`data-cb-*` markup).
 */
import {
  buildSavePayloadFromWorkingDraft,
  createCustomPatternProject,
  listCustomPatternProjects,
  loadCustomPatternProject,
  loadProjectIntoWorkingDraft,
  updateCustomPatternProject,
} from "./customPatternProjectClient";
import type {
  CustomPatternFamily,
  CustomPatternProject,
  CustomPatternProjectSummary,
} from "./customPatternProjectTypes";
import {
  readActiveCustomPatternProjectId,
  writeActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { resolveCustomPatternProjectAuth } from "./customPatternProjectAuth";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { nextPanelListRefresh, perfEnd, perfMark, perfStart } from "./savedPatternsPerfLog";

export type CustomPatternSavedProjectsPanelOptions = {
  family?: CustomPatternFamily;
  /** When false, omit load dropdown UI (e.g. review page — use /account to open projects). Default true. */
  showLoadControls?: boolean;
  /** Called after a project is loaded into the working draft (panel stays on page). */
  onProjectLoaded?: (project: CustomPatternProject) => void;
};

function resolveProjectNameForSave(nameInput: HTMLInputElement | null): string {
  const fromInput = nameInput?.value?.trim() ?? "";
  if (fromInput) return fromInput;
  return getPatternProjectMeta().title.trim();
}

function setStatusEl(el: HTMLElement | null, message: string, isError = false): void {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("cb-project-status--error", isError);
}

function setStatus(root: HTMLElement, message: string, isError = false): void {
  setStatusEl(root.querySelector("[data-cb-project-status]"), message, isError);
}

export type SmartSaveCustomPatternProjectOptions = {
  family?: CustomPatternFamily;
  resolveName: () => string;
  onStatus?: (message: string, isError?: boolean) => void;
};

/** Create or update the active saved project from the working draft (one action). */
export async function smartSaveCustomPatternProject(
  options: SmartSaveCustomPatternProjectOptions,
): Promise<
  | { ok: true; project: CustomPatternProject; created: boolean }
  | { ok: false; error: string }
> {
  const family = options.family ?? "sleeveless";
  const name = options.resolveName().trim();
  if (!name) {
    return { ok: false, error: "Enter a pattern name before saving." };
  }

  const activeId = readActiveCustomPatternProjectId();
  const base = buildSavePayloadFromWorkingDraft(name, { family });

  if (activeId) {
    options.onStatus?.("Updating…");
    const res = await updateCustomPatternProject({ ...base, id: activeId });
    if (!res.ok) return { ok: false, error: res.error };
    writeActiveCustomPatternProjectId(res.project.id);
    return { ok: true, project: res.project, created: false };
  }

  options.onStatus?.("Saving…");
  const res = await createCustomPatternProject(base);
  if (!res.ok) return { ok: false, error: res.error };
  writeActiveCustomPatternProjectId(res.project.id);
  return { ok: true, project: res.project, created: true };
}

function setAuthHint(root: HTMLElement, text: string): void {
  const el = root.querySelector("[data-cb-project-auth-hint]");
  if (el instanceof HTMLElement) el.textContent = text;
}

async function refreshAuthHint(root: HTMLElement): Promise<void> {
  const auth = await resolveCustomPatternProjectAuth();
  if (auth.mode === "member") {
    setAuthHint(root, "Signed in — projects are stored under your Memberstack account id.");
  } else if (auth.mode === "dev") {
    setAuthHint(
      root,
      "Development mode — projects are saved under a local dev user id. Not account-backed.",
    );
  } else {
    setAuthHint(root, "Sign in to save projects to your account.");
  }
}

function fillProjectSelect(select: HTMLSelectElement, projects: CustomPatternProjectSummary[]): void {
  const domStart = perfStart();
  const activeId = readActiveCustomPatternProjectId();
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = projects.length ? "Choose a saved project…" : "No saved projects yet";
  select.appendChild(placeholder);
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p.id;
    const stamp = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "";
    opt.textContent = stamp ? `${p.name} (${stamp})` : p.name;
    if (p.id === activeId) opt.selected = true;
    select.appendChild(opt);
  }
  perfEnd("5-saved-patterns-panel-select-dom-render", domStart, {
    projectCount: projects.length,
    fullRebuild: true,
  });
}

async function refreshProjectList(
  root: HTMLElement,
  family: CustomPatternFamily,
  trigger: "init" | "save" | "update" | "load" = "init",
): Promise<void> {
  const refreshNumber = nextPanelListRefresh();
  const refreshStart = perfStart();
  perfMark("6-panel-list-refresh start", { refreshNumber, trigger, family });
  const select = root.querySelector("[data-cb-project-select]");
  if (!(select instanceof HTMLSelectElement)) {
    perfEnd("6-panel-list-refresh total", refreshStart, {
      refreshNumber,
      trigger,
      outcome: "no-select",
    });
    return;
  }
  const listStart = perfStart();
  const res = await listCustomPatternProjects(family);
  perfEnd("6-panel-list-refresh listCustomPatternProjects", listStart, {
    refreshNumber,
    trigger,
    ok: res.ok,
    projectCount: res.ok ? res.projects.length : 0,
  });
  if (!res.ok) {
    fillProjectSelect(select, []);
    perfEnd("6-panel-list-refresh total", refreshStart, {
      refreshNumber,
      trigger,
      outcome: "list-error",
    });
    return;
  }
  fillProjectSelect(select, res.projects);
  perfEnd("6-panel-list-refresh total", refreshStart, {
    refreshNumber,
    trigger,
    outcome: "rendered",
    projectCount: res.projects.length,
  });
}

/**
 * Wires save / update / load controls inside a `[data-cb-saved-projects]` (or compatible) root.
 */
export function initCustomPatternSavedProjectsPanel(
  root: HTMLElement,
  options: CustomPatternSavedProjectsPanelOptions = {},
): void {
  const family = options.family ?? "sleeveless";
  const showLoadControls = options.showLoadControls !== false;

  const nameInput = root.querySelector<HTMLInputElement>("[data-cb-project-name]");
  const select = root.querySelector<HTMLSelectElement>("[data-cb-project-select]");
  const saveBtn = root.querySelector<HTMLButtonElement>("[data-cb-project-save]");
  const updateBtn = root.querySelector<HTMLButtonElement>("[data-cb-project-update]");
  const loadBtn = root.querySelector<HTMLButtonElement>("[data-cb-project-load]");

  void refreshAuthHint(root);
  if (showLoadControls) {
    void refreshProjectList(root, family, "init");
  }

  const meta = getPatternProjectMeta();
  if (nameInput && meta.title.trim() && !nameInput.value.trim()) {
    nameInput.value = meta.title;
  }

  saveBtn?.addEventListener("click", async () => {
    const name = resolveProjectNameForSave(nameInput);
    if (!name) {
      setStatus(root, "Enter a project name before saving.", true);
      return;
    }
    setStatus(root, "Saving…");
    const payload = buildSavePayloadFromWorkingDraft(name, { family });
    const res = await createCustomPatternProject(payload);
    if (!res.ok) {
      setStatus(root, res.error, true);
      return;
    }
    writeActiveCustomPatternProjectId(res.project.id);
    if (nameInput) nameInput.value = res.project.name;
    setStatus(root, `Saved “${res.project.name}”.`);
    if (showLoadControls) {
      await refreshProjectList(root, family, "save");
    }
  });

  updateBtn?.addEventListener("click", async () => {
    const id = readActiveCustomPatternProjectId() || (showLoadControls ? select?.value?.trim() : "") || "";
    if (!id) {
      setStatus(
        root,
        showLoadControls
          ? "Save a new project first, or choose one to update."
          : "Save as new first, or open a saved project from My Account before updating.",
        true,
      );
      return;
    }
    const name = resolveProjectNameForSave(nameInput);
    if (!name) {
      setStatus(root, "Enter a project name before updating.", true);
      return;
    }
    setStatus(root, "Updating…");
    const base = buildSavePayloadFromWorkingDraft(name, { family });
    const res = await updateCustomPatternProject({ ...base, id });
    if (!res.ok) {
      setStatus(root, res.error, true);
      return;
    }
    writeActiveCustomPatternProjectId(res.project.id);
    setStatus(root, `Updated “${res.project.name}”.`);
    if (showLoadControls) {
      await refreshProjectList(root, family, "update");
    }
  });

  if (!showLoadControls || !loadBtn) {
    return;
  }

  loadBtn.addEventListener("click", async () => {
    const loadStart = perfStart();
    perfMark("6-panel-list-action load start");
    const id = select?.value?.trim() ?? "";
    if (!id) {
      setStatus(root, "Choose a saved project to load.", true);
      perfEnd("6-panel-list-action load total", loadStart, { outcome: "no-selection" });
      return;
    }
    setStatus(root, "Loading…");
    const fetchStart = perfStart();
    const res = await loadCustomPatternProject(id, family);
    perfEnd("6-panel-list-action loadCustomPatternProject", fetchStart, { ok: res.ok, projectId: id });
    if (!res.ok) {
      setStatus(root, res.error, true);
      perfEnd("6-panel-list-action load total", loadStart, { outcome: "error" });
      return;
    }
    loadProjectIntoWorkingDraft(res.project);
    writeActiveCustomPatternProjectId(res.project.id);
    if (nameInput) nameInput.value = res.project.name;
    options.onProjectLoaded?.(res.project);
    setStatus(
      root,
      `Loaded “${res.project.name}” into your working draft (localStorage). Refresh other Custom Build steps if needed.`,
    );
    perfEnd("6-panel-list-action load total", loadStart, { outcome: "loaded", projectId: id });
  });

  if (showLoadControls && select) {
    select.addEventListener("change", () => {
      const id = select.value?.trim();
      if (!id) return;
      writeActiveCustomPatternProjectId(id);
      const opt = select.selectedOptions[0];
      if (opt && nameInput && !nameInput.value.trim()) {
        nameInput.value = opt.textContent?.split(" (")[0]?.trim() ?? "";
      }
    });
  }
}
