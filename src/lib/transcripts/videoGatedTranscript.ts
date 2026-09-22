/** Client-safe transcript helpers. Do not import the VTT glob here. */

export function parseAuthorizedTranscript(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    let text = "";
    if (typeof item === "string") text = item;
    else if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
      text = (item as { text: string }).text;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (text) out.push(text);
  }
  return out;
}

export function renderVideoTranscriptDisclosure(paragraphs: string[]): string {
  if (paragraphs.length === 0) return "";
  const sections = paragraphs
    .map(
      (paragraph) =>
        `<div class="kbm-transcript-section"><p class="kbm-transcript-text">${escapeHtml(paragraph)}</p></div>`,
    )
    .join("");
  const printCopy = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  return (
    `<details class="kbm-transcript" data-testid="transcript-details">` +
    `<summary class="kbm-transcript-summary" data-testid="transcript-toggle">` +
    `<span class="kbm-transcript-caret" aria-hidden="true"></span>` +
    `<span class="kbm-transcript-summary-label">Read transcript</span>` +
    `</summary>` +
    `<div class="kbm-transcript-content" data-testid="transcript-content">${sections}</div>` +
    `</details>` +
    `<div class="video-english-transcript-print" aria-hidden="true">${printCopy}</div>`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
