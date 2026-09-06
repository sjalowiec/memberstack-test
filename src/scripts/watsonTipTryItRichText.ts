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
 * Compact contenteditable editors for Watson Tip of the Week.
 * Same allowlist and toolbar as the What's New billboard message.
 * Try It, Intro, and Sue’s Tip each use a `[data-totw-rte]` wrapper.
 */
export function initWatsonTipTryItRichText(root: ParentNode = document): void {
  const wraps = root.querySelectorAll<HTMLElement>("[data-totw-rte], [data-totw-try-rte]");
  wraps.forEach((wrap) => {
    initCompactRichText(wrap, {
      sanitize: sanitizeBillboardHtml,
      enableLink: true,
      promptLink: promptLinkUrl,
    });
  });
}
