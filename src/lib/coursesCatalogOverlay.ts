import catalogFile from "../data/courses-catalog.json";

type CatalogFileEntry = {
  slug: string;
  description?: string;
};

type CoursesCatalogFile = {
  entries: CatalogFileEntry[];
};

const catalog = catalogFile as CoursesCatalogFile;

/** Overlay blurb from courses-catalog.json for a catalog slug. Safe for client bundles. */
export function getCatalogOverlayDescription(slug: string): string | undefined {
  const entry = catalog.entries.find((item) => item.slug === slug);
  const text = entry?.description?.trim();
  return text || undefined;
}
