/**
 * Learning Library videos for Sideways sweater body instructions.
 * Content ids are Knit it Now catalog ids. Vimeo ids come from the catalog row.
 * A missing row produces no control, so a different video is never substituted.
 */
import {
  sleevelessHelpVideoFromCatalog,
  type SleevelessHelpVideoMeta,
} from "./sleevelessCatalogHelpVideo";
import type { PublicVideoRow } from "../lessonVideo";
import videosPublic from "../../data/videos-public.json";

/** “Shaping a Sideways V-Neck”. Pullover V-neck only. */
export const SIDEWAYS_V_NECK_SHAPING_VIDEO_CONTENT_ID = 5003;

/** “Sideways Bust Darts”. Optional for pullover and cardigan. */
export const SIDEWAYS_BUST_DARTS_VIDEO_CONTENT_ID = 1012;

/** “Sideways Sweater Waist Shaping”. Optional for pullover and cardigan. */
export const SIDEWAYS_WAIST_SHAPING_VIDEO_CONTENT_ID = 960;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveSidewaysLearningVideo(
  contentId: number,
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(contentId, catalog);
}

/**
 * Blank neckline stays V-neck: the Sideways pullover builder authors `neckline: "v"`.
 * Any other saved neckline is not this video.
 */
export function isSidewaysVNeckline(neckline: unknown): boolean {
  const raw = String(neckline ?? "").trim().toLowerCase();
  const neck = raw || "v";
  return neck === "v" || neck === "v-neck" || neck === "vneck";
}

function catalogVideoButtonHtml(args: {
  contentId: number;
  hook: string;
  catalog?: PublicVideoRow[];
}): string {
  const video = resolveSidewaysLearningVideo(args.contentId, args.catalog);
  if (!video) return "";
  return (
    `<button type="button" class="kbm-kin-catalog-video pattern-help-link__button"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-content-id="${args.contentId}"` +
    ` data-video-autoplay="false"` +
    ` ${args.hook}` +
    ` aria-haspopup="dialog">` +
    `${escapeHtml(`Watch: ${video.title}`)}</button>`
  );
}

/**
 * Help line for each pullover V-neck shaping section.
 * Empty for any other neckline, and empty when content_id 5003 cannot be resolved.
 */
export function sidewaysPulloverVNeckShapingParagraph(
  neckline: unknown = "v",
  catalog?: PublicVideoRow[],
): string {
  if (!isSidewaysVNeckline(neckline)) return "";
  const button = catalogVideoButtonHtml({
    contentId: SIDEWAYS_V_NECK_SHAPING_VIDEO_CONTENT_ID,
    hook: "data-sideways-v-neck-shaping-video",
    catalog,
  });
  if (!button) return "";
  return (
    `This video shows the sideways V-neck shaping used in these instructions. ${button}`
  );
}

function optionalTechniqueParagraph(args: {
  contentId: number;
  hook: string;
  technique: string;
  catalog?: PublicVideoRow[];
}): string {
  const button = catalogVideoButtonHtml({
    contentId: args.contentId,
    hook: args.hook,
    catalog: args.catalog,
  });
  if (!button) return "";
  return (
    `Optional technique: ${args.technique}. This video shows shaping you can choose to add. ` +
    `The pattern instructions do not include this shaping. ${button}`
  );
}

/** Optional bust-dart and waist-shaping lines. Either line is omitted when its catalog row is missing. */
export function sidewaysOptionalShapingParagraphs(
  catalog?: PublicVideoRow[],
): string[] {
  return [
    optionalTechniqueParagraph({
      contentId: SIDEWAYS_BUST_DARTS_VIDEO_CONTENT_ID,
      hook: "data-sideways-bust-darts-video",
      technique: "Sideways bust darts",
      catalog,
    }),
    optionalTechniqueParagraph({
      contentId: SIDEWAYS_WAIST_SHAPING_VIDEO_CONTENT_ID,
      hook: "data-sideways-waist-shaping-video",
      technique: "Sideways waist shaping",
      catalog,
    }),
  ].filter((line) => line.length > 0);
}
