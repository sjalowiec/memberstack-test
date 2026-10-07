import { catalogVideoPlaybackAccess } from "../videos/catalogVideoPlaybackAccess";
import { findPublicCatalogVideoByContentId, type VideoCatalogRecord } from "../videoPublic";

export type HelpHubWatchAndLearnVideo = {
  contentId: number;
  title: string;
  description: string;
  href: string;
  access: "open" | "member";
  accessLabel: "Free" | "Members only";
};

function asPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/** Editorial descriptions stay on the tip. Titles and access come from the catalog. */
export function normalizeHelpHubWatchAndLearn(
  value: unknown,
): { contentId: number; description: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { contentId: number; description: string }[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const contentId = asPositiveInt(rec.contentId ?? rec.content_id);
    if (contentId == null || seen.has(contentId)) continue;
    const description = typeof rec.description === "string" ? rec.description.trim() : "";
    seen.add(contentId);
    out.push({ contentId, description });
  }
  return out;
}

export function resolveHelpHubWatchAndLearn(
  watchAndLearn: unknown,
  videos: unknown,
  options: { tipSlug?: string } = {},
): HelpHubWatchAndLearnVideo[] {
  const list = Array.isArray(videos) ? (videos as VideoCatalogRecord[]) : [];
  const hub = typeof options.tipSlug === "string" ? options.tipSlug.trim() : "";
  const cards: HelpHubWatchAndLearnVideo[] = [];
  for (const ref of normalizeHelpHubWatchAndLearn(watchAndLearn)) {
    const row = findPublicCatalogVideoByContentId(list, ref.contentId);
    if (!row) continue;
    const title =
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : `Video ${ref.contentId}`;
    const access = catalogVideoPlaybackAccess(row);
    const href = hub
      ? `/videos/${ref.contentId}?from=help-hub&hub=${encodeURIComponent(hub)}`
      : `/videos/${ref.contentId}`;
    cards.push({
      contentId: ref.contentId,
      title,
      description: ref.description,
      href,
      access,
      accessLabel: access === "open" ? "Free" : "Members only",
    });
  }
  return cards;
}
