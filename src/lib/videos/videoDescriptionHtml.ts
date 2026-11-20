import {
  billboardMessagePlainText,
  plainTextToBillboardHtml,
  sanitizeBillboardHtml,
} from "../whatsNew/sanitizeBillboardHtml";

function hasMarkup(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** The visual editor uses divs for Enter. Treat those as paragraphs. */
function editorDivsToParagraphs(html: string): string {
  return html.replace(/<\s*div\b/gi, "<p").replace(/<\s*\/\s*div\s*>/gi, "</p>");
}

/**
 * Description stored on the video.
 * Plain text is returned unchanged so existing catalog copy stays as written.
 * Paragraphs, line breaks, bold, italics, lists, and links are kept.
 * Everything else is removed with the same sanitizer used for other site HTML.
 */
export function sanitizeVideoDescriptionHtml(value: string): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!hasMarkup(trimmed)) return trimmed;
  return sanitizeBillboardHtml(editorDivsToParagraphs(trimmed));
}

/**
 * Safe HTML for the description under the video.
 * Plain text stays readable, including line breaks. Supported HTML is rendered.
 */
export function videoDescriptionDisplayHtml(value: string): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!hasMarkup(trimmed)) return plainTextToBillboardHtml(trimmed);
  return sanitizeBillboardHtml(editorDivsToParagraphs(trimmed));
}

/** Visible description text for cards, search, and the page summary. */
export function videoDescriptionPlainText(value: string): string {
  return billboardMessagePlainText(videoDescriptionDisplayHtml(value));
}
