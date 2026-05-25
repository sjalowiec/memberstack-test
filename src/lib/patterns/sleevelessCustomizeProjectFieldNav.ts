/** Deep-link from My Pattern → Customize tab for project title / notes editing. */

export const SLEEVELESS_CUSTOMIZE_REVIEW_PATH = "/patterns/sleeveless/review/";

export type SleevelessCustomizeProjectField = "title" | "notes";

const HASH_BY_TARGET: Record<SleevelessCustomizeProjectField, string> = {
  title: "edit-title",
  notes: "edit-notes",
};

export function customizeReviewHrefForField(target: SleevelessCustomizeProjectField): string {
  return `${SLEEVELESS_CUSTOMIZE_REVIEW_PATH}#${HASH_BY_TARGET[target]}`;
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
