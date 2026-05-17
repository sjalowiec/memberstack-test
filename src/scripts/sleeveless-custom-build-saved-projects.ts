/**
 * Custom Build — save/load saved projects (Netlify Blobs).
 * Working draft stays in localStorage (`kbm_current_pattern`); this UI writes/reads Blob-backed projects.
 */
import {
  buildSavePayloadFromWorkingDraft,
  createCustomPatternProject,
  listCustomPatternProjects,
  loadCustomPatternProject,
  loadProjectIntoWorkingDraft,
  updateCustomPatternProject,
} from "../lib/patterns/customPatternProjectClient";
import { resolveCustomPatternProjectAuth } from "../lib/patterns/customPatternProjectAuth";
import type { CustomPatternProjectSummary } from "../lib/patterns/customPatternProjectTypes";
import { getPatternProjectMeta } from "../lib/patterns/sleevelessPatternProjectMeta";

const ACTIVE_PROJECT_ID_KEY = "kbm_custom_pattern_active_project_id";

function readActiveProjectId(): string {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeActiveProjectId(id: string): void {
  try {
    if (id) localStorage.setItem(ACTIVE_PROJECT_ID_KEY, id);
    else localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
  } catch {
    /* ignore */
  }
}

function setStatus(root: HTMLElement, message: string, isError = false): void {
  const el = root.querySelector("[data-cb-project-status]");
  if (!(el instanceof HTMLElement)) return;
  el.textContent = message;
  el.classList.toggle("cb-project-status--error", isError);
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
  const activeId = readActiveProjectId();
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
}

async function refreshProjectList(root: HTMLElement): Promise<void> {
  const select = root.querySelector("[data-cb-project-select]");
  if (!(select instanceof HTMLSelectElement)) return;
  const res = await listCustomPatternProjects("sleeveless");
  if (!res.ok) {
    fillProjectSelect(select, []);
    return;
  }
  fillProjectSelect(select, res.projects);
}

function initCustomBuildSavedProjects(): void {
  const root = document.querySelector("[data-cb-saved-projects]");
  if (!(root instanceof HTMLElement)) return;

  const nameInput = root.querySelector<HTMLInputElement>("[data-cb-project-name]");
  const select = root.querySelector<HTMLSelectElement>("[data-cb-project-select]");
  const saveBtn = root.querySelector<HTMLButtonElement>("[data-cb-project-save]");
  const updateBtn = root.querySelector<HTMLButtonElement>("[data-cb-project-update]");
  const loadBtn = root.querySelector<HTMLButtonElement>("[data-cb-project-load]");

  void refreshAuthHint(root);
  void refreshProjectList(root);

  const meta = getPatternProjectMeta();
  if (nameInput && meta.title.trim() && !nameInput.value.trim()) {
    nameInput.value = meta.title;
  }

  saveBtn?.addEventListener("click", async () => {
    const name = nameInput?.value?.trim() ?? "";
    if (!name) {
      setStatus(root, "Enter a project name before saving.", true);
      return;
    }
    setStatus(root, "Saving…");
    const payload = buildSavePayloadFromWorkingDraft(name);
    const res = await createCustomPatternProject(payload);
    if (!res.ok) {
      setStatus(root, res.error, true);
      return;
    }
    writeActiveProjectId(res.project.id);
    if (nameInput) nameInput.value = res.project.name;
    setStatus(root, `Saved “${res.project.name}”.`);
    await refreshProjectList(root);
  });

  updateBtn?.addEventListener("click", async () => {
    const id = readActiveProjectId() || select?.value?.trim() || "";
    if (!id) {
      setStatus(root, "Save a new project first, or choose one to update.", true);
      return;
    }
    const name = nameInput?.value?.trim() ?? "";
    if (!name) {
      setStatus(root, "Enter a project name before updating.", true);
      return;
    }
    setStatus(root, "Updating…");
    const base = buildSavePayloadFromWorkingDraft(name);
    const res = await updateCustomPatternProject({ ...base, id });
    if (!res.ok) {
      setStatus(root, res.error, true);
      return;
    }
    writeActiveProjectId(res.project.id);
    setStatus(root, `Updated “${res.project.name}”.`);
    await refreshProjectList(root);
  });

  loadBtn?.addEventListener("click", async () => {
    const id = select?.value?.trim() ?? "";
    if (!id) {
      setStatus(root, "Choose a saved project to load.", true);
      return;
    }
    setStatus(root, "Loading…");
    const res = await loadCustomPatternProject(id, "sleeveless");
    if (!res.ok) {
      setStatus(root, res.error, true);
      return;
    }
    loadProjectIntoWorkingDraft(res.project);
    writeActiveProjectId(res.project.id);
    if (nameInput) nameInput.value = res.project.name;
    setStatus(
      root,
      `Loaded “${res.project.name}” into your working draft (localStorage). Refresh other Custom Build steps if needed.`,
    );
  });

  select?.addEventListener("change", () => {
    const id = select.value?.trim();
    if (!id) return;
    writeActiveProjectId(id);
    const opt = select.selectedOptions[0];
    if (opt && nameInput && !nameInput.value.trim()) {
      nameInput.value = opt.textContent?.split(" (")[0]?.trim() ?? "";
    }
  });
}

if (typeof document !== "undefined") {
  const boot = (): void => initCustomBuildSavedProjects();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
