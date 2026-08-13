/**
 * Video slot for the Join Beautiful Shoulder Seams Skill Builder.
 * Resolves Learning Library video #202 from `videos-public.json`.
 */
import videosPublic from "../../data/videos-public.json";
import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import type { SkillBuilderVideoSlot } from "./roundNecklineSkillBuilderVideos";
import { catalogVideoIsPublic } from "../videoPublic";

export const JOINING_SHOULDER_SEAMS_VIDEO_CONTENT_ID = 202;

export type JoiningShoulderSeamsVideoSlot = SkillBuilderVideoSlot & {
  contentId: number;
  accessLevel: string;
};

export function joiningShoulderSeamsVideoSlot(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): JoiningShoulderSeamsVideoSlot | null {
  const row = findPublicVideoByContentId(catalog, JOINING_SHOULDER_SEAMS_VIDEO_CONTENT_ID);
  if (!row || !catalogVideoIsPublic(row)) return null;
  const vimeoId = vimeoNumericIdFromPublicVideo(row);
  if (!vimeoId) return null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const accessLevel =
    typeof row.access_level === "string" && row.access_level.trim()
      ? row.access_level.trim()
      : "member";
  return {
    contentId: JOINING_SHOULDER_SEAMS_VIDEO_CONTENT_ID,
    vimeoId,
    title: title || "3-Needle Bind off (Shoulder Seams)",
    accessLevel,
  };
}
