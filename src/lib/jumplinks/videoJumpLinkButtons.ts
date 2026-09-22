import type { CatalogChapterRow } from "../catalogVideoChapters";

export function parseAuthorizedJumpLinks(raw: unknown): CatalogChapterRow[] {
  if (!Array.isArray(raw)) return [];
  const out: CatalogChapterRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { label?: unknown; time?: unknown; t?: unknown };
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const t = row.time ?? row.t;
    let time: number | null = null;
    if (typeof t === "number" && Number.isFinite(t)) time = t;
    else if (typeof t === "string" && /^\d+(\.\d+)?$/.test(t.trim())) time = parseFloat(t.trim());
    if (!label || time === null || time < 0) continue;
    out.push({ label, time });
  }
  return out;
}

export function renderVideoJumpLinkButtons(links: CatalogChapterRow[]): string {
  return links
    .map((link) => {
      const time = String(link.time);
      const label = escapeHtml(link.label);
      return (
        `<button type="button" class="jumplink btn btn-secondary btn-small"` +
        ` data-video-jump="${time}" data-video-start="${time}">` +
        `<i class="fa fa-fast-forward" aria-hidden="true"></i>${label}</button>`
      );
    })
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
