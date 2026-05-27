/**
 * Custom Build Foundation step — swap onboarding header for an edit workspace when a saved project is active.
 */
import {
  isEditingSavedCustomPatternProject,
  resolveEditingSavedPatternBannerName,
} from "./customPatternEditingUx";

export const CUSTOM_BUILD_FOUNDATION_DEFAULT_TITLE = "Foundation";

export const CUSTOM_BUILD_FOUNDATION_EDITING_TITLE = "Editing Saved Pattern";

export const CUSTOM_BUILD_FOUNDATION_EDITING_HELPER =
  "Make changes below, then save your project when you're ready.";

export const CUSTOM_BUILD_FOUNDATION_EDITING_PROJECT_PREFIX = "Project:";

/** @deprecated Use {@link CUSTOM_BUILD_FOUNDATION_EDITING_TITLE} plus optional project line instead. */
export function formatCustomBuildFoundationEditingTitle(projectName: string): string {
  const trimmed = projectName.trim();
  return trimmed ? `Editing: ${trimmed}` : "Editing saved pattern";
}

export function formatCustomBuildFoundationEditingProjectLine(projectName: string): string {
  const trimmed = projectName.trim();
  return trimmed ? `${CUSTOM_BUILD_FOUNDATION_EDITING_PROJECT_PREFIX} ${trimmed}` : "";
}

function readFoundationDefaultTitle(titleEl: HTMLElement): string {
  const fromData = titleEl.dataset.cbFoundationStepTitle?.trim();
  if (fromData) return fromData;
  const current = titleEl.textContent?.trim();
  if (current && current !== CUSTOM_BUILD_FOUNDATION_EDITING_TITLE) {
    titleEl.dataset.cbFoundationStepTitle = current;
    return current;
  }
  return CUSTOM_BUILD_FOUNDATION_DEFAULT_TITLE;
}

/** Foundation page header: edit workspace vs step title; show/hide onboarding copy. */
export function syncCustomBuildFoundationPageHeader(
  root: ParentNode | null | undefined = typeof document !== "undefined" ? document : null,
): void {
  if (!root?.querySelector) return;

  const header = root.querySelector("[data-cb-foundation-header]");
  if (!header || typeof header !== "object" || !("querySelector" in header)) return;

  const title = (header as ParentNode).querySelector?.(".pattern-title");
  const helper = (header as ParentNode).querySelector?.("[data-cb-editing-helper]");
  const projectLine = (header as ParentNode).querySelector?.("[data-cb-editing-project-name]");
  const editing = isEditingSavedCustomPatternProject();

  if (title && typeof title === "object" && "textContent" in title) {
    const titleEl = title as HTMLElement;
    const defaultTitle = readFoundationDefaultTitle(titleEl);
    titleEl.textContent = editing ? CUSTOM_BUILD_FOUNDATION_EDITING_TITLE : defaultTitle;
  }

  if (helper && typeof helper === "object" && "hidden" in helper && "textContent" in helper) {
    const helperEl = helper as HTMLElement;
    helperEl.textContent = CUSTOM_BUILD_FOUNDATION_EDITING_HELPER;
    helperEl.hidden = !editing;
  }

  if (projectLine && typeof projectLine === "object" && "hidden" in projectLine && "textContent" in projectLine) {
    const projectEl = projectLine as HTMLElement;
    const projectName = editing ? resolveEditingSavedPatternBannerName() : "";
    const line = formatCustomBuildFoundationEditingProjectLine(projectName);
    projectEl.textContent = line;
    projectEl.hidden = !line;
  }
}
