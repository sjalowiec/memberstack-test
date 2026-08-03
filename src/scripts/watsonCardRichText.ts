import { sanitizeCardDescriptionHtml } from "../lib/whatsNew/sanitizeBillboardHtml";
import { initCompactRichText } from "./watsonRichTextEditor";

/**
 * Compact contenteditable editor for What's New card descriptions.
 * Reuses the billboard editor pattern minus links: cards have a dedicated CTA.
 * Toolbar covers bold, italic, bulleted list, numbered list, clear formatting.
 */
export function initWatsonCardRichText(root: ParentNode = document): void {
  const wrap = root.querySelector<HTMLElement>("[data-wn-card-rte]");
  if (!wrap) return;
  initCompactRichText(wrap, {
    sanitize: sanitizeCardDescriptionHtml,
  });
}
