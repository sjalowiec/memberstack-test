import data from "../../../data/jumplinks-by-content.json";
import type { CatalogChapterRow } from "../catalogVideoChapters";

type RawJumpLink = { t?: unknown; label?: unknown };
type RawRow = { content_id?: unknown; jumplinks?: unknown };

/** One-video DEV proof of concept: I-Cord Trims. */
export const VIDEO_DETAIL_MIGRATED_JUMPLINKS_CONTENT_ID = 266;

function parseJumpLink(raw: unknown): CatalogChapterRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as RawJumpLink;
  const label = typeof row.label === "string" ? row.label.trim() : "";
  const t = row.t;
  let time: number | null = null;
  if (typeof t === "number" && Number.isFinite(t)) time = t;
  else if (typeof t === "string" && /^\d+(\.\d+)?$/.test(t.trim())) time = parseFloat(t.trim());
  if (!label || time === null || time < 0) return null;
  return { label, time };
}

/**
 * Look up migrated jump links by catalog content ID from
 * `data/jumplinks-by-content.json`. Does not copy or duplicate the table.
 */
export function jumplinksByContentId(contentId: string | number): CatalogChapterRow[] {
  const id = Number(contentId);
  if (!Number.isFinite(id)) return [];
  const rows = (data as RawRow[]) ?? [];
  const row = rows.find((r) => Number(r?.content_id) === id);
  if (!Array.isArray(row?.jumplinks)) return [];
  const out: CatalogChapterRow[] = [];
  for (const item of row.jumplinks) {
    const parsed = parseJumpLink(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Video-detail PoC: only content 266 is wired from the migrated table.
 * Other catalog videos keep using `chapters` / `jumpLinks` on the row.
 */
export function videoDetailMigratedJumpLinks(contentId: string | number): CatalogChapterRow[] {
  if (Number(contentId) !== VIDEO_DETAIL_MIGRATED_JUMPLINKS_CONTENT_ID) return [];
  return jumplinksByContentId(contentId);
}
