/**
 * My Patterns list on /account — load saved projects and open or continue editing.
 */
import { resolveCustomPatternProjectAuth } from "../lib/patterns/customPatternProjectAuth";
import { listCustomPatternProjects } from "../lib/patterns/customPatternProjectClient";
import type { CustomPatternProjectSummary } from "../lib/patterns/customPatternProjectTypes";
import { loadSavedCustomPatternProject } from "../lib/patterns/loadSavedCustomPatternProject";

function formatUpdatedAt(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
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

function setListVisible(root: HTMLElement, visible: boolean): void {
  const list = root.querySelector("[data-kbm-my-patterns-list]");
  if (list instanceof HTMLElement) list.hidden = !visible;
}

async function onProjectAction(
  root: HTMLElement,
  projectId: string,
  action: "open" | "continue",
  label: string,
): Promise<void> {
  setStatus(root, `Loading “${label}”…`);
  const buttons = root.querySelectorAll<HTMLButtonElement>("button[data-kbm-my-patterns-action]");
  buttons.forEach((b) => {
    b.disabled = true;
  });

  const result = await loadSavedCustomPatternProject(projectId, action);
  if (!result.ok) {
    buttons.forEach((b) => {
      b.disabled = false;
    });
    setStatus(root, result.error, true);
    return;
  }

  window.location.assign(result.redirectHref);
}

function renderProjectRow(root: HTMLElement, project: CustomPatternProjectSummary): void {
  const list = root.querySelector("[data-kbm-my-patterns-list]");
  if (!(list instanceof HTMLElement)) return;

  const li = document.createElement("li");
  li.className = "account-my-patterns__item";

  const main = document.createElement("div");
  main.className = "account-my-patterns__item-main";

  const title = document.createElement("span");
  title.className = "account-my-patterns__name";
  title.textContent = project.name || "Untitled pattern";

  const updated = document.createElement("span");
  updated.className = "account-my-patterns__updated";
  const stamp = formatUpdatedAt(project.updatedAt);
  updated.textContent = stamp ? `Updated ${stamp}` : "";

  main.append(title);
  if (stamp) main.append(updated);

  const actions = document.createElement("div");
  actions.className = "account-my-patterns__actions";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "btn btn-sm btn-primary";
  openBtn.textContent = "Open Pattern";
  openBtn.setAttribute("data-kbm-my-patterns-action", "open");
  openBtn.addEventListener("click", () => {
    void onProjectAction(root, project.id, "open", project.name);
  });

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "btn btn-sm btn-outline-secondary";
  continueBtn.textContent = "Continue Editing";
  continueBtn.setAttribute("data-kbm-my-patterns-action", "continue");
  continueBtn.addEventListener("click", () => {
    void onProjectAction(root, project.id, "continue", project.name);
  });

  actions.append(openBtn, continueBtn);
  li.append(main, actions);
  list.append(li);
}

async function initMyPatterns(root: HTMLElement): Promise<void> {
  setStatus(root, "Loading your saved patterns…");
  setListVisible(root, false);

  const auth = await resolveCustomPatternProjectAuth();
  if (auth.mode === "none") {
    setStatus(root, "Sign in to view and open your saved patterns.");
    return;
  }

  const res = await listCustomPatternProjects("sleeveless");
  if (!res.ok) {
    setStatus(root, res.error, true);
    return;
  }

  const list = root.querySelector("[data-kbm-my-patterns-list]");
  if (list instanceof HTMLElement) list.replaceChildren();

  if (res.projects.length === 0) {
    setStatus(root, "You do not have any saved patterns yet. Save a project from the sleeveless Custom Build design step.");
    return;
  }

  const statusEl = root.querySelector("[data-kbm-my-patterns-status]");
  if (statusEl instanceof HTMLElement) statusEl.hidden = true;

  for (const project of res.projects) {
    renderProjectRow(root, project);
  }
  setListVisible(root, true);
}

function bootMyPatterns(): void {
  const root = document.querySelector("[data-kbm-my-patterns]");
  if (!(root instanceof HTMLElement)) return;
  void initMyPatterns(root);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootMyPatterns);
  } else {
    bootMyPatterns();
  }
}
