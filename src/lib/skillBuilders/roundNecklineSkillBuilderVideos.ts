/**
 * Optional video slots for the public round-neckline Skill Builders.
 *
 * Slots resolve Learning Library videos from `videos-public.json` by content_id.
 * Leave a key's content_id empty so the page does not render an embed.
 */
import videosPublic from "../../data/videos-public.json";
import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../lessonVideo";
import { findPublicVideoByContentId } from "../patterns/sleevelessCatalogHelpVideo";
import { catalogVideoIsPublic } from "../videoPublic";

export type SkillBuilderVideoSlot = {
  vimeoId: string;
  title?: string;
  contentId?: number;
  accessLevel?: string;
  /** Unlisted catalog `vimeo_hash`. Used only on the player embed (`h=`). */
  privacyHash?: string;
};

export type RoundNecklineSkillBuilderVideoKey =
  | "round-neckline-basics"
  | "round-neckline-basics/shallow-back"
  | "round-neckline-basics/deep-front"
  | "round-necklines-shaped-shoulders"
  | "round-necklines-shaped-shoulders/shallow-back"
  | "round-necklines-shaped-shoulders/deep-front";

export const SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID = 2212;

export const SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING = "Need a little help?";

export const SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY =
  "Watch the shaping sequence before you begin.";

export const DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_NOTE_LEAD =
  "The shaping process is the same as the shallow neckline exercise.";

export const DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_NOTE =
  "This time, knit more rows after the neckline shaping is complete before scrapping off the shoulder stitches.";

export const DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_REFRESHER =
  "Need a refresher? Watch the shallow neckline video.";

export const ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS: Record<
  RoundNecklineSkillBuilderVideoKey,
  number | null
> = {
  "round-neckline-basics": null,
  "round-neckline-basics/shallow-back": SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID,
  "round-neckline-basics/deep-front": SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_CONTENT_ID,
  "round-necklines-shaped-shoulders": null,
  "round-necklines-shaped-shoulders/shallow-back": null,
  "round-necklines-shaped-shoulders/deep-front": null,
};

export type SkillBuilderVideoHelperNote = {
  text: string;
  lead?: string;
};

export type SkillBuilderVideoHelperCopy = {
  heading: string;
  notes: SkillBuilderVideoHelperNote[];
};

export function skillBuilderVideoHelperCopy(
  key: RoundNecklineSkillBuilderVideoKey,
): SkillBuilderVideoHelperCopy | null {
  if (key === "round-neckline-basics/shallow-back") {
    return {
      heading: SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING,
      notes: [{ text: SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_COPY }],
    };
  }
  if (key === "round-neckline-basics/deep-front") {
    return {
      heading: SHALLOW_BACK_STRAIGHT_SHOULDER_VIDEO_HEADING,
      notes: [
        {
          lead: DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_NOTE_LEAD,
          text: DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_NOTE,
        },
        { text: DEEP_FRONT_STRAIGHT_SHOULDER_VIDEO_REFRESHER },
      ],
    };
  }
  return null;
}

function privacyHashFromCatalogRow(row: PublicVideoRow): string | undefined {
  const hash = typeof row.vimeo_hash === "string" ? row.vimeo_hash.trim() : "";
  return hash && /^[a-zA-Z0-9]+$/.test(hash) ? hash : undefined;
}

export function catalogVideoSlotForContentId(
  contentId: number,
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SkillBuilderVideoSlot | null {
  const row = findPublicVideoByContentId(catalog, contentId);
  if (!row || !catalogVideoIsPublic(row)) return null;
  const vimeoId = vimeoNumericIdFromPublicVideo(row);
  if (!vimeoId) return null;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  const accessLevel =
    typeof row.access_level === "string" && row.access_level.trim()
      ? row.access_level.trim()
      : "member";
  const privacyHash = privacyHashFromCatalogRow(row);
  return {
    contentId,
    vimeoId,
    title: title || undefined,
    accessLevel,
    ...(privacyHash ? { privacyHash } : {}),
  };
}

export function skillBuilderVideoSlot(
  key: RoundNecklineSkillBuilderVideoKey,
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SkillBuilderVideoSlot | null {
  const contentId = ROUND_NECKLINE_SKILL_BUILDER_VIDEO_CONTENT_IDS[key];
  if (!contentId) return null;
  return catalogVideoSlotForContentId(contentId, catalog);
}
