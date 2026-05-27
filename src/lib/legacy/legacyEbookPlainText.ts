const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode numeric and common named HTML entities to plain text. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number.parseInt(num, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&([a-z]+);/gi, (entity, name) => {
      const decoded = NAMED_HTML_ENTITIES[name.toLowerCase()];
      return decoded ?? entity;
    });
}

/**
 * Strip light HTML from legacy CSV Breif / shortDescription for card previews.
 * Full descriptionHtml is unchanged for future detail pages.
 */
export function plainTextFromLegacyEbookBrief(html: string): string {
  if (!html) return "";

  let text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|tr|td|th|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = decodeHtmlEntities(text);
  if (/&(?:#x?[0-9a-f]+|#\d+|[a-z]+);/i.test(text)) {
    text = decodeHtmlEntities(text);
  }

  return text.replace(/\s+/g, " ").trim();
}
