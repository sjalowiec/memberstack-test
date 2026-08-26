/** Production KIN glossary term URLs: `/glossary/{id}/{slug}/term`. */

export type ParsedLegacyGlossaryHref = {
  id: number;
  slug: string;
};

const LEGACY_GLOSSARY_PATH =
  /^\/glossary\/(\d+)\/([^/]+)(?:\/term)?\/?$/i;

export function currentGlossaryPath(slug: string): string {
  const trimmed = slug.trim().replace(/\/+$/, "");
  return trimmed ? `/glossary/${trimmed}/` : "/glossary/";
}

export function parseLegacyGlossaryHref(href: string): ParsedLegacyGlossaryHref | null {
  const trimmed = (href ?? "").trim();
  if (!trimmed) return null;

  let pathname = "";
  try {
    pathname = new URL(trimmed, "https://knititnow.com").pathname;
  } catch {
    return null;
  }

  const match = LEGACY_GLOSSARY_PATH.exec(pathname);
  if (!match) return null;

  const id = Number(match[1]);
  let slug = match[2] || "";
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return null;
  }
  slug = slug.replace(/\/+$/, "");
  if (!Number.isFinite(id) || id <= 0 || !slug) return null;
  return { id, slug };
}

export function resolveLegacyGlossaryHref(
  href: string,
  glossary: Array<{ glossaryId: number; slug: string }>,
): { href: string; glossaryId: number; slug: string; modal: boolean } | null {
  const parsed = parseLegacyGlossaryHref(href);
  if (!parsed) return null;
  const entry = glossary.find((item) => item.glossaryId === parsed.id);
  if (entry) {
    return {
      href: `#glossary-${entry.glossaryId}`,
      glossaryId: entry.glossaryId,
      slug: entry.slug,
      modal: true,
    };
  }
  return {
    href: currentGlossaryPath(parsed.slug),
    glossaryId: parsed.id,
    slug: parsed.slug,
    modal: false,
  };
}
