import { sanitizeBillboardHtml } from "../whatsNew/sanitizeBillboardHtml";

/** A real tag, such as <em> or </p>. Bare "<" in plain text does not match. */
const HTML_TAG_RE = /<\/?[a-z][^>]*>/i;

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Safe HTML for a Machines for Sale `shortHtml` value.
 *
 * Plain text is escaped and otherwise left unchanged, so existing cards keep
 * today's spacing (line breaks in the stored text still collapse). Markup is
 * limited to the What's New billboard allowlist: p, br, strong, b, em, i,
 * a[href], ul, ol, li. Scripts and other tags are removed.
 */
export function sanitizeMachineSalesShortHtml(input: string): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (!HTML_TAG_RE.test(trimmed)) return escapeText(trimmed);
  return sanitizeBillboardHtml(trimmed);
}
