import { sanitizeBillboardHtml } from "../whatsNew/sanitizeBillboardHtml";

const HTML_TAG = /<\/?[a-z][\s\S]*>/i;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain labels stay text. Real tags use the shared HTML sanitizer. */
export function formatHotspotTooltipHtml(text: string): string {
  if (!HTML_TAG.test(text)) {
    return escapeHtml(text)
      .replace(/\r\n|\n|\r/g, "<br>")
      .replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
      );
  }

  const sanitized = sanitizeBillboardHtml(text);
  const singleParagraph = sanitized.match(/^<p>([\s\S]*)<\/p>$/i);
  if (!singleParagraph || /<\/p>\s*<p/i.test(singleParagraph[1])) return sanitized;
  return singleParagraph[1];
}

/** Screen-reader name, without the formatting tags shown in the tooltip. */
export function hotspotTooltipAccessibleName(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
