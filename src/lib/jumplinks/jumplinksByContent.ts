import data from "../../../data/jumplinks-by-content.json";
import {
  catalogChaptersFieldFromVideoRow,
  catalogJumpLinksFieldFromVideoRow,
  type CatalogChapterRow,
} from "../catalogVideoChapters";

type RawJumpLink = { t?: unknown; label?: unknown };
type RawRow = { content_id?: unknown; jumplinks?: unknown };

export type VideoDetailJumpLinkSource = "chapters" | "jumpLinks" | "migrated" | "none";

export type ResolvedVideoDetailJumpLinks = {
  source: VideoDetailJumpLinkSource;
  links: CatalogChapterRow[];
};

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
 * Video-detail jump links. Catalog `chapters` win, then catalog `jumpLinks`,
 * then migrated rows. Sources are never combined.
 */
export function resolveVideoDetailJumpLinks(
  video: unknown,
  contentId?: string | number,
): ResolvedVideoDetailJumpLinks {
  const fromChapters = catalogChaptersFieldFromVideoRow(video);
  if (fromChapters.length > 0) return { source: "chapters", links: fromChapters };

  const fromJumpLinks = catalogJumpLinksFieldFromVideoRow(video);
  if (fromJumpLinks.length > 0) return { source: "jumpLinks", links: fromJumpLinks };

  const id =
    contentId ??
    (video && typeof video === "object" ? (video as { content_id?: unknown }).content_id : undefined);
  const migrated = jumplinksByContentId(id ?? "");
  if (migrated.length > 0) return { source: "migrated", links: migrated };

  return { source: "none", links: [] };
}
