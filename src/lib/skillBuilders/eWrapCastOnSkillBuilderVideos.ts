/**
 * Video slot for the E-Wrap Cast On Basics Skill Builder.
 * Resolves Learning Library video #206 from `videos-public.json`.
 */
import videosPublic from "../../data/videos-public.json";
import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import type { SkillBuilderVideoSlot } from "./roundNecklineSkillBuilderVideos";
import { catalogVideoIsPublic } from "../videoPublic";

export const E_WRAP_CAST_ON_VIDEO_CONTENT_ID = 206;

export type EWrapCastOnVideoSlot = SkillBuilderVideoSlot & {
  contentId: number;
  accessLevel: string;
};

export function eWrapCastOnVideoSlot(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): EWrapCastOnVideoSlot | null {
  const row = findPublicVideoByContentId(catalog, E_WRAP_CAST_ON_VIDEO_CONTENT_ID);
  if (!row || !catalogVideoIsPublic(row)) return null;
  const vimeoId = vimeoNumericIdFromPublicVideo(row);
  if (!vimeoId) return null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const accessLevel =
    typeof row.access_level === "string" && row.access_level.trim()
      ? row.access_level.trim()
      : "member";
  return {
    contentId: E_WRAP_CAST_ON_VIDEO_CONTENT_ID,
    vimeoId,
    title: title || "E-Wrap Cast On",
    accessLevel,
  };
}
