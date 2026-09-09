/**
 * Video slot for the Short Rows Practice Skill Builder.
 * Resolves Learning Library video #330 from `videos-public.json`.
 */
import videosPublic from "../../data/videos-public.json";
import type { PublicVideoRow } from "../lessonVideo";
import {
  catalogVideoSlotForContentId,
  type SkillBuilderVideoSlot,
} from "./roundNecklineSkillBuilderVideos";

export const SHORT_ROWS_VIDEO_CONTENT_ID = 330;

export type ShortRowsVideoSlot = SkillBuilderVideoSlot & {
  contentId: number;
  accessLevel: string;
};

export function shortRowsVideoSlot(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): ShortRowsVideoSlot | null {
  const slot = catalogVideoSlotForContentId(SHORT_ROWS_VIDEO_CONTENT_ID, catalog);
  if (!slot?.contentId) return null;
  const accessLevel =
    typeof slot.accessLevel === "string" && slot.accessLevel.trim()
      ? slot.accessLevel.trim()
      : "member";
  return {
    ...slot,
    contentId: SHORT_ROWS_VIDEO_CONTENT_ID,
    accessLevel,
  };
}
