/** Parsed `chapters` / `jumpLinks` entries from `videos-public.json` (and matching API shapes). */
export type CatalogChapterRow = { label: string; time: number };

function catalogChapterRowsFromLabelTimeArray(raw: unknown): CatalogChapterRow[] {
  if (!Array.isArray(raw)) return [];
  const out: CatalogChapterRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const t = r.time;
    let sec: number | null = null;
    if (typeof t === "number" && Number.isFinite(t)) sec = t;
    else if (typeof t === "string") {
      const s = t.trim();
      if (/^\d+(\.\d+)?$/.test(s)) sec = parseFloat(s);
    }
    if (!label || sec === null || sec < 0) continue;
    out.push({ label, time: sec });
  }
  return out;
}

/**
 * Jump / chapter controls for the video detail page and catalog modal.
 * Uses `chapters` when present; otherwise `jumpLinks` (same `{ label, time }` shape).
 */
export function catalogChaptersFromVideoRow(v: unknown): CatalogChapterRow[] {
  if (!v || typeof v !== "object") return [];
  const o = v as { chapters?: unknown; jumpLinks?: unknown };
  const fromChapters = catalogChapterRowsFromLabelTimeArray(o.chapters);
  if (fromChapters.length > 0) return fromChapters;
  return catalogChapterRowsFromLabelTimeArray(o.jumpLinks);
}
