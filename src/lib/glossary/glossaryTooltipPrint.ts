/**
 * Shared helpers for glossary placeholders hydrated in pattern HTML.
 */

/**
 * Visible trigger label only — prefer data-term over textContent.
 */
export function getGlossaryPlaceholderVisibleText(placeholder: HTMLElement): string {
  const fromTerm = placeholder.getAttribute("data-term")?.trim();
  if (fromTerm) return fromTerm;
  let text = "";
  for (const node of placeholder.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
    } else if (node instanceof HTMLElement && !node.classList.contains("tooltip-print-note")) {
      text += node.textContent ?? "";
    }
  }
  return text.trim();
}

/** Inline glossary placeholder for pattern HTML (trusted). Trigger text only. */
export function buildGlossaryTooltipPlaceholderHtml(
  glossaryId: number,
  visibleText: string,
  escapeAttr: (s: string) => string,
  escapeText: (s: string) => string,
): string {
  const label = (visibleText ?? "").trim();
  return `<span class="glossary-tooltip-placeholder" data-glossary-id="${glossaryId}" data-term="${escapeAttr(label)}">${escapeText(label)}</span>`;
}
