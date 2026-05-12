/** Parsed `chapters` entries from `videos-public.json` (and matching API shapes). */
export type CatalogChapterRow = { label: string; time: number };

export function catalogChaptersFromVideoRow(v: unknown): CatalogChapterRow[] {
  if (!v || typeof v !== "object") return [];
  const raw = (v as { chapters?: unknown }).chapters;
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
