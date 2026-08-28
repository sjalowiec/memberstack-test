import { currentGlossaryPath } from "../kinCourse/legacyGlossaryHrefs";
import { slugify } from "../slugify";

/** Customer-facing origin for glossary term links (admin copy convenience). */
export const GLOSSARY_PUBLIC_ORIGIN = "https://knititnow.com";

export type GlossaryPickerRow = {
  glossaryId: number;
  term: string;
  slug: string;
  active: boolean;
};

type GlossaryLike = {
  glossaryId?: unknown;
  english?: unknown;
  active?: unknown;
};

export function stripGlossaryTermHtml(value: string): string {
  return (value ?? "").replace(/<[^>]*>/g, "").trim();
}

export function glossarySlugFromEnglish(english: string): string {
  return slugify(stripGlossaryTermHtml(english));
}

/** Production glossary URL derived from the English term (same slug as public pages). */
export function glossaryPublicUrlFromEnglish(english: string): string {
  return `${GLOSSARY_PUBLIC_ORIGIN}${currentGlossaryPath(glossarySlugFromEnglish(english))}`;
}

export function escapeGlossaryLinkText(value: string): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildGlossaryLinkHtml(slug: string, term: string): string {
  const safeSlug = slug.trim();
  const safeTerm = escapeGlossaryLinkText(term.trim());
  return `<a href="/glossary/${safeSlug}" class="glossary-link">${safeTerm}</a>`;
}

export function buildGlossaryPickerCatalog(entries: unknown[]): GlossaryPickerRow[] {
  if (!Array.isArray(entries)) return [];

  const rows: GlossaryPickerRow[] = [];
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as GlossaryLike;
    const glossaryId = Number(entry.glossaryId);
    const term = stripGlossaryTermHtml(String(entry.english ?? ""));
    if (!Number.isFinite(glossaryId) || !term) continue;

    rows.push({
      glossaryId,
      term,
      slug: glossarySlugFromEnglish(term),
      active: entry.active !== false,
    });
  }

  rows.sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
  return rows;
}

export function filterGlossaryPickerRows(
  rows: GlossaryPickerRow[],
  query: string,
  limit?: number,
): GlossaryPickerRow[] {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? rows.filter((row) => row.term.toLowerCase().includes(normalized))
    : rows;

  if (limit === undefined) {
    return filtered;
  }

  return filtered.slice(0, Math.max(0, limit));
}
