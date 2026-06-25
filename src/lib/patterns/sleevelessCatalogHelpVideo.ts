/**
 * Resolve sleeveless pattern help-video modal metadata from `videos-public.json`
 * (by catalog `content_id`), including jump links from `jumpLinks` / `chapters`.
 */
import videosPublic from "../../data/videos-public.json";
import { catalogChaptersFromVideoRow } from "../catalogVideoChapters";
import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../lessonVideo";
import { catalogVideoIsPublic } from "../videoPublic";

export type SleevelessHelpVideoMeta = {
  id: string;
  embedUrl?: string;
  title: string;
  description: string;
  jumpLinks: Array<{ label: string; seconds: number }>;
};

export function findPublicVideoByContentId(
  catalog: PublicVideoRow[],
  contentId: string | number,
): PublicVideoRow | undefined {
  const id = String(contentId).trim();
  if (!id) return undefined;
  return catalog.find((v) => String(v.content_id ?? "").trim() === id);
}

export function sleevelessHelpVideoFromCatalog(
  contentId: string | number,
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  const row = findPublicVideoByContentId(catalog, contentId);
  if (!row || !catalogVideoIsPublic(row)) return null;
  const vimeoId = vimeoNumericIdFromPublicVideo(row);
  if (!vimeoId) return null;

  const title = typeof row.title === "string" ? row.title.trim() : "";
  const description = typeof row.description === "string" ? row.description.trim() : "";
  const jumpLinks = catalogChaptersFromVideoRow(row).map((chapter) => ({
    label: chapter.label,
    seconds: chapter.time,
  }));

  return {
    id: vimeoId,
    title: title || "Video tutorial",
    description,
    jumpLinks,
  };
}
