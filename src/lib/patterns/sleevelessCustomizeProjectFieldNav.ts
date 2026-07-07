/** Deep-link into the pattern workspace Edit drawer for project title / notes editing. */

import {
  OPEN_PATTERN_EDIT_WORKSPACE_HREF,
  PATTERN_WORKSPACE_EDIT_QUERY,
} from "./customPatternProjectNavigation";

/** @deprecated Review route redirects to workspace; use {@link SLEEVELESS_CUSTOMIZE_WORKSPACE_PATH}. */
export const SLEEVELESS_CUSTOMIZE_REVIEW_PATH = OPEN_PATTERN_EDIT_WORKSPACE_HREF;

/** Pattern workspace with Edit drawer auto-opened (`?edit=1`). */
export const SLEEVELESS_CUSTOMIZE_WORKSPACE_PATH = OPEN_PATTERN_EDIT_WORKSPACE_HREF;

export type SleevelessCustomizeProjectField = "title" | "notes";

const HASH_BY_TARGET: Record<SleevelessCustomizeProjectField, string> = {
  title: "edit-title",
  notes: "edit-notes",
};

export function customizeReviewHrefForField(target: SleevelessCustomizeProjectField): string {
  return `${SLEEVELESS_CUSTOMIZE_WORKSPACE_PATH}#${HASH_BY_TARGET[target]}`;
}

export function navigateToCustomizeProjectField(target: SleevelessCustomizeProjectField): void {
  window.location.assign(customizeReviewHrefForField(target));
}

export function parseCustomizeProjectFieldHash(
  hash: string,
): SleevelessCustomizeProjectField | null {
  const id = hash.replace(/^#/, "").trim();
  if (id === HASH_BY_TARGET.title) return "title";
  if (id === HASH_BY_TARGET.notes) return "notes";
  return null;
}

export function consumeCustomizeProjectFieldHash(): SleevelessCustomizeProjectField | null {
  const target = parseCustomizeProjectFieldHash(window.location.hash);
  if (!target) return null;
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  history.replaceState(null, "", cleanUrl);
  return target;
}

/** Query flag used when deep-linking into the workspace edit surface. */
export const SLEEVELESS_CUSTOMIZE_WORKSPACE_EDIT_QUERY = PATTERN_WORKSPACE_EDIT_QUERY;
