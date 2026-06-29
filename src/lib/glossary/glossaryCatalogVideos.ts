/**
 * Glossary `vimeoIds` (and optional `videoIds`) hold internal catalog keys matching
 * `content_id` in `src/data/videos-public.json` — not raw Vimeo player ids.
 * Resolve rows from the public catalog and derive playback the same way as `/videos/[id].astro`.
 */
import { catalogChaptersFromVideoRow } from "../catalogVideoChapters";
import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../lessonVideo";
import { catalogVideoIsPublic } from "../videoPublic";

export type GlossaryEntryWithVideos = {
  videoIds?: unknown;
  vimeoIds?: unknown;
};

export type ResolvedGlossaryCatalogVideo = {
  contentId: string;
  title: string;
  vimeoNumericId: string | null;
  access: "open" | "member";
  /**
   * When true, open in KinCatalogVideoModal (site-wide) using resolved Vimeo id on `data-vimeo-id`.
   * Otherwise navigate to `/videos/{contentId}` (embed gating, jump links, or missing Vimeo id).
   */
  useModal: boolean;
};

function escapeHtmlAttr(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Same access rule as `src/pages/videos/[id].astro` (featured tip overrides to open). */
export function effectiveCatalogVideoAccess(v: PublicVideoRow): "open" | "member" {
  const isFeaturedTip = v.isTipOfWeek === true || v.tipOfWeek === true;
  if (isFeaturedTip) return "open";
  const level = String(v.access_level ?? "member").trim().toLowerCase();
  return level === "open" ? "open" : "member";
}

export function glossaryInternalVideoIdList(entry: GlossaryEntryWithVideos): string[] {
  const raw = entry.videoIds ?? entry.vimeoIds;
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function resolveGlossaryCatalogVideos(
  entry: GlossaryEntryWithVideos,
  catalog: PublicVideoRow[],
  excludeIds: Iterable<string> = [],
): ResolvedGlossaryCatalogVideo[] {
  const excluded = new Set<string>();
  for (const id of excludeIds) {
    const s = String(id ?? "").trim();
    if (s) excluded.add(s);
  }
  const ids = glossaryInternalVideoIdList(entry).filter((id) => !excluded.has(id));
  const rows: ResolvedGlossaryCatalogVideo[] = [];
  for (const id of ids) {
    const v = catalog.find((x) => String(x.content_id ?? "").trim() === id);
    if (!v || !catalogVideoIsPublic(v)) continue;
    const vimeoNumericId = vimeoNumericIdFromPublicVideo(v);
    const access = effectiveCatalogVideoAccess(v);
    const rawTitle = typeof v.title === "string" ? v.title.trim() : "";
    const title = rawTitle || "Watch video";
    const useModal = access === "open" && vimeoNumericId != null;
    rows.push({
      contentId: String(v.content_id ?? "").trim() || id,
      title,
      vimeoNumericId,
      access,
      useModal,
    });
  }
  return rows;
}

export function buildGlossaryRelatedVideosHtml(
  entry: GlossaryEntryWithVideos,
  catalog: PublicVideoRow[],
  excludeIds: Iterable<string> = [],
): string {
  const resolved = resolveGlossaryCatalogVideos(entry, catalog, excludeIds);
  if (resolved.length === 0) return "";

  const heading = resolved.length === 1 ? "Related video" : "Related videos";
  const items = resolved
    .map((r) => {
      const label = escapeHtmlText(r.title);
      if (r.useModal && r.vimeoNumericId) {
        const vid = escapeHtmlAttr(r.vimeoNumericId);
        const t = escapeHtmlAttr(r.title);
        const fullRow = catalog.find((x) => String(x.content_id ?? "").trim() === r.contentId);
        const chapters = fullRow ? catalogChaptersFromVideoRow(fullRow) : [];
        const chaptersAttr =
          chapters.length > 0
            ? ` data-video-chapters="${escapeHtmlAttr(JSON.stringify(chapters))}"`
            : "";
        return `<li class="glossary-related-videos__item"><button type="button" class="kbm-kin-catalog-video glossary-related-videos__btn" data-vimeo-id="${vid}" data-video-title="${t}"${chaptersAttr}>${label}</button></li>`;
      }
      const href = escapeHtmlAttr(`/videos/${r.contentId}`);
      const isMember = r.access === "member";
      const memberClass = isMember ? " glossary-related-videos__link--member" : "";
      const lock = isMember
        ? `<span class="glossary-related-videos__lock" aria-hidden="true">🔒</span>`
        : "";
      const badge = isMember
        ? `<span class="glossary-related-videos__badge">Members only</span>`
        : "";
      return `<li class="glossary-related-videos__item"><a class="glossary-related-videos__link${memberClass}" href="${href}">${lock}<span class="glossary-related-videos__label">${label}</span>${badge}</a></li>`;
    })
    .join("");

  return `<section class="glossary-related-videos" aria-label="${escapeHtmlAttr(heading)}"><h3 class="glossary-related-videos__title">${escapeHtmlText(heading)}</h3><ul class="glossary-related-videos__list">${items}</ul></section>`;
}
