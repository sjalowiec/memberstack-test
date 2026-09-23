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

const PRINT_TRANSCRIPT_ICON =
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M4 6V2.5h8V6"></path>` +
  `<path d="M4 11.5H2.5A1.5 1.5 0 0 1 1 10V7.5A1.5 1.5 0 0 1 2.5 6h11A1.5 1.5 0 0 1 15 7.5V10a1.5 1.5 0 0 1-1.5 1.5H12"></path>` +
  `<rect x="4" y="9.5" width="8" height="4.5" rx="0.5"></rect>` +
  `</svg>`;

/** Secondary control for the Read transcript header. Present only in rendered transcript markup. */
export function transcriptPrintButtonHtml(): string {
  return (
    `<button type="button" class="kbm-transcript-print" data-print-transcript data-testid="print-transcript" aria-label="Print Transcript">` +
    PRINT_TRANSCRIPT_ICON +
    `<span class="kbm-transcript-print-label">Print Transcript</span>` +
    `</button>`
  );
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
    transcriptPrintButtonHtml() +
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
