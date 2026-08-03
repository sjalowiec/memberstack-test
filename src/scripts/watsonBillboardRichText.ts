import { sanitizeBillboardHtml } from "../lib/whatsNew/sanitizeBillboardHtml";
import { normalizeWhatsNewDestinationUrl } from "../lib/whatsNew/destinationUrl";
import { initCompactRichText } from "./watsonRichTextEditor";

function promptLinkUrl(): string | null {
  const raw = window.prompt("Link URL (site path like /tools, or https://…)");
  if (raw == null) return null;
  const result = normalizeWhatsNewDestinationUrl(raw);
  if (!result.ok || !result.value) {
    window.alert(result.ok ? "Enter a site path or https:// URL." : result.error);
    return null;
  }
  return result.value;
}

/**
 * Compact contenteditable billboard message editor for Watson What's New.
 * Sanitizes on sync/paste; toolbar covers bold, italic, paragraph, lists, link, clear.
 */
export function initWatsonBillboardRichText(root: ParentNode = document): void {
  const wrap = root.querySelector<HTMLElement>("[data-wn-rte]");
  if (!wrap) return;
  initCompactRichText(wrap, {
    sanitize: sanitizeBillboardHtml,
    enableLink: true,
    promptLink: promptLinkUrl,
  });
}
