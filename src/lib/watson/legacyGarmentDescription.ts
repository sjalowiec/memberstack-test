import { decodeHtmlEntities } from "../legacy/legacyEbookPlainText";

/**
 * Convert legacy GarmentDescription HTML into compact plain text for Watson.
 * Strips tags, links, images, popup markup, and attributes. Keeps readable
 * paragraph/list separation. Returns null when nothing useful remains.
 */
export function cleanLegacyGarmentDescription(html: string | null | undefined): string | null {
  if (html == null) {
    return null;
  }

  let text = String(html);
  if (!text.trim()) {
    return null;
  }

  text = text.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<img\b[^>]*>/gi, "");
  text = text.replace(/<(i|span|em)\b[^>]*class=["'][^"']*\bfa[\w-]*\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, "");

  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|h[1-6]|tr|table|section|blockquote|ul|ol|article)>/gi, "\n");
  text = text.replace(/<li\b[^>]*>/gi, "\n");
  text = text.replace(/<\/li>/gi, "");
  text = text.replace(/<(p|div|h[1-6]|ul|ol|section|article|tr|table|blockquote)\b[^>]*>/gi, "\n");
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  text = decodeHtmlEntities(text);
  if (/&(?:#x?[0-9a-f]+|#\d+|[a-z]+);/i.test(text)) {
    text = decodeHtmlEntities(text);
  }

  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/\r\n?/g, "\n");
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
}
