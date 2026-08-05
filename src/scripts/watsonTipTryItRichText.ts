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
 * Compact contenteditable Try It editor for Watson Tip of the Week.
 * Same allowlist and toolbar as the What's New billboard message.
 */
export function initWatsonTipTryItRichText(root: ParentNode = document): void {
  const wrap = root.querySelector<HTMLElement>("[data-totw-try-rte]");
  if (!wrap) return;
  initCompactRichText(wrap, {
    sanitize: sanitizeBillboardHtml,
    enableLink: true,
    promptLink: promptLinkUrl,
  });
}
