import glossaryData from "../../data/glossary.json";
import { glossarySlugFromEnglish } from "../glossary/glossaryPickerCatalog";

type GlossaryRow = {
  glossaryId?: unknown;
  english?: unknown;
  active?: unknown;
};

const siteSlugById = new Map<number, string>();
for (const row of glossaryData as GlossaryRow[]) {
  const id = typeof row.glossaryId === "number" ? row.glossaryId : Number(row.glossaryId);
  if (!Number.isInteger(id) || id <= 0 || row.active === false) continue;
  const slug = glossarySlugFromEnglish(String(row.english ?? ""));
  if (slug) siteSlugById.set(id, slug);
}

export type CourseGlossaryCatalogEntry = {
  glossaryId: number;
};

export type CourseGlossaryClick =
  | { type: "course"; glossaryId: number }
  | { type: "site"; slug: string }
  | { type: "ignore" };

/** Slug for the public glossary modal. Inactive and unknown ids return null. */
export function siteGlossarySlugForId(glossaryId: number): string | null {
  if (!Number.isInteger(glossaryId) || glossaryId <= 0) return null;
  return siteSlugById.get(glossaryId) ?? null;
}

/**
 * Course pages open their own short glossary when the id is in that course's
 * catalog. Any other current glossary id opens the shared site modal, so a
 * link copied from another course still works.
 */
export function courseGlossaryClick(
  glossaryId: number,
  catalog: readonly CourseGlossaryCatalogEntry[],
): CourseGlossaryClick {
  if (!Number.isInteger(glossaryId) || glossaryId <= 0) return { type: "ignore" };
  if (catalog.some((item) => item.glossaryId === glossaryId)) {
    return { type: "course", glossaryId };
  }
  const slug = siteGlossarySlugForId(glossaryId);
  if (!slug) return { type: "ignore" };
  return { type: "site", slug };
}
